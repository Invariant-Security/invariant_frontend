import { useEffect, useState } from 'react'
import { byLevel, FindingListItem, FindingDetail } from '../findings.jsx'
import './Console.css'
import './Findings.css'

// Escopo desta tela: cadastrar endpoints (IP único ou CIDR), disparar a
// identificação (windows/linux/docker/waf/firewall/vmware) e rodar um
// assessment CIS real via SSH contra o que foi descoberto (POST
// /endpoints/{id}/assess, invariant_api/routes/endpoints.py).

function ClassificationBadge({ classification, confidence }) {
  if (!classification) return <span className="badge badge--unknown">not scanned</span>
  const pct = Math.round(confidence * 100)
  return (
    <span className={`badge badge--${classification}`}>
      {classification} {confidence != null && `(${pct}%)`}
    </span>
  )
}

function EndpointCard({ endpoint, discovering, onDiscover, onDelete, onViewResults, onRunAssessment }) {
  return (
    <div className="target-card">
      <div className="target-card__title mono">{endpoint.address}</div>
      {endpoint.label && <div className="hint" style={{ marginBottom: '0.5rem' }}>{endpoint.label}</div>}
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
          {discovering ? 'Scanning…' : 'Discover →'}
        </button>
        {endpoint.classification && (
          <button type="button" className="link-btn" onClick={() => onViewResults(endpoint)}>
            View evidence →
          </button>
        )}
        {endpoint.classification && (
          <button type="button" className="link-btn" onClick={() => onRunAssessment(endpoint)}>
            Run assessment →
          </button>
        )}
        <button type="button" className="link-btn" onClick={() => onDelete(endpoint.id)} style={{ color: 'var(--red)' }}>
          Delete
        </button>
      </div>
    </div>
  )
}

function ResultsDetail({ endpoint, results, onBack }) {
  return (
    <section>
      <button type="button" className="link-btn" onClick={onBack}>
        ← Back
      </button>
      <h2 className="mono">{endpoint.address}</h2>
      {results.length === 0 && <p className="hint">No results yet -- run Discover first.</p>}
      {results.map((r) => (
        <div key={r.ip} style={{ marginBottom: '1.5rem' }}>
          <div className="mono" style={{ marginBottom: '0.5rem' }}>
            {r.ip} <ClassificationBadge classification={r.classification} confidence={r.confidence} />
          </div>
          <ol className="evidence-chain">
            <li className="evidence-chain__step">
              <div className="evidence-chain__label">Open ports</div>
              <div className="mono">{r.evidence.open_ports?.join(', ') || '(none responded)'}</div>
            </li>
            {Object.entries(r.evidence.banners || {}).map(([port, banner]) => (
              <li key={port} className="evidence-chain__step">
                <div className="evidence-chain__label">Signal on port {port}</div>
                <div className="mono">{banner}</div>
              </li>
            ))}
            <li className="evidence-chain__step">
              <div className="evidence-chain__label">Scanned at</div>
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
  onPortChange,
  onUsernameChange,
  onAuthMethodChange,
  onKeyMaterialChange,
  onPasswordChange,
  onSubmit,
  onBack,
}) {
  return (
    <section>
      <button type="button" className="link-btn" onClick={onBack}>
        ← Back
      </button>
      <h2 className="mono">Run assessment — {endpoint.address}</h2>
      <p className="hint">Credentials are used once for this request and never stored.</p>
      <form className="endpoint-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="assess-port">Port</label>
          <input
            id="assess-port"
            type="number"
            value={port}
            onChange={(e) => onPortChange(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="assess-username">Username</label>
          <input id="assess-username" value={username} onChange={(e) => onUsernameChange(e.target.value)} required />
        </div>
        <div className="field">
          <label>Auth method</label>
          <div className="toggle-group">
            <button
              type="button"
              className={`toggle-group__btn ${authMethod === 'key' ? 'toggle-group__btn--active' : ''}`}
              onClick={() => onAuthMethodChange('key')}
            >
              SSH key
            </button>
            <button
              type="button"
              className={`toggle-group__btn ${authMethod === 'password' ? 'toggle-group__btn--active' : ''}`}
              onClick={() => onAuthMethodChange('password')}
            >
              Password
            </button>
          </div>
        </div>
        {authMethod === 'key' ? (
          <div className="field">
            <label htmlFor="assess-key">Private key</label>
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
            <label htmlFor="assess-password">Password</label>
            <input
              id="assess-password"
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
            />
          </div>
        )}
        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.55rem 1.2rem' }} disabled={assessing}>
          {assessing ? 'Running…' : 'Run assessment'}
        </button>
      </form>
    </section>
  )
}

function AssessResult({ endpoint, findings, onSelectFinding, onBack }) {
  const failed = findings.filter((f) => f.status === 'FAIL')
  const passed = findings.filter((f) => f.status === 'PASS')
  return (
    <section>
      <button type="button" className="link-btn" onClick={onBack}>
        ← Back
      </button>
      <h2 className="mono">{endpoint.address}</h2>
      <div className="card__counts">
        <span className="badge badge--pass">{passed.length} PASS</span>
        <span className="badge badge--fail">{failed.length} FAIL</span>
      </div>
      {failed.length > 0 && (
        <>
          <h4 className="finding-group">Failed ({failed.length})</h4>
          <ul className="finding-list">
            {byLevel(failed).map((f) => (
              <FindingListItem key={f.external_id} finding={f} onSelect={onSelectFinding} />
            ))}
          </ul>
        </>
      )}
      {passed.length > 0 && (
        <details className="finding-details">
          <summary>Passed ({passed.length})</summary>
          <ul className="finding-list">
            {byLevel(passed).map((f) => (
              <FindingListItem key={f.external_id} finding={f} onSelect={onSelectFinding} />
            ))}
          </ul>
        </details>
      )}
      {findings.length === 0 && <p className="hint">No findings returned.</p>}
    </section>
  )
}

export default function Endpoints({ apiFetch, username, onLogout }) {
  const [endpoints, setEndpoints] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [newAddress, setNewAddress] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [discoveringId, setDiscoveringId] = useState(null)
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

  async function loadEndpoints() {
    const response = await apiFetch('/endpoints')
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
      const response = await apiFetch('/endpoints', {
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

  async function handleDelete(id) {
    try {
      await apiFetch(`/endpoints/${id}`, { method: 'DELETE' })
      await loadEndpoints()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDiscover(id) {
    setDiscoveringId(id)
    setError(null)
    try {
      const response = await apiFetch(`/endpoints/${id}/discover`, { method: 'POST' })
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
      const response = await apiFetch(`/endpoints/${endpoint.id}/results`)
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
    setDetail({ kind: 'assess-form', endpoint })
  }

  async function handleSubmitAssess(e) {
    e.preventDefault()
    setError(null)
    setAssessing(true)
    const endpoint = detail.endpoint
    try {
      const response = await apiFetch(`/endpoints/${endpoint.id}/assess`, {
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
      setDetail({ kind: 'assess-result', endpoint, findings })
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
          <span>{username}</span>
          <button type="button" className="btn-secondary" onClick={onLogout}>
            Log out
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
          <h2>Add endpoint</h2>
          <form className="endpoint-form" onSubmit={handleAddEndpoint}>
            <div className="field">
              <label htmlFor="address">IP or CIDR range</label>
              <input
                id="address"
                className="mono"
                placeholder="10.0.0.5 or 10.0.0.0/24"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="label">Label (optional)</label>
              <input id="label" placeholder="office network" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.55rem 1.2rem' }}>
              Add
            </button>
          </form>

          <h2>Endpoints ({endpoints.length})</h2>
          {!loaded && <p className="hint">Loading…</p>}
          {loaded && endpoints.length === 0 && (
            <p className="hint">No endpoints yet -- add one above, then click Discover to identify it.</p>
          )}
          <div className="card-grid">
            {endpoints.map((endpoint) => (
              <EndpointCard
                key={endpoint.id}
                endpoint={endpoint}
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
          onPortChange={setAssessPort}
          onUsernameChange={setAssessUsername}
          onAuthMethodChange={setAssessAuthMethod}
          onKeyMaterialChange={setAssessKeyMaterial}
          onPasswordChange={setAssessPassword}
          onSubmit={handleSubmitAssess}
          onBack={() => setDetail(null)}
        />
      )}
      {detail?.kind === 'assess-result' && (
        <AssessResult
          endpoint={detail.endpoint}
          findings={detail.findings}
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
