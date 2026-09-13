import { useEffect, useState } from 'react'
import { FindingsReport, FindingDetail } from '../findings.jsx'
import './Console.css'
import './Findings.css'

// Escopo desta tela: listar containers Docker deste host (GET /containers,
// já filtra fora o próprio stack do invariant) e rodar assessment CIS real
// contra um deles via docker exec (POST /assess/{target}, mesmo mecanismo
// do /demo -- sem credenciais, ao contrário do fluxo SSH de Endpoints.jsx).

function ContainerCard({ container, assessing, onRunAssessment }) {
  return (
    <div className="target-card">
      <div className="target-card__title mono">{container.name}</div>
      <div className="hint" style={{ marginBottom: '0.75rem' }}>{container.image}</div>
      <button
        type="button"
        className="link-btn"
        onClick={() => onRunAssessment(container)}
        disabled={assessing}
      >
        {assessing ? 'Running…' : 'Run assessment →'}
      </button>
    </div>
  )
}

export default function Containers({ apiFetch, username, onLogout }) {
  const [containers, setContainers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [assessingName, setAssessingName] = useState(null)
  // null = container list. Otherwise:
  //   {kind:'assess-result', container, findings}
  //   {kind:'finding-detail', container, findings, finding}
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    apiFetch('/containers')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(setContainers)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRunAssessment(container) {
    setAssessingName(container.name)
    setError(null)
    try {
      const response = await apiFetch(`/assess/${container.name}`, { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${response.status}`)
      }
      const findings = await response.json()
      setDetail({ kind: 'assess-result', container, findings })
    } catch (err) {
      setError(err.message)
    } finally {
      setAssessingName(null)
    }
  }

  return (
    <div className="page">
      <header className="site-header">
        <div className="brand">INVARIANT</div>
        <div className="session-info">
          <a className="link-btn" href="/endpoints">
            Endpoints
          </a>
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
          <h2>Containers ({containers.length})</h2>
          {!loaded && <p className="hint">Loading…</p>}
          {loaded && containers.length === 0 && <p className="hint">No containers found on this host.</p>}
          <div className="card-grid">
            {containers.map((container) => (
              <ContainerCard
                key={container.name}
                container={container}
                assessing={assessingName === container.name}
                onRunAssessment={handleRunAssessment}
              />
            ))}
          </div>
        </>
      )}

      {detail?.kind === 'assess-result' && (
        <FindingsReport
          title={detail.container.name}
          findings={detail.findings}
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
