import { useEffect, useState } from 'react'
import { runWithConcurrency } from '../containerBatch.js'
import { FindingsReport, FindingDetail } from '../findings.jsx'
import { formatOsDisplayFromParts, formatTargetLabel } from '../targetLabel.js'
import './Console.css'
import './Findings.css'

// Escopo desta tela: listar containers Docker deste host (GET /containers,
// já filtra fora o próprio stack do invariant), descobrir de antemão quais
// têm SO compatível (GET /containers/{name}/check -- leve, não roda os 199
// checks) e rodar o assessment real (POST /assess/{target}, docker exec,
// mesmo mecanismo do /demo -- sem credenciais) um de cada vez ou em lote.
//
// "Compatível" (checkStatus) e "deve entrar no lote" (selected) são
// conceitos deliberadamente separados -- o backend só sabe dizer se o SO
// tem checks CIS; ele não sabe distinguir um container de aplicação
// (tamois, babybet) de infra (postgres, redis, nginx) que por acaso também
// rode Debian/Ubuntu. Sem nenhum label/metadado pra fazer essa distinção
// hoje, a seleção pro "Run selected" é sempre opt-in do usuário -- nunca
// pré-marcada, nem para os compatíveis.
//
// `busy` é um lock de UI único (não um scheduler): enquanto qualquer
// checagem ou assessment estiver em voo -- Check, lote, avulso ou retry --
// todo outro gatilho fica desabilitado. Isso é o que garante que o pool de
// concorrência 2 do "Run selected" realmente signifique "no máximo 2 ao
// mesmo tempo": sem o lock, um "Run assessment →" avulso clicado durante o
// lote criaria um terceiro assessment simultâneo contra produção.

const RUN_SELECTED_CONCURRENCY = 2
// A consolidated report compares prevalence/compliance across a fleet --
// with a single asset there's nothing to compare, so the export button
// stays disabled below this count even after the batch finishes.
const MIN_CONSOLIDATED_TARGETS = 2

function defaultState() {
  return {
    checkStatus: 'idle', // 'idle' | 'checking' | 'supported' | 'unsupported' | 'error'
    os_id: null,
    os_version_id: null,
    reason: null,
    selected: false,
    assessmentStatus: 'idle', // 'idle' | 'queued' | 'running' | 'success' | 'error'
    findings: null,
    assessError: null,
  }
}

function AssessAction({ state, busy, onRun }) {
  switch (state.assessmentStatus) {
    case 'queued':
      return <span className="hint">Na fila…</span>
    case 'running':
      return <span className="hint">Avaliando…</span>
    case 'success': {
      const passed = state.findings.filter((f) => f.status === 'PASS').length
      const failed = state.findings.filter((f) => f.status === 'FAIL').length
      return (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge--pass">{passed} PASS</span>
          <span className="badge badge--fail">{failed} FAIL</span>
          <button type="button" className="link-btn" onClick={onRun} disabled={busy}>
            Ver relatório →
          </button>
        </div>
      )
    }
    case 'error':
      return (
        <div>
          <p className="hint" style={{ color: 'var(--red)' }}>
            {state.assessError}
          </p>
          <button type="button" className="link-btn" onClick={onRun} disabled={busy}>
            Tentar novamente
          </button>
        </div>
      )
    default:
      return (
        <button type="button" className="link-btn" onClick={onRun} disabled={busy}>
          Executar avaliação →
        </button>
      )
  }
}

function CompatibleCard({ container, state, busy, onToggleSelected, onRun }) {
  const osDisplay = formatOsDisplayFromParts(state.os_id, state.os_version_id)
  const label = formatTargetLabel('docker_container', osDisplay, { containerImage: container.image })

  // Clicking anywhere on the card body toggles selection -- the checkbox
  // and the AssessAction buttons below each stop propagation so they keep
  // their own independent behavior instead of also toggling selection.
  // The checkbox stays the keyboard-accessible way to (de)select; this is
  // a mouse-convenience layer on top, not a replacement for it.
  function handleCardClick() {
    if (busy) return
    onToggleSelected(container.name)
  }

  return (
    <div
      className={`target-card target-card--selectable ${state.selected ? 'target-card--selected' : ''}`}
      onClick={handleCardClick}
    >
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          checked={state.selected}
          disabled={busy}
          onChange={() => onToggleSelected(container.name)}
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: '0.3rem' }}
        />
        <div style={{ flex: 1 }}>
          <div className="target-card__title mono">{container.name}</div>
          <div className="hint" style={{ marginBottom: '0.5rem' }}>{label}</div>
        </div>
      </div>
      <div style={{ marginTop: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
        <AssessAction state={state} busy={busy} onRun={() => onRun(container)} />
      </div>
    </div>
  )
}

function UncheckedCard({ container, busy, onRun }) {
  return (
    <div className="target-card">
      <div className="target-card__title mono">{container.name}</div>
      <div className="hint" style={{ marginBottom: '0.75rem' }}>{container.image}</div>
      <button type="button" className="link-btn" onClick={() => onRun(container)} disabled={busy}>
        Executar avaliação →
      </button>
    </div>
  )
}

function InfoCard({ container, reason }) {
  return (
    <div className="target-card">
      <div className="target-card__title mono">{container.name}</div>
      <div className="hint">{reason}</div>
    </div>
  )
}

export default function Containers({ apiFetch, username, onLogout }) {
  const [containers, setContainers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [compat, setCompat] = useState({}) // name -> state (see defaultState())
  const [busy, setBusy] = useState(false)
  // true only once a "Run selected" batch has fully finished -- gates the
  // consolidated export so it can never fire against a still-running or
  // stale batch (a fresh Check compatibility invalidates it again).
  const [batchCompleted, setBatchCompleted] = useState(false)
  const [lastBatchTargets, setLastBatchTargets] = useState([])
  const [exportingConsolidated, setExportingConsolidated] = useState(false)
  // null = container list. Otherwise:
  //   {kind:'assess-result', container, findings}
  //   {kind:'finding-detail', container, findings, finding}
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    apiFetch('/api/containers')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(setContainers)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setContainerState(name, patch) {
    setCompat((prev) => ({ ...prev, [name]: { ...(prev[name] ?? defaultState()), ...patch } }))
  }

  const checked = Object.keys(compat).length > 0
  const supported = containers.filter((c) => compat[c.name]?.checkStatus === 'supported')
  const unsupported = containers.filter((c) => compat[c.name]?.checkStatus === 'unsupported')
  const checking = containers.filter((c) => compat[c.name]?.checkStatus === 'checking')
  const checkFailed = containers.filter((c) => compat[c.name]?.checkStatus === 'error')
  const selectedCount = supported.filter((c) => compat[c.name]?.selected).length
  // Gated on lastBatchTargets (the batch that actually ran, and whose
  // findings would be exported), not the live `selectedCount` -- the
  // checkboxes can change after "Executar selecionados" runs, and the
  // export button's enablement must track what was actually assessed,
  // not whatever happens to be checked right now.
  const exportDisabledReason = !batchCompleted
    ? 'Execute a avaliação dos containers selecionados antes de exportar o relatório consolidado.'
    : lastBatchTargets.length < MIN_CONSOLIDATED_TARGETS
      ? 'Selecione e execute a avaliação de pelo menos dois containers antes de exportar o relatório consolidado.'
      : null

  async function handleCheckCompatibility() {
    if (busy || containers.length === 0) return
    setBusy(true)
    setError(null)
    setBatchCompleted(false) // any previous batch's results are about to be wiped
    setLastBatchTargets([])
    setCompat(() => {
      const next = {}
      for (const c of containers) next[c.name] = { ...defaultState(), checkStatus: 'checking' }
      return next
    })
    await runWithConcurrency(
      containers,
      async (c) => {
        const response = await apiFetch(`/api/containers/${c.name}/check`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      },
      Math.max(1, containers.length),
      (c, settled) => {
        if (settled.status === 'fulfilled') {
          const r = settled.value
          setContainerState(c.name, {
            checkStatus: r.testable ? 'supported' : 'unsupported',
            os_id: r.os_id,
            os_version_id: r.os_version_id,
            reason: r.reason,
            selected: false, // opt-in -- never pre-checked, even for compatible containers
          })
        } else {
          setContainerState(c.name, { checkStatus: 'error', reason: settled.reason.message })
        }
      },
    )
    setBusy(false)
  }

  function toggleSelected(name) {
    if (busy) return
    setContainerState(name, { selected: !compat[name]?.selected })
  }

  async function assessContainer(container) {
    setContainerState(container.name, { assessmentStatus: 'running', findings: null, assessError: null })
    const response = await apiFetch(`/api/assess/${container.name}`, { method: 'POST' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.detail ?? `HTTP ${response.status}`)
    }
    return response.json()
  }

  async function handleAssessOne(container) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const findings = await assessContainer(container)
      setContainerState(container.name, { assessmentStatus: 'success', findings })
      setDetail({ kind: 'assess-result', container, findings })
    } catch (err) {
      setContainerState(container.name, { assessmentStatus: 'error', assessError: err.message })
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleRunSelected() {
    if (busy) return
    const targets = supported.filter((c) => compat[c.name]?.selected)
    if (targets.length === 0) return
    setBusy(true)
    setBatchCompleted(false)
    setLastBatchTargets(targets)
    setError(null)
    for (const c of targets) {
      setContainerState(c.name, { assessmentStatus: 'queued', findings: null, assessError: null })
    }
    runWithConcurrency(
      targets,
      (c) => assessContainer(c),
      RUN_SELECTED_CONCURRENCY,
      (c, settled) => {
        if (settled.status === 'fulfilled') {
          setContainerState(c.name, { assessmentStatus: 'success', findings: settled.value })
        } else {
          setContainerState(c.name, { assessmentStatus: 'error', assessError: settled.reason.message })
        }
      },
    ).finally(() => {
      setBusy(false)
      setBatchCompleted(true)
    })
  }

  async function handleExportConsolidated() {
    if (busy) return
    setExportingConsolidated(true)
    try {
      const assets = lastBatchTargets.map((c) => {
        const state = compat[c.name]
        return {
          name: c.name,
          status: state?.assessmentStatus === 'success' ? 'success' : 'error',
          findings: state?.findings ?? [],
          error: state?.assessError ?? null,
        }
      })
      const response = await apiFetch('/api/reports/pdf', {
        method: 'POST',
        body: JSON.stringify({ title: 'Consolidated Assessment', kind: 'consolidated', assets }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'invariant-consolidated-report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      window.alert(`Falha ao exportar relatório consolidado: ${err.message}`)
    } finally {
      setExportingConsolidated(false)
    }
  }

  function openReport(container) {
    const state = compat[container.name]
    if (state?.findings) setDetail({ kind: 'assess-result', container, findings: state.findings })
  }

  function handleCardAction(container) {
    const state = compat[container.name]
    if (state?.assessmentStatus === 'success') {
      openReport(container)
    } else {
      handleAssessOne(container)
    }
  }

  return (
    <div className="page">
      <header className="site-header">
        <div className="brand">INVARIANT</div>
        <div className="session-info">
          <a href="/endpoints" className="link-btn">
            Linux Hosts
          </a>
          <span>{username}</span>
          <button type="button" className="btn-secondary" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      {error && (
        <p className="error" style={{ marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      {!detail && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Containers ({containers.length})</h2>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn-secondary" onClick={handleCheckCompatibility} disabled={busy || containers.length === 0}>
                Verificar compatibilidade
              </button>
              <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={handleRunSelected} disabled={busy || selectedCount === 0}>
                Executar selecionados ({selectedCount})
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleExportConsolidated}
                disabled={busy || exportingConsolidated || exportDisabledReason !== null}
                title={exportDisabledReason ?? undefined}
              >
                {exportingConsolidated ? 'Exportando…' : 'Exportar relatório consolidado'}
              </button>
            </div>
          </div>

          {!loaded && <p className="hint">Carregando…</p>}
          {loaded && containers.length === 0 && <p className="hint">Nenhum container encontrado neste host.</p>}

          {!checked && (
            <div className="card-grid" style={{ marginTop: '1rem' }}>
              {containers.map((container) => (
                <UncheckedCard key={container.name} container={container} busy={busy} onRun={handleCardAction} />
              ))}
            </div>
          )}

          {checked && (
            <>
              {checking.length > 0 && <p className="hint">Verificando compatibilidade… ({checking.length} restantes)</p>}

              <h4 className="finding-group" style={{ marginTop: '1.5rem' }}>Compatíveis ({supported.length})</h4>
              {supported.length === 0 && <p className="hint">Nenhum container compatível encontrado.</p>}
              <div className="card-grid">
                {supported.map((container) => (
                  <CompatibleCard
                    key={container.name}
                    container={container}
                    state={compat[container.name]}
                    busy={busy}
                    onToggleSelected={toggleSelected}
                    onRun={handleCardAction}
                  />
                ))}
              </div>

              {unsupported.length > 0 && (
                <>
                  <h4 className="finding-group" style={{ marginTop: '1.5rem' }}>Não compatíveis ({unsupported.length})</h4>
                  <div className="card-grid">
                    {unsupported.map((container) => (
                      <InfoCard key={container.name} container={container} reason={compat[container.name]?.reason} />
                    ))}
                  </div>
                </>
              )}

              {checkFailed.length > 0 && (
                <>
                  <h4 className="finding-group finding-group--warning" style={{ marginTop: '1.5rem' }}>
                    Falha na verificação ({checkFailed.length})
                  </h4>
                  <div className="card-grid">
                    {checkFailed.map((container) => (
                      <InfoCard key={container.name} container={container} reason={compat[container.name]?.reason} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {detail?.kind === 'assess-result' && (
        <FindingsReport
          title={detail.container.name}
          findings={detail.findings}
          apiFetch={apiFetch}
          containerImage={detail.container.image}
          onSelectFinding={(finding) =>
            setDetail({ kind: 'finding-detail', container: detail.container, findings: detail.findings, finding })
          }
          onBack={() => setDetail(null)}
        />
      )}
      {detail?.kind === 'finding-detail' && (
        <FindingDetail
          finding={detail.finding}
          onBack={() => setDetail({ kind: 'assess-result', container: detail.container, findings: detail.findings })}
        />
      )}
    </div>
  )
}
