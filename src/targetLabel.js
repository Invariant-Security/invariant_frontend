// Mirrors invariant_api's reports.py::_format_target_label /
// _format_os_display exactly -- same rule, same output shape, so a card
// in the UI and the PDF cover for the same target always agree.
// document_name is an internal identifier this project controls, always
// shaped "{distro}_linux_{version}" (e.g. "debian_linux_12") -- a
// deterministic parse, not a free-text heuristic.

export function formatOsDisplay(documentName) {
  if (!documentName || !documentName.includes('_linux_')) return documentName || null
  const [distro, version] = documentName.split('_linux_')
  const capitalized = distro.charAt(0).toUpperCase() + distro.slice(1)
  return `${capitalized} ${version.replaceAll('_', '.')}`
}

// os_id/os_version_id (from a check response, e.g. "debian"/"13") are
// lowercase and not yet joined with "_linux_" -- this is the pre-assessment
// path (Check compatibility), before any document_name/Finding exists yet.
export function formatOsDisplayFromParts(osId, osVersionId) {
  if (!osId) return null
  const capitalized = osId.charAt(0).toUpperCase() + osId.slice(1)
  return osVersionId ? `${capitalized} ${osVersionId}` : capitalized
}

// targetType: "linux_host" | "docker_container"
// osDisplay: already-formatted string (see helpers above), or null
// hostname/primaryIp: ignored for docker_container even if passed, same
// guarantee reports.py's _format_target_label makes -- IP/hostname are
// never a container concept in this design.
export function formatTargetLabel(targetType, osDisplay, { primaryIp = null, containerImage = null } = {}) {
  const kind = targetType === 'linux_host' ? 'Linux host' : 'Docker container'
  const parts = [kind]
  if (containerImage) parts.push(containerImage)
  if (osDisplay) parts.push(osDisplay)
  if (targetType === 'linux_host') parts.push(primaryIp || 'Unknown')
  return parts.join(' · ')
}
