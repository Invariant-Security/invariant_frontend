import { describe, expect, it } from 'vitest'
import { formatOsDisplay, formatOsDisplayFromParts, formatTargetLabel } from './targetLabel.js'

describe('formatOsDisplay', () => {
  it('parses document_name into a display OS string', () => {
    expect(formatOsDisplay('debian_linux_12')).toBe('Debian 12')
    expect(formatOsDisplay('ubuntu_linux_24_04')).toBe('Ubuntu 24.04')
  })

  it('falls back to the raw string for an unrecognized shape', () => {
    expect(formatOsDisplay('something-else')).toBe('something-else')
  })

  it('handles missing input without inventing anything', () => {
    expect(formatOsDisplay(null)).toBeNull()
    expect(formatOsDisplay('')).toBeNull()
  })
})

describe('formatOsDisplayFromParts', () => {
  it('title-cases os_id and appends os_version_id', () => {
    expect(formatOsDisplayFromParts('debian', '13')).toBe('Debian 13')
  })

  it('returns null when os_id is missing', () => {
    expect(formatOsDisplayFromParts(null, '13')).toBeNull()
  })
})

describe('formatTargetLabel', () => {
  it('builds the Linux host label with IP', () => {
    expect(formatTargetLabel('linux_host', 'Debian 13', { primaryIp: '10.0.0.25' })).toBe(
      'Linux host · Debian 13 · 10.0.0.25',
    )
  })

  it('shows Unknown when a Linux host has no IP determined', () => {
    expect(formatTargetLabel('linux_host', 'Debian 13')).toBe('Linux host · Debian 13 · Unknown')
  })

  it('builds the Docker container label without IP', () => {
    expect(formatTargetLabel('docker_container', 'Debian 12')).toBe('Docker container · Debian 12')
  })

  it('inserts the container image before the OS when present', () => {
    expect(formatTargetLabel('docker_container', 'Debian 12', { containerImage: 'PostgreSQL 16' })).toBe(
      'Docker container · PostgreSQL 16 · Debian 12',
    )
  })

  it('never shows an IP for a docker_container even if one is passed by mistake', () => {
    const label = formatTargetLabel('docker_container', 'Debian 12', { primaryIp: '9.9.9.9' })
    expect(label).not.toContain('9.9.9.9')
  })
})
