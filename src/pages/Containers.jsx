import { useEffect, useState } from 'react'
import { runWithConcurrency } from '../containerBatch.js'
import { FindingsReport, FindingDetail } from '../findings.jsx'
import { formatOsDisplayFromParts, formatTargetLabel } from '../targetLabel.js'
import './Console.css'
import './Findings.css'

// Overridable via VITE_API_BASE, same convention as Home.jsx/Demo.jsx --
// VisitorContainers usa isso pra montar link direto pro GET público
// /demo-snapshot/report (fora do apiFetch normal, porque é um link de
// navegador que abre o PDF, não uma chamada fetch).
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

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
  // Deliberately no containerImage here -- a real image reference
  // (registry/repo:digest) can run well past a grid card's width and
  // overflow into the next one. "Docker container · Debian 13" is
  // always short and predictable; the full image is still shown
  // elsewhere (the report view) where there's room for it.
  const label = formatTargetLabel('docker_container', osDisplay)

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

function UncheckedCard({ container }) {
  // Nenhuma ação aqui de propósito: rodar uma avaliação individual antes de
  // "Verificar compatibilidade" saberia o SO deste container arriscaria
  // gastar um assessment real contra um SO sem benchmark aplicável -- é
  // exatamente isso que o Check evita. Uma vez supported, o mesmo container
  // reaparece como CompatibleCard, que aí sim tem o botão via AssessAction.
  // A instrução de "verifique a compatibilidade primeiro" mora só no
  // FlowGuide, uma vez só -- repeti-la por card (como era antes) vira a
  // mesma frase escrita dezenas de vezes na tela com uma lista grande.
  return (
    <div className="target-card">
      <div className="target-card__title mono">{container.name}</div>
      <div className="hint">{container.image}</div>
    </div>
  )
}

// Explica o fluxo uma única vez, no topo da página -- substitui a dica que
// antes se repetia em cada UncheckedCard. Texto parafraseado de propósito
// (nunca usa o texto exato de um rótulo de botão sozinho num nó): os testes
// casam "Executar selecionados" por substring/regex, e qualquer nó de texto
// que reproduza esse trecho literalmente quebraria esse getByText (exige 1
// match só). "Verificar compatibilidade"/"Exportar relatório consolidado"
// são casados por string exata, então já ficariam seguros mesmo citados,
// mas a paráfrase evita ambiguidade de qualquer forma.
function FlowGuide() {
  return (
    <div className="flow-guide">
      <p className="flow-guide__title">Como funciona esta tela</p>
      <ol className="flow-guide__steps">
        <li>Verifique a compatibilidade dos containers para identificar o sistema operacional de cada um e quais têm checks CIS aplicáveis.</li>
        <li>Rode a avaliação: em lote (marque vários containers compatíveis e execute de uma vez) ou individualmente, container por container.</li>
        <li>Exporte os relatórios: PDF CEO ou Técnico por container avaliado, e o relatório Consolidado comparando dois ou mais containers já avaliados.</li>
      </ol>
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

// Um bloco de renderização por ambiente (demonstrativo/operacional) --
// mesma lógica que antes era calculada uma vez só pra todos os
// containers, agora reaplicada a cada subconjunto (container.is_demo)
// antes de renderizar. CompatibleCard/InfoCard/UncheckedCard e o fluxo
// de seleção/avaliação são idênticos nos dois ambientes -- só
// "Publicar como demo" trata os dois de forma diferente (ver
// assessedContainers em AdminContainers).
function ContainerSection({ heading, groupContainers, checked, compat, busy, onToggleSelected, onRun }) {
  if (groupContainers.length === 0) return null

  const supported = groupContainers.filter((c) => compat[c.name]?.checkStatus === 'supported')
  const unsupported = groupContainers.filter((c) => compat[c.name]?.checkStatus === 'unsupported')
  const checking = groupContainers.filter((c) => compat[c.name]?.checkStatus === 'checking')
  const checkFailed = groupContainers.filter((c) => compat[c.name]?.checkStatus === 'error')

  return (
    <section style={{ marginTop: '2rem' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>
        {heading} ({groupContainers.length})
      </h3>

      {!checked && (
        <div className="card-grid">
          {groupContainers.map((container) => (
            <UncheckedCard key={container.name} container={container} />
          ))}
        </div>
      )}

      {checked && (
        <>
          {checking.length > 0 && <p className="hint">Verificando compatibilidade… ({checking.length} restantes)</p>}

          <h4 className="finding-group" style={{ marginTop: '1rem' }}>Compatíveis ({supported.length})</h4>
          {supported.length === 0 && <p className="hint">Nenhum container compatível encontrado.</p>}
          <div className="card-grid">
            {supported.map((container) => (
              <CompatibleCard
                key={container.name}
                container={container}
                state={compat[container.name]}
                busy={busy}
                onToggleSelected={onToggleSelected}
                onRun={onRun}
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
    </section>
  )
}

// /containers é o ponto de entrada da demo pública (Home.jsx's "Explorar
// demo") -- sem sessão, App.jsx renderiza <VisitorContainers> em vez
// deste componente (ver seu próprio comentário mais abaixo). Isso aqui
// é só o console autenticado: containers reais, checagem, assessment,
// relatórios ao vivo, e o painel de publicação da demo.
export default function Containers({ apiFetch, username, onLogout, isVisitor = false, onRequestLogin }) {
  if (isVisitor) {
    return <VisitorContainers apiFetch={apiFetch} onRequestLogin={onRequestLogin} />
  }
  return <AdminContainers apiFetch={apiFetch} username={username} onLogout={onLogout} />
}

function AdminContainers({ apiFetch, username, onLogout }) {
  const [containers, setContainers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [compat, setCompat] = useState({}) // name -> state (see defaultState())
  const [busy, setBusy] = useState(false)
  const [exportingConsolidated, setExportingConsolidated] = useState(false)
  // null = container list. Otherwise:
  //   {kind:'assess-result', container, findings}
  //   {kind:'finding-detail', container, findings, finding}
  const [detail, setDetail] = useState(null)
  // idle | previewing | preview-ready | publishing | published | error
  const [publishState, setPublishState] = useState('idle')
  const [publishPreview, setPublishPreview] = useState(null)
  const [publishError, setPublishError] = useState(null)
  const [revokeMessage, setRevokeMessage] = useState(null)

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
  // "Compatível" atravessa os dois ambientes (demo/operacional) -- usado
  // só pra selectedCount/readyToExport/consolidado, que continuam
  // funcionando sobre qualquer container. A separação visual por
  // container.is_demo acontece dentro de ContainerSection, não aqui.
  const supported = containers.filter((c) => compat[c.name]?.checkStatus === 'supported')
  const selectedCount = supported.filter((c) => compat[c.name]?.selected).length
  // Live selection, not a frozen batch snapshot: any container currently
  // checked AND already successfully assessed counts, regardless of
  // whether that assessment came from "Executar selecionados" or a
  // standalone "Executar avaliação →". Unchecking a container after it was
  // counted removes it immediately -- there's no notion of "the last batch
  // that ran" anymore.
  const readyToExport = supported.filter(
    (c) => compat[c.name]?.selected && compat[c.name]?.assessmentStatus === 'success',
  )
  const exportDisabledReason =
    readyToExport.length < MIN_CONSOLIDATED_TARGETS
      ? 'Selecione pelo menos dois containers já avaliados (com relatório individual) para exportar o relatório consolidado.'
      : null

  async function handleCheckCompatibility() {
    if (busy || containers.length === 0) return
    setBusy(true)
    setError(null)
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
    })
  }

  async function handleExportConsolidated() {
    if (busy) return
    setExportingConsolidated(true)
    try {
      const assets = readyToExport.map((c) => {
        const state = compat[c.name]
        return {
          name: c.name,
          status: 'success',
          findings: state.findings,
          error: null,
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

  // Só ativos do Ambiente demonstrativo (container.is_demo, label
  // invariant.public-demo=true, ver demo_lab/) entram no lote de
  // publicação -- o backend já recusa qualquer outro
  // (not_demo_container_ids em routes/demo_snapshot.py), esse filtro
  // aqui é só UX: evita o admin selecionar um container operacional já
  // avaliado e tomar um 422 sem entender por quê. Não é filtrado pela
  // seleção viva (checkbox), que é um conceito só do "Executar
  // selecionados"/consolidado ao vivo -- publicar a demo é uma ação
  // separada, sobre tudo que existe de resultado no momento.
  const assessedContainers = containers.filter((c) => c.is_demo && compat[c.name]?.assessmentStatus === 'success')

  function buildDemoPayload() {
    return {
      containers: assessedContainers.map((c) => ({
        container_id: c.id,
        findings: compat[c.name].findings,
      })),
    }
  }

  async function handlePreviewDemo() {
    if (busy || assessedContainers.length === 0) return
    setPublishState('previewing')
    setPublishError(null)
    setRevokeMessage(null)
    try {
      const response = await apiFetch('/demo-snapshot/preview', {
        method: 'POST',
        body: JSON.stringify(buildDemoPayload()),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      setPublishPreview(body)
      setPublishState('preview-ready')
    } catch (err) {
      setPublishError(err.message)
      setPublishState('error')
    }
  }

  async function handleConfirmPublish() {
    setPublishState('publishing')
    setPublishError(null)
    try {
      const response = await apiFetch('/demo-snapshot/publish', {
        method: 'POST',
        body: JSON.stringify(buildDemoPayload()),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail?.message ?? `HTTP ${response.status}`)
      }
      setPublishState('published')
      setPublishPreview(null)
    } catch (err) {
      setPublishError(err.message)
      setPublishState('error')
    }
  }

  function cancelPreview() {
    setPublishState('idle')
    setPublishPreview(null)
    setPublishError(null)
  }

  async function handleRevokeDemo() {
    setRevokeMessage(null)
    // Limpa qualquer erro/prévia de uma tentativa de publicação anterior --
    // sem isso, um 413/422 de um "Publicar como demo" anterior ficava
    // empilhado na tela junto com a mensagem de sucesso do revoke, dando
    // a impressão de que a ação atual também tinha falhado.
    setPublishState('idle')
    setPublishError(null)
    setPublishPreview(null)
    try {
      const response = await apiFetch('/demo-snapshot/revoke', { method: 'POST' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      setRevokeMessage(
        body.status === 'revoked' ? 'Demo despublicada -- visitantes não veem mais nenhum snapshot.' : 'Não havia demo publicada.',
      )
    } catch (err) {
      setRevokeMessage(`Falha ao despublicar: ${err.message}`)
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
            Hosts Linux
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
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePreviewDemo}
                disabled={busy || assessedContainers.length === 0 || publishState === 'previewing'}
                title={
                  assessedContainers.length === 0
                    ? 'Avalie pelo menos um container do Ambiente demonstrativo antes de publicar a demo.'
                    : undefined
                }
              >
                {publishState === 'previewing' ? 'Gerando prévia…' : 'Publicar como demo'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleRevokeDemo}>
                Despublicar demo
              </button>
            </div>
          </div>

          {revokeMessage && <p className="hint">{revokeMessage}</p>}

          {publishState === 'preview-ready' && publishPreview && (
            <div className="demo-publish-panel">
              <p className="flow-guide__title">Prévia da demo pública</p>
              {publishPreview.ok ? (
                <>
                  <ul>
                    {publishPreview.containers.map((c) => (
                      <li key={c.name}>
                        <strong className="mono">{c.name}</strong> ({c.image}) — {c.findings.length} findings
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={handleConfirmPublish} disabled={publishState === 'publishing'}>
                      {publishState === 'publishing' ? 'Publicando…' : 'Confirmar publicação'}
                    </button>
                    <button type="button" className="link-btn" onClick={cancelPreview}>
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="error">
                    Não foi possível publicar a demo. Foram encontrados identificadores do ambiente real em campos do
                    snapshot.
                  </p>
                  <ul>
                    {publishPreview.issues.map((issue, i) => (
                      <li key={`issue-${i}`} className="hint">
                        {issue.field} — {issue.category}
                      </li>
                    ))}
                    {publishPreview.unverified_container_ids.map((id) => (
                      <li key={`unverified-${id}`} className="hint">
                        Container não confirmado no ambiente atual: {id}
                      </li>
                    ))}
                    {(publishPreview.not_demo_container_ids ?? []).map((id) => (
                      <li key={`not-demo-${id}`} className="hint">
                        Container não pertence ao Ambiente demonstrativo, não pode ser publicado: {id}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="link-btn" onClick={cancelPreview}>
                    Fechar
                  </button>
                </>
              )}
            </div>
          )}

          {publishState === 'published' && <p className="hint">Demo publicada com sucesso.</p>}
          {publishState === 'error' && publishError && (
            <p className="error" style={{ marginTop: '0.75rem' }}>
              {publishError}
            </p>
          )}

          <FlowGuide />

          {!loaded && <p className="hint">Carregando…</p>}
          {loaded && containers.length === 0 && <p className="hint">Nenhum container encontrado neste host.</p>}

          <ContainerSection
            heading="Ambiente demonstrativo"
            groupContainers={containers.filter((c) => c.is_demo)}
            checked={checked}
            compat={compat}
            busy={busy}
            onToggleSelected={toggleSelected}
            onRun={handleCardAction}
          />
          <ContainerSection
            heading="Ambiente operacional"
            groupContainers={containers.filter((c) => !c.is_demo)}
            checked={checked}
            compat={compat}
            busy={busy}
            onToggleSelected={toggleSelected}
            onRun={handleCardAction}
          />
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

// Sem sessão, /containers vira a vitrine pública do produto (Home.jsx's
// "Explorar demo") -- lê só GET /demo-snapshot (público, já sanitizado
// pelo backend) e GET /demo-snapshot/report (também público, PDF gerado
// a partir do snapshot ativo). Nunca chama /api/containers, /api/assess
// nem /api/reports/pdf -- essas exigem sessão agora, de propósito
// (routes/assess.py, routes/reports.py). Sem checkbox, sem seleção, sem
// ação de avaliação -- só leitura do que o admin já publicou.
function VisitorContainers({ apiFetch, onRequestLogin }) {
  const [containers, setContainers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  // null = lista de containers. Otherwise:
  //   {kind:'assess-result', container, findings}
  //   {kind:'finding-detail', container, findings, finding}
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    apiFetch('/demo-snapshot')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((body) => setContainers(body.containers))
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openReportUrl(kind, target) {
    const params = new URLSearchParams({ kind })
    if (target) params.set('target', target)
    window.open(`${API_BASE}/demo-snapshot/report?${params.toString()}`, '_blank', 'noopener')
  }

  return (
    <div className="page">
      <header className="site-header">
        <div className="brand">INVARIANT</div>
        <div className="session-info">
          <a href="/endpoints" className="link-btn">
            Hosts Linux
          </a>
          <button type="button" className="btn-secondary" onClick={onRequestLogin}>
            Entrar
          </button>
        </div>
      </header>

      <p className="demo-banner">
        Ambiente demonstrativo — avaliações reais executadas contra sistemas preparados exclusivamente para
        demonstração.
      </p>

      {error && (
        <p className="error" style={{ marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      {!detail && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Containers ({containers.length})</h2>
            {containers.length >= MIN_CONSOLIDATED_TARGETS && (
              <button type="button" className="btn-secondary" onClick={() => openReportUrl('consolidated')}>
                Ver relatório consolidado
              </button>
            )}
          </div>

          {!loaded && <p className="hint">Carregando…</p>}
          {loaded && containers.length === 0 && <p className="hint">Nenhuma demo publicada no momento.</p>}

          <div className="card-grid" style={{ marginTop: '1rem' }}>
            {containers.map((container) => (
              <div key={container.name} className="target-card">
                <div className="target-card__title mono">{container.name}</div>
                <div className="hint" style={{ marginBottom: '0.5rem' }}>{container.image}</div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setDetail({ kind: 'assess-result', container, findings: container.findings })}
                >
                  Ver relatório →
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {detail?.kind === 'assess-result' && (
        <FindingsReport
          title={detail.container.name}
          findings={detail.findings}
          containerImage={detail.container.image}
          onExportPdf={(kind) => openReportUrl(kind, detail.container.name)}
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
