import { useEffect, useRef, useState } from 'react'
import { parseEndpointsCsv } from '../csvImport.js'
import { STATUS_LABEL, summarizeFailedProbe } from './discoveryEvidence.js'
import { FindingsReport, FindingDetail } from '../findings.jsx'
import { formatOsDisplayFromParts, formatTargetLabel } from '../targetLabel.js'
import './Console.css'
import './Findings.css'

// Overridable via VITE_API_BASE, same convention as Home.jsx/Demo.jsx --
// VisitorEndpoints usa isso pra montar link direto pro GET público
// /demo-host-snapshot/report (fora do apiFetch normal, porque é um link
// de navegador que abre o PDF, não uma chamada fetch).
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

// Import de CSV: sem lib nova de propósito (a direção futura é evoluir
// isso pra algo com IA, onde qualquer formato acaba virando texto antes de
// ser interpretado -- não vale investir agora num parser binário de
// XLS/XLSX pra descartar depois). Limites simples abaixo evitam um
// arquivo gigante virando centenas de requests/inserts numa importação só
// (e abuso acidental na demo) -- espelham MAX_BULK_ENDPOINTS do backend.
const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024
const MAX_IMPORT_ROWS = 500
// A consolidated report compares prevalence/compliance across a fleet --
// with a single asset there's nothing to compare, so VisitorEndpoints'
// export button stays hidden below this count even after a demo publish.
const MIN_CONSOLIDATED_TARGETS = 2

// Escopo desta tela: cadastrar endpoints (IP único ou CIDR), disparar a
// identificação de rede (windows/linux/docker/waf/firewall/vmware, via
// invariant_discovery -- POST /endpoints/{id}/discover), depois um pré-flight
// barato (POST /endpoints/{id}/check -- identifica target_type/hostname/OS
// antes de comprometer um assessment real, mesma ideia do "Check
// compatibility" de Containers.jsx) e por fim o assessment CIS real via SSH
// (POST /endpoints/{id}/assess). "Check" e "Run assessment" reaproveitam o
// mesmo formulário de credenciais -- SSH não tem pré-flight sem credencial
// como o docker-exec tem.

function ClassificationBadge({ classification, confidence }) {
  if (!classification) return <span className="badge badge--unknown">não escaneado</span>
  const pct = Math.round(confidence * 100)
  return (
    <span className={`badge badge--${classification}`}>
      {classification} {confidence != null && `(${pct}%)`}
    </span>
  )
}

function EndpointCard({ endpoint, checkResult, discovering, onDiscover, onDelete, onViewResults, onRunAssessment }) {
  const targetLabel = checkResult?.testable
    ? formatTargetLabel('linux_host', formatOsDisplayFromParts(checkResult.os_id, checkResult.os_version_id), {
        primaryIp: checkResult.primary_ip,
      })
    : null
  return (
    <div className="target-card">
      <div className="target-card__title mono">{endpoint.address}</div>
      {endpoint.label && <div className="hint" style={{ marginBottom: '0.5rem' }}>{endpoint.label}</div>}
      {targetLabel && <div className="hint" style={{ marginBottom: '0.5rem' }}>{targetLabel}</div>}
      <div style={{ marginBottom: '0.75rem' }}>
        <ClassificationBadge classification={endpoint.classification} confidence={endpoint.confidence} />
      </div>
      {endpoint.tags?.length > 0 && (
        <div className="card__row">
          <span>Tags</span>
          <strong>{endpoint.tags.join(', ')}</strong>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="link-btn" onClick={() => onDiscover(endpoint.id)} disabled={discovering}>
          {discovering ? 'Escaneando…' : 'Descobrir →'}
        </button>
        {endpoint.classification && (
          <button type="button" className="link-btn" onClick={() => onViewResults(endpoint)}>
            Ver evidências →
          </button>
        )}
        {endpoint.classification && (
          <button type="button" className="link-btn" onClick={() => onRunAssessment(endpoint)}>
            Executar avaliação →
          </button>
        )}
        <button type="button" className="link-btn" onClick={() => onDelete(endpoint.id)} style={{ color: 'var(--red)' }}>
          Excluir
        </button>
      </div>
    </div>
  )
}

function FailedProbeEvidence({ evidence }) {
  const summary = summarizeFailedProbe(evidence)
  if (!summary) return null
  const { headline, total, openCount, counts, attempts } = summary
  return (
    <li className="evidence-chain__step">
      <div className="evidence-chain__label">Por que não identificamos um serviço</div>
      <p className="hint" style={{ margin: '0.25rem 0' }}>{headline}</p>
      <p className="hint" style={{ margin: '0.25rem 0' }}>
        {total} portas testadas · {openCount} abertas
        {counts.timeout ? ` · ${counts.timeout} expiraram por tempo limite` : ''}
        {counts.refused ? ` · ${counts.refused} recusaram conexão` : ''}
        {counts.network_unreachable ? ` · ${counts.network_unreachable} sem rota` : ''}
        {counts.host_unreachable ? ` · ${counts.host_unreachable} host inalcançável` : ''}
        {counts.error ? ` · ${counts.error} erro na tentativa` : ''}
      </p>
      <details>
        <summary className="hint" style={{ cursor: 'pointer' }}>Ver detalhes</summary>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
          {attempts.map((a) => (
            <li key={a.port} className="mono">
              Porta {a.port} — {STATUS_LABEL[a.status] ?? 'Erro na tentativa'}
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

function ResultsDetail({ endpoint, results, onBack }) {
  return (
    <section>
      <button type="button" className="link-btn" onClick={onBack}>
        ← Voltar
      </button>
      <h2 className="mono">{endpoint.address}</h2>
      {results.length === 0 && <p className="hint">Nenhum resultado ainda -- rode Descobrir primeiro.</p>}
      {results.map((r) => (
        <div key={r.ip} style={{ marginBottom: '1.5rem' }}>
          <div className="mono" style={{ marginBottom: '0.5rem' }}>
            {r.ip} <ClassificationBadge classification={r.classification} confidence={r.confidence} />
          </div>
          <ol className="evidence-chain">
            <li className="evidence-chain__step">
              <div className="evidence-chain__label">Portas abertas</div>
              <div className="mono">{r.evidence.open_ports?.join(', ') || '(nenhuma respondeu)'}</div>
            </li>
            {Object.entries(r.evidence.banners || {}).map(([port, banner]) => (
              <li key={port} className="evidence-chain__step">
                <div className="evidence-chain__label">Sinal na porta {port}</div>
                <div className="mono">{banner}</div>
              </li>
            ))}
            <FailedProbeEvidence evidence={r.evidence} />
            <li className="evidence-chain__step">
              <div className="evidence-chain__label">Escaneado em</div>
              <div className="mono">{new Date(r.scanned_at).toLocaleString()}</div>
            </li>
          </ol>
        </div>
      ))}
    </section>
  )
}

function AssessForm({
  endpoint,
  port,
  username,
  authMethod,
  keyMaterial,
  password,
  assessing,
  checking,
  checkResult,
  onPortChange,
  onUsernameChange,
  onAuthMethodChange,
  onKeyMaterialChange,
  onPasswordChange,
  onSubmit,
  onCheck,
  onBack,
}) {
  const targetLabel = checkResult?.testable
    ? formatTargetLabel('linux_host', formatOsDisplayFromParts(checkResult.os_id, checkResult.os_version_id), {
        primaryIp: checkResult.primary_ip,
      })
    : null
  return (
    <section>
      <button type="button" className="link-btn" onClick={onBack}>
        ← Voltar
      </button>
      <h2 className="mono">Executar avaliação — {endpoint.address}</h2>
      <p className="hint">As credenciais são usadas uma vez nesta requisição e nunca armazenadas.</p>
      {checkResult && (
        <p className={`hint ${checkResult.testable ? '' : 'error'}`} style={{ marginBottom: '1rem' }}>
          {checkResult.testable ? targetLabel : `Não testável: ${checkResult.reason ?? 'motivo desconhecido'}`}
        </p>
      )}
      <form className="endpoint-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="assess-port">Porta</label>
          <input
            id="assess-port"
            type="number"
            value={port}
            onChange={(e) => onPortChange(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="assess-username">Usuário</label>
          <input id="assess-username" value={username} onChange={(e) => onUsernameChange(e.target.value)} required />
        </div>
        <div className="field">
          <label>Método de autenticação</label>
          <div className="toggle-group">
            <button
              type="button"
              className={`toggle-group__btn ${authMethod === 'key' ? 'toggle-group__btn--active' : ''}`}
              onClick={() => onAuthMethodChange('key')}
            >
              Chave SSH
            </button>
            <button
              type="button"
              className={`toggle-group__btn ${authMethod === 'password' ? 'toggle-group__btn--active' : ''}`}
              onClick={() => onAuthMethodChange('password')}
            >
              Senha
            </button>
          </div>
        </div>
        {authMethod === 'key' ? (
          <div className="field">
            <label htmlFor="assess-key">Chave privada</label>
            <textarea
              id="assess-key"
              className="mono"
              rows={6}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              value={keyMaterial}
              onChange={(e) => onKeyMaterialChange(e.target.value)}
              required
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="assess-password">Senha</label>
            <input
              id="assess-password"
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto', padding: '0.55rem 1.2rem' }}
            onClick={onCheck}
            disabled={assessing || checking}
          >
            {checking ? 'Verificando…' : 'Verificar'}
          </button>
          <button
            type="submit"
            className="btn-primary"
            style={{ width: 'auto', padding: '0.55rem 1.2rem' }}
            disabled={assessing || checking}
          >
            {assessing ? 'Executando…' : 'Executar avaliação'}
          </button>
        </div>
      </form>
    </section>
  )
}

function ImportSummary({ results, onDismiss }) {
  const created = results.filter((r) => r.status === 'created')
  const errors = results.filter((r) => r.status === 'error')
  return (
    <div className="hint" style={{ marginBottom: '1.5rem' }}>
      <p style={{ marginBottom: errors.length > 0 ? '0.5rem' : 0 }}>
        <strong>Importação concluída</strong>: {created.length} adicionados
        {errors.length > 0 ? ` · ${errors.length} não adicionados` : ''}
      </p>
      {errors.length > 0 && (
        <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.2rem' }}>
          {errors.map((r) => (
            <li key={r.row}>
              Linha {r.row} ({r.address}): {r.detail}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="link-btn" onClick={onDismiss}>
        Fechar
      </button>
    </div>
  )
}

// Um bloco de renderização por ambiente (demonstrativo/operacional) --
// mesma lógica de "identificados sobem pro topo" que antes era calculada
// uma vez só pra todos os endpoints, agora reaplicada a cada subconjunto
// (endpoint.is_demo) antes de renderizar. EndpointCard e o fluxo de
// Descobrir/Check/avaliação são idênticos nos dois ambientes -- só
// "Publicar como demo" trata os dois de forma diferente (ver
// assessedEndpoints em AdminEndpoints).
function EndpointSection({ heading, groupEndpoints, checkResults, discoveringId, onDiscover, onDelete, onViewResults, onRunAssessment }) {
  if (groupEndpoints.length === 0) return null

  return (
    <section style={{ marginTop: '2rem' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>
        {heading} ({groupEndpoints.length})
      </h3>
      <div className="card-grid">
        {[...groupEndpoints]
          .sort((a, b) => {
            const aIdentified = a.classification && a.classification !== 'unknown' ? 0 : 1
            const bIdentified = b.classification && b.classification !== 'unknown' ? 0 : 1
            return aIdentified - bIdentified
          })
          .map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              checkResult={checkResults[endpoint.id]}
              discovering={discoveringId === endpoint.id}
              onDiscover={onDiscover}
              onDelete={onDelete}
              onViewResults={onViewResults}
              onRunAssessment={onRunAssessment}
            />
          ))}
      </div>
    </section>
  )
}

// /endpoints é o outro ponto de entrada da demo pública (Home.jsx's
// "Explorar demo", junto com /containers) -- sem sessão, App.jsx
// renderiza <VisitorEndpoints> em vez deste componente (ver seu próprio
// comentário mais abaixo). Isso aqui é só o console autenticado: hosts
// reais, descoberta, checagem, assessment SSH, relatórios ao vivo, e o
// painel de publicação da demo.
export default function Endpoints({ apiFetch, username, onLogout, isVisitor = false, onRequestLogin }) {
  if (isVisitor) {
    return <VisitorEndpoints apiFetch={apiFetch} onRequestLogin={onRequestLogin} />
  }
  return <AdminEndpoints apiFetch={apiFetch} username={username} onLogout={onLogout} />
}

function AdminEndpoints({ apiFetch, username, onLogout }) {
  const [endpoints, setEndpoints] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [newAddress, setNewAddress] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [discoveringId, setDiscoveringId] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)
  // null = endpoint list. Otherwise a tagged union:
  //   {kind:'discovery', endpoint, results}
  //   {kind:'assess-form', endpoint}
  //   {kind:'assess-result', endpoint, findings}
  //   {kind:'finding-detail', endpoint, findings, finding}
  const [detail, setDetail] = useState(null)
  const [assessPort, setAssessPort] = useState(22)
  const [assessUsername, setAssessUsername] = useState('')
  const [assessAuthMethod, setAssessAuthMethod] = useState('key')
  const [assessKeyMaterial, setAssessKeyMaterial] = useState('')
  const [assessPassword, setAssessPassword] = useState('')
  const [assessing, setAssessing] = useState(false)
  const [checking, setChecking] = useState(false)
  // endpoint id -> last /check response -- lifted to the parent (not just
  // detail.checkResult) so a card in the list view can keep showing the
  // label after the form is closed, same idea as Containers.jsx's `compat`.
  const [checkResults, setCheckResults] = useState({})
  // endpoint id -> last successful /assess findings -- feeds
  // assessedEndpoints below (Containers.jsx tracks this in `compat`
  // instead; Endpoints.jsx has no equivalent per-endpoint state before
  // this, since assess results previously only ever lived transiently in
  // `detail`).
  const [assessResults, setAssessResults] = useState({})
  // idle | previewing | preview-ready | publishing | published | error
  const [publishState, setPublishState] = useState('idle')
  const [publishPreview, setPublishPreview] = useState(null)
  const [publishError, setPublishError] = useState(null)
  const [revokeMessage, setRevokeMessage] = useState(null)

  async function loadEndpoints() {
    const response = await apiFetch('/api/endpoints')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    setEndpoints(await response.json())
  }

  useEffect(() => {
    loadEndpoints()
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAddEndpoint(e) {
    e.preventDefault()
    setError(null)
    try {
      const response = await apiFetch('/api/endpoints', {
        method: 'POST',
        body: JSON.stringify({ address: newAddress, label: newLabel || null, tags: [] }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${response.status}`)
      }
      setNewAddress('')
      setNewLabel('')
      await loadEndpoints()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleImportButtonClick() {
    fileInputRef.current?.click()
  }

  async function handleImportFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite selecionar o mesmo arquivo de novo depois
    if (!file) return

    setError(null)
    setImportResult(null)

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError('O arquivo contém mais endpoints do que o limite permitido.')
      return
    }

    const text = await file.text()
    const rows = parseEndpointsCsv(text)
    if (rows.length > MAX_IMPORT_ROWS) {
      setError('O arquivo contém mais endpoints do que o limite permitido.')
      return
    }
    if (rows.length === 0) {
      setError('Nenhum endereço válido encontrado no arquivo.')
      return
    }

    setImporting(true)
    try {
      const response = await apiFetch('/api/endpoints/bulk', {
        method: 'POST',
        body: JSON.stringify(rows),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${response.status}`)
      }
      setImportResult(await response.json())
      await loadEndpoints()
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/api/endpoints/${id}`, { method: 'DELETE' })
      await loadEndpoints()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDiscover(id) {
    setDiscoveringId(id)
    setError(null)
    try {
      const response = await apiFetch(`/api/endpoints/${id}/discover`, { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${response.status}`)
      }
      await loadEndpoints()
    } catch (err) {
      setError(err.message)
    } finally {
      setDiscoveringId(null)
    }
  }

  async function handleViewResults(endpoint) {
    try {
      const response = await apiFetch(`/api/endpoints/${endpoint.id}/results`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setDetail({ kind: 'discovery', endpoint, results: await response.json() })
    } catch (err) {
      setError(err.message)
    }
  }

  function handleOpenAssessForm(endpoint) {
    setAssessPort(22)
    setAssessUsername('')
    setAssessAuthMethod('key')
    setAssessKeyMaterial('')
    setAssessPassword('')
    setError(null)
    setDetail({ kind: 'assess-form', endpoint, checkResult: checkResults[endpoint.id] ?? null })
  }

  async function handleCheck(e) {
    e.preventDefault()
    setError(null)
    setChecking(true)
    const endpoint = detail.endpoint
    try {
      const response = await apiFetch(`/api/endpoints/${endpoint.id}/check`, {
        method: 'POST',
        body: JSON.stringify({
          port: Number(assessPort) || 22,
          username: assessUsername,
          auth_method: assessAuthMethod,
          key_material: assessAuthMethod === 'key' ? assessKeyMaterial : null,
          password: assessAuthMethod === 'password' ? assessPassword : null,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${response.status}`)
      }
      const result = await response.json()
      setCheckResults((prev) => ({ ...prev, [endpoint.id]: result }))
      setDetail((prev) => (prev?.kind === 'assess-form' ? { ...prev, checkResult: result } : prev))
    } catch (err) {
      setError(err.message)
    } finally {
      // Same "used once, never retained" posture as the assess submit below.
      setAssessKeyMaterial('')
      setAssessPassword('')
      setChecking(false)
    }
  }

  async function handleSubmitAssess(e) {
    e.preventDefault()
    setError(null)
    setAssessing(true)
    const endpoint = detail.endpoint
    try {
      const response = await apiFetch(`/api/endpoints/${endpoint.id}/assess`, {
        method: 'POST',
        body: JSON.stringify({
          port: Number(assessPort) || 22,
          username: assessUsername,
          auth_method: assessAuthMethod,
          key_material: assessAuthMethod === 'key' ? assessKeyMaterial : null,
          password: assessAuthMethod === 'password' ? assessPassword : null,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${response.status}`)
      }
      const findings = await response.json()
      setAssessResults((prev) => ({ ...prev, [endpoint.id]: findings }))
      // primary_ip is always the endpoint's own stored address (known
      // regardless of whether Check ran first); hostname only exists if
      // Check was run in this same form session -- never invented otherwise.
      setDetail({
        kind: 'assess-result',
        endpoint,
        findings,
        hostname: detail.checkResult?.hostname ?? null,
        primaryIp: endpoint.address,
      })
    } catch (err) {
      setError(err.message)
      // stays on 'assess-form' so port/username don't need to be retyped
    } finally {
      setAssessKeyMaterial('')
      setAssessPassword('')
      setAssessing(false)
    }
  }

  // Só hosts do Ambiente demonstrativo (endpoint.is_demo, faixa
  // 10.89.77.0/24 do Demo Lab de hosts Linux, ver demo_lab/) com
  // avaliação real já rodada entram no lote de publicação -- o backend já
  // recusa qualquer outro (not_demo_endpoint_ids em
  // routes/demo_host_snapshot.py), esse filtro aqui é só UX: evita o
  // admin selecionar um host operacional já avaliado e tomar um 422 sem
  // entender por quê.
  const assessedEndpoints = endpoints.filter((e) => e.is_demo && assessResults[e.id])

  function buildDemoPayload() {
    return {
      hosts: assessedEndpoints.map((e) => ({
        endpoint_id: e.id,
        findings: assessResults[e.id],
      })),
    }
  }

  // Só via /api/demo-host-snapshot/... aqui, nunca o path bare -- ao
  // contrário de Containers.jsx (que reaproveita o mesmo /demo-snapshot
  // bare pra GET público e POST admin, protegido só pela sessão dentro
  // do FastAPI), o nginx de teste/produção só expõe location = pros dois
  // GETs bare de host (ver demo_lab/docs/networking.md e o proxy repo) --
  // POST preview/publish/revoke só existe atrás de /api/, que passa pela
  // location genérica /api/ (rewrite -> backend) e por require_admin_session.
  async function handlePreviewDemo() {
    if (assessedEndpoints.length === 0) return
    setPublishState('previewing')
    setPublishError(null)
    setRevokeMessage(null)
    try {
      const response = await apiFetch('/api/demo-host-snapshot/preview', {
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
      const response = await apiFetch('/api/demo-host-snapshot/publish', {
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
    // sem isso, um 422 de um "Publicar como demo" anterior ficava
    // empilhado na tela junto com a mensagem de sucesso do revoke (mesmo
    // bug já corrigido em Containers.jsx).
    setPublishState('idle')
    setPublishError(null)
    setPublishPreview(null)
    try {
      const response = await apiFetch('/api/demo-host-snapshot/revoke', { method: 'POST' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      setRevokeMessage(
        body.status === 'revoked' ? 'Demo despublicada -- visitantes não veem mais nenhum snapshot.' : 'Não havia demo publicada.',
      )
    } catch (err) {
      setRevokeMessage(`Falha ao despublicar: ${err.message}`)
    }
  }

  return (
    <div className="page">
      <header className="site-header">
        <div className="brand">INVARIANT</div>
        <div className="session-info">
          <a href="/containers" className="link-btn">
            Containers
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>Adicionar host Linux</h2>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                hidden
                onChange={handleImportFileSelected}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleImportButtonClick}
                disabled={importing}
              >
                {importing ? 'Importando…' : 'Importar CSV'}
              </button>
            </div>
          </div>
          <form className="endpoint-form" onSubmit={handleAddEndpoint}>
            <div className="field">
              <label htmlFor="address">IP ou faixa CIDR</label>
              <input
                id="address"
                className="mono"
                placeholder="10.0.0.5 ou 10.0.0.0/24"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="label">Nome (opcional)</label>
              <input id="label" placeholder="rede do escritório" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.55rem 1.2rem' }}>
              Adicionar
            </button>
          </form>

          {importResult && <ImportSummary results={importResult} onDismiss={() => setImportResult(null)} />}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>Hosts Linux ({endpoints.length})</h2>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePreviewDemo}
                disabled={assessedEndpoints.length === 0 || publishState === 'previewing'}
                title={
                  assessedEndpoints.length === 0
                    ? 'Avalie pelo menos um host do Ambiente demonstrativo antes de publicar a demo.'
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
                    {publishPreview.hosts.map((h) => (
                      <li key={h.name}>
                        <strong className="mono">{h.name}</strong> ({h.address}) — {h.findings.length} findings
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
              ) : publishPreview.redaction_issues?.length > 0 ? (
                <>
                  <p className="error">
                    Não foi possível publicar a demo: a própria sanitização falhou -- um identificador real do
                    Demo Lab sobreviveu num campo do snapshot depois da substituição pelo alias.
                  </p>
                  <ul>
                    {publishPreview.redaction_issues.map((issue, i) => (
                      <li key={`redaction-${i}`} className="hint">
                        {issue.field} — {issue.category}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="link-btn" onClick={cancelPreview}>
                    Fechar
                  </button>
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
                    {publishPreview.unverified_endpoint_ids.map((id) => (
                      <li key={`unverified-${id}`} className="hint">
                        Host não confirmado no ambiente atual: {id}
                      </li>
                    ))}
                    {(publishPreview.not_demo_endpoint_ids ?? []).map((id) => (
                      <li key={`not-demo-${id}`} className="hint">
                        Host não pertence ao Ambiente demonstrativo, não pode ser publicado: {id}
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

          {!loaded && <p className="hint">Carregando…</p>}
          {loaded && endpoints.length === 0 && (
            <p className="hint">Nenhum host ainda -- adicione um acima e clique em Descobrir pra identificá-lo.</p>
          )}

          <EndpointSection
            heading="Ambiente demonstrativo"
            groupEndpoints={endpoints.filter((e) => e.is_demo)}
            checkResults={checkResults}
            discoveringId={discoveringId}
            onDiscover={handleDiscover}
            onDelete={handleDelete}
            onViewResults={handleViewResults}
            onRunAssessment={handleOpenAssessForm}
          />
          <EndpointSection
            heading="Ambiente operacional"
            groupEndpoints={endpoints.filter((e) => !e.is_demo)}
            checkResults={checkResults}
            discoveringId={discoveringId}
            onDiscover={handleDiscover}
            onDelete={handleDelete}
            onViewResults={handleViewResults}
            onRunAssessment={handleOpenAssessForm}
          />
        </>
      )}

      {detail?.kind === 'discovery' && (
        <ResultsDetail endpoint={detail.endpoint} results={detail.results} onBack={() => setDetail(null)} />
      )}
      {detail?.kind === 'assess-form' && (
        <AssessForm
          endpoint={detail.endpoint}
          port={assessPort}
          username={assessUsername}
          authMethod={assessAuthMethod}
          keyMaterial={assessKeyMaterial}
          password={assessPassword}
          assessing={assessing}
          checking={checking}
          checkResult={detail.checkResult}
          onPortChange={setAssessPort}
          onUsernameChange={setAssessUsername}
          onAuthMethodChange={setAssessAuthMethod}
          onKeyMaterialChange={setAssessKeyMaterial}
          onPasswordChange={setAssessPassword}
          onSubmit={handleSubmitAssess}
          onCheck={handleCheck}
          onBack={() => setDetail(null)}
        />
      )}
      {detail?.kind === 'assess-result' && (
        <FindingsReport
          title={detail.endpoint.address}
          findings={detail.findings}
          apiFetch={apiFetch}
          hostname={detail.hostname}
          primaryIp={detail.primaryIp}
          onSelectFinding={(finding) =>
            setDetail({ kind: 'finding-detail', endpoint: detail.endpoint, findings: detail.findings, finding })
          }
          onBack={() => setDetail(null)}
        />
      )}
      {detail?.kind === 'finding-detail' && (
        <FindingDetail
          finding={detail.finding}
          onBack={() => setDetail({ kind: 'assess-result', endpoint: detail.endpoint, findings: detail.findings })}
        />
      )}
    </div>
  )
}

// Sem sessão, /endpoints vira a vitrine pública do LXD Linux Demo Lab
// (Home.jsx's "Explorar demo") -- lê só GET /demo-host-snapshot (público,
// já sanitizado pelo backend) e GET /demo-host-snapshot/report (também
// público, PDF gerado a partir do snapshot ativo). Nunca chama
// /api/endpoints, /api/endpoints/{id}/assess nem /api/reports/pdf --
// essas exigem sessão agora, de propósito (routes/endpoints.py,
// routes/reports.py). Sem formulário de credenciais, sem
// Descobrir/Check/avaliação -- só leitura do que o admin já publicou.
function VisitorEndpoints({ apiFetch, onRequestLogin }) {
  const [hosts, setHosts] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  // null = lista de hosts. Otherwise:
  //   {kind:'assess-result', host, findings}
  //   {kind:'finding-detail', host, findings, finding}
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    apiFetch('/demo-host-snapshot')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((body) => setHosts(body.hosts))
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openReportUrl(kind, target) {
    const params = new URLSearchParams({ kind })
    if (target) params.set('target', target)
    window.open(`${API_BASE}/demo-host-snapshot/report?${params.toString()}`, '_blank', 'noopener')
  }

  return (
    <div className="page">
      <header className="site-header">
        <div className="brand">INVARIANT</div>
        <div className="session-info">
          <a href="/containers" className="link-btn">
            Containers
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
            <h2 style={{ margin: 0 }}>Hosts Linux ({hosts.length})</h2>
            {hosts.length >= MIN_CONSOLIDATED_TARGETS && (
              <button type="button" className="btn-secondary" onClick={() => openReportUrl('consolidated')}>
                Ver relatório consolidado
              </button>
            )}
          </div>

          {!loaded && <p className="hint">Carregando…</p>}
          {loaded && hosts.length === 0 && <p className="hint">Nenhuma demo publicada no momento.</p>}

          <div className="card-grid" style={{ marginTop: '1rem' }}>
            {hosts.map((host) => (
              <div key={host.name} className="target-card">
                <div className="target-card__title mono">{host.name}</div>
                <div className="hint" style={{ marginBottom: '0.5rem' }}>{host.address}</div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setDetail({ kind: 'assess-result', host, findings: host.findings })}
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
          title={detail.host.name}
          findings={detail.findings}
          hostname={detail.host.name}
          primaryIp={detail.host.address}
          onExportPdf={(kind) => openReportUrl(kind, detail.host.name)}
          onSelectFinding={(finding) =>
            setDetail({ kind: 'finding-detail', host: detail.host, findings: detail.findings, finding })
          }
          onBack={() => setDetail(null)}
        />
      )}
      {detail?.kind === 'finding-detail' && (
        <FindingDetail
          finding={detail.finding}
          onBack={() => setDetail({ kind: 'assess-result', host: detail.host, findings: detail.findings })}
        />
      )}
    </div>
  )
}
