import { useState } from 'react'
import { formatOsDisplay, formatTargetLabel } from './targetLabel.js'

// Renderização de Finding compartilhada entre Demo.jsx (/demo, pública) e
// Endpoints.jsx/Containers.jsx (console autenticado -- fluxo "Run
// assessment"). Extraído de Demo.jsx: nenhuma lógica nova aqui, só as
// peças puras que as telas precisam. Classes CSS em Findings.css.

// CIS's own severity/profile tier -- Level 1 (baseline) before Level 2
// (defense-in-depth, may affect functionality) before "no applicability
// data" -- see Finding.level's own docstring in assessment/__init__.py for
// why it's the minimum across a control's applicability list, not a single
// fixed value.
export function byLevel(findings) {
  return [...findings].sort((a, b) => (a.level ?? 99) - (b.level ?? 99))
}

export function LevelBadge({ level }) {
  if (level == null) return null
  return <span className={`finding-badge finding-badge--level${level}`}>L{level}</span>
}

export function FindingListItem({ finding, onSelect }) {
  return (
    <li className="finding">
      <div className="finding__head">
        <span className="mono">{finding.external_id}</span>
        <LevelBadge level={finding.level} />
        <span>{finding.control_title}</span>
      </div>
      <div className="finding__meta">
        {finding.source_name}/{finding.document_name} v{finding.document_version}
        {finding.scored === false && ' · not scored'}
      </div>
      <div className="finding__evidence mono">{finding.evidence_output}</div>
      <button type="button" className="link-btn" onClick={() => onSelect(finding)}>
        View evidence →
      </button>
    </li>
  )
}

export function EvidenceChain({ finding }) {
  const steps = [
    { label: 'Finding', value: `${finding.external_id} — ${finding.status}` },
    { label: 'Control', value: finding.control_title },
    { label: 'Security Source', value: finding.source_name },
    { label: 'Document', value: finding.document_name },
    { label: 'Document Version', value: `v${finding.document_version}` },
  ]
  if (finding.raw_artifact_path) {
    steps.push({
      label: 'Original evidence',
      value: finding.raw_artifact_path,
      mono: true,
      sub: finding.content_hash ? `sha256:${finding.content_hash.slice(0, 16)}…` : null,
    })
  }
  return (
    <ol className="finding-evidence-chain">
      {steps.map((s) => (
        <li key={s.label} className="finding-evidence-chain__step">
          <div className="finding-evidence-chain__label">{s.label}</div>
          <div className={`finding-evidence-chain__value ${s.mono ? 'mono' : ''}`}>{s.value}</div>
          {s.sub && <div className="finding-evidence-chain__sub mono">{s.sub}</div>}
        </li>
      ))}
    </ol>
  )
}

export function FindingsReport({ title, findings, onSelectFinding, onBack, apiFetch, hostname, primaryIp, containerImage }) {
  // Explicit filters, not "anything not FAIL is PASS" -- today's pipeline
  // only ever produces PASS/FAIL, but the count must not silently misstate
  // the total if a third status (e.g. "NOT ASSESSED") ever shows up.
  const failed = findings.filter((f) => f.status === 'FAIL')
  const passed = findings.filter((f) => f.status === 'PASS')
  const other = findings.filter((f) => f.status !== 'FAIL' && f.status !== 'PASS')
  const [exporting, setExporting] = useState(null) // 'ceo' | 'technical' | null

  // Same rule reports.py's _format_target_label uses, so this screen and
  // the exported PDF cover always agree -- hostname/primaryIp are only
  // ever shown when the finding set is actually target_type=linux_host.
  const targetLabel = findings[0]
    ? formatTargetLabel(findings[0].target_type, formatOsDisplay(findings[0].document_name), {
        primaryIp,
        containerImage,
      })
    : null

  async function handleExportPdf(kind) {
    setExporting(kind)
    try {
      const response = await apiFetch('/api/reports/pdf', {
        method: 'POST',
        body: JSON.stringify({ title, kind, findings, hostname, primaryIp, containerImage }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invariant-${kind}-report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      window.alert(`Falha ao exportar PDF: ${err.message}`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <section>
      <button type="button" className="link-btn" onClick={onBack}>
        ← Back
      </button>
      <h2 className="mono">{title}</h2>
      {targetLabel && <p className="hint" style={{ marginTop: '-0.5rem' }}>{targetLabel}</p>}
      <div className="card__counts">
        <span className="badge badge--pass">{passed.length} PASS</span>
        <span className="badge badge--fail">{failed.length} FAIL</span>
        {other.length > 0 && <span className="badge badge--na">{other.length} N/A</span>}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', margin: '0.75rem 0 1rem' }}>
        <button type="button" className="link-btn" onClick={() => handleExportPdf('ceo')} disabled={exporting !== null}>
          {exporting === 'ceo' ? 'Exportando…' : 'Exportar PDF (CEO) →'}
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => handleExportPdf('technical')}
          disabled={exporting !== null}
        >
          {exporting === 'technical' ? 'Exportando…' : 'Exportar PDF (Técnico) →'}
        </button>
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

export function FindingDetail({ finding, onBack }) {
  return (
    <section className="finding-detail">
      <button type="button" className="link-btn" onClick={onBack}>
        ← Back
      </button>
      <span className="finding-detail__eyebrow">FINDING</span>
      <h2>
        {finding.control_title} <LevelBadge level={finding.level} />
      </h2>

      <div className="finding-detail__grid">
        <div>
          <div className="finding-detail__label">Target</div>
          <div className="mono">{finding.target}</div>
        </div>
        <div>
          <div className="finding-detail__label">Observed</div>
          <div className="mono">{finding.evidence_output}</div>
        </div>
        <div>
          <div className="finding-detail__label">CIS profile</div>
          <div>
            {finding.level != null ? `Level ${finding.level}` : 'No applicability data'}
            {finding.scored === false && ' · not scored'}
          </div>
        </div>
      </div>

      {finding.remediation && (
        <div className="finding-detail__remediation">
          <h3>How to fix</h3>
          <p>{finding.remediation}</p>
        </div>
      )}

      <h3>Evidence Chain</h3>
      <EvidenceChain finding={finding} />
    </section>
  )
}
