// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TlsFingerprint from './TlsFingerprint.jsx'

afterEach(cleanup)

function fakeApiFetch(responder) {
  return vi.fn(async (path) => {
    expect(path).toBe('/api/appliance/tls')
    return responder()
  })
}

const FP = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89'

describe('TlsFingerprint', () => {
  it('mostra a impressão digital quando o appliance tem certificado', async () => {
    const apiFetch = fakeApiFetch(() => ({ ok: true, json: async () => ({ available: true, sha256: FP }) }))
    render(<TlsFingerprint apiFetch={apiFetch} />)
    expect(await screen.findByText(FP)).toBeTruthy()
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('não mostra nada em instalação hospedada (sem certificado do appliance)', async () => {
    const apiFetch = fakeApiFetch(() => ({ ok: true, json: async () => ({ available: false }) }))
    const { container } = render(<TlsFingerprint apiFetch={apiFetch} />)
    await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('não mostra nada nem quebra se a rota falhar', async () => {
    const failing = fakeApiFetch(() => ({ ok: false, status: 500, json: async () => ({}) }))
    const { container } = render(<TlsFingerprint apiFetch={failing} />)
    await waitFor(() => expect(failing).toHaveBeenCalled())
    expect(container.textContent).toBe('')
    const throwing = vi.fn(async () => {
      throw new Error('rede')
    })
    const second = render(<TlsFingerprint apiFetch={throwing} />)
    await waitFor(() => expect(throwing).toHaveBeenCalled())
    expect(second.container.textContent).toBe('')
  })
})
