import { useEffect, useState } from 'react'
import './Console.css'

// Escopo desta tela: cadastrar endpoints (IP único ou CIDR) e disparar a
// identificação (windows/linux/docker/waf/firewall/vmware) -- rodar
// checks CIS de verdade contra o que foi descoberto aqui é etapa futura,
// não desta tela (ver invariant_assessment/preocupacoes.md).

function ClassificationBadge({ classification, confidence }) {
  if (!classification) return <span className="badge badge--unknown">not scanned</span>
  const pct = Math.round(confidence * 100)
  return (
    <span className={`badge badge--${classification}`}>
      {classification} {confidence != null && `(${pct}%)`}
    </span>
  )
}

function EndpointCard({ endpoint, discovering, onDiscover, onDelete, onViewResults }) {
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

export default function Endpoints({ apiFetch, username, onLogout }) {
  const [endpoints, setEndpoints] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [newAddress, setNewAddress] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [discoveringId, setDiscoveringId] = useState(null)
  const [detail, setDetail] = useState(null) // {endpoint, results} | null

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
      setDetail({ endpoint, results: await response.json() })
    } catch (err) {
      setError(err.message)
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
              />
            ))}
          </div>
        </>
      )}

      {detail && <ResultsDetail endpoint={detail.endpoint} results={detail.results} onBack={() => setDetail(null)} />}
    </div>
  )
}
