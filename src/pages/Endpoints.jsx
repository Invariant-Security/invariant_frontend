import { useEffect, useRef, useState } from 'react'
import { parseEndpointsCsv } from '../csvImport.js'
import { STATUS_LABEL, summarizeFailedProbe } from './discoveryEvidence.js'
import { FindingsReport, FindingDetail } from '../findings.jsx'
import { formatOsDisplayFromParts, formatTargetLabel } from '../targetLabel.js'
import './Console.css'
import './Findings.css'

// Import de CSV: sem lib nova de propósito (a direção futura é evoluir
// isso pra algo com IA, onde qualquer formato acaba virando texto antes de
// ser interpretado -- não vale investir agora num parser binário de
// XLS/XLSX pra descartar depois). Limites simples abaixo evitam um
// arquivo gigante virando centenas de requests/inserts numa importação só
// (e abuso acidental na demo) -- espelham MAX_BULK_ENDPOINTS do backend.
const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024
const MAX_IMPORT_ROWS = 500

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

export default function Endpoints({ apiFetch, username, onLogout }) {
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

          <h2>Hosts Linux ({endpoints.length})</h2>
          {!loaded && <p className="hint">Carregando…</p>}
          {loaded && endpoints.length === 0 && (
            <p className="hint">Nenhum host ainda -- adicione um acima e clique em Descobrir pra identificá-lo.</p>
          )}
          <div className="card-grid">
            {/* Hosts já identificados de verdade (classification real,
                não "unknown"/vazio) sobem pro topo -- sort é estável, então
                a ordem relativa dentro de cada grupo continua a mesma. Não
                é um agrupamento visual novo, só uma ordenação -- refatorar
                pra seções separadas fica pra outra rodada. */}
            {[...endpoints]
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
                onDiscover={handleDiscover}
                onDelete={handleDelete}
                onViewResults={handleViewResults}
                onRunAssessment={handleOpenAssessForm}
              />
            ))}
          </div>
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
