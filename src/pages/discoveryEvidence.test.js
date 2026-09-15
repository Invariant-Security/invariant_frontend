import { describe, expect, it } from 'vitest'
import { STATUS_LABEL, summarizeFailedProbe } from './discoveryEvidence.js'

describe('summarizeFailedProbe', () => {
  it('returns null when a port is open (nothing to explain)', () => {
    const evidence = { open_ports: [22], banners: { 22: 'SSH' }, port_attempts: [{ port: 80, status: 'timeout' }] }
    expect(summarizeFailedProbe(evidence)).toBeNull()
  })

  it('returns null when there are no attempts at all (nothing scanned)', () => {
    expect(summarizeFailedProbe({ open_ports: [], banners: {}, port_attempts: [] })).toBeNull()
  })

  it('handles absence of port_attempts (backward compatibility with older discovery rows)', () => {
    expect(summarizeFailedProbe({ open_ports: [], banners: {} })).toBeNull()
  })

  it('summarizes an all-timeout result', () => {
    const evidence = {
      open_ports: [],
      banners: {},
      port_attempts: Array.from({ length: 10 }, (_, i) => ({ port: i + 1, status: 'timeout' })),
    }
    const summary = summarizeFailedProbe(evidence)
    expect(summary.headline).toBe('Tentamos 10 portas conhecidas e nenhuma respondeu dentro do tempo limite.')
    expect(summary.total).toBe(10)
    expect(summary.openCount).toBe(0)
    expect(summary.counts).toEqual({ timeout: 10 })
  })

  it('summarizes an all-refused result without calling it "unreachable"', () => {
    const evidence = {
      open_ports: [],
      banners: {},
      port_attempts: [
        { port: 22, status: 'refused' },
        { port: 80, status: 'refused' },
      ],
    }
    const summary = summarizeFailedProbe(evidence)
    expect(summary.headline).toBe('Nenhum serviço foi identificado nas portas testadas.')
    expect(summary.headline).not.toMatch(/inalcançável/)
  })

  it('summarizes a mixed timeout/refused/network_unreachable result', () => {
    const evidence = {
      open_ports: [],
      banners: {},
      port_attempts: [
        { port: 22, status: 'timeout' },
        { port: 80, status: 'refused' },
        { port: 443, status: 'network_unreachable' },
      ],
    }
    const summary = summarizeFailedProbe(evidence)
    expect(summary.headline).toBe(
      'A rede de destino não possui rota alcançável a partir do ambiente de descoberta.',
    )
    expect(summary.counts).toEqual({ timeout: 1, refused: 1, network_unreachable: 1 })
  })

  it('never uses "unreachable" language for a pure timeout, never "offline" for refused', () => {
    const timeoutOnly = summarizeFailedProbe({
      open_ports: [],
      banners: {},
      port_attempts: [{ port: 22, status: 'timeout' }],
    })
    expect(timeoutOnly.headline).not.toMatch(/inalcançável|offline/)

    const refusedOnly = summarizeFailedProbe({
      open_ports: [],
      banners: {},
      port_attempts: [{ port: 22, status: 'refused' }],
    })
    expect(refusedOnly.headline).not.toMatch(/inalcançável|offline/)
  })
})

describe('STATUS_LABEL', () => {
  it('has a Portuguese label for every internal status code', () => {
    for (const code of ['timeout', 'refused', 'network_unreachable', 'host_unreachable', 'error']) {
      expect(STATUS_LABEL[code]).toBeTruthy()
      expect(STATUS_LABEL[code]).not.toBe(code)
    }
  })
})
