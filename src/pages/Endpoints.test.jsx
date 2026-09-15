// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Endpoints from './Endpoints.jsx'

afterEach(cleanup)

function makeApiFetch({ endpoints = [], bulkResult = [], results = [] } = {}) {
  return vi.fn(async (path, options = {}) => {
    if (path === '/api/endpoints' && (!options.method || options.method === 'GET')) {
      return { ok: true, json: async () => endpoints }
    }
    if (path === '/api/endpoints/bulk') {
      return { ok: true, json: async () => bulkResult }
    }
    if (/\/api\/endpoints\/\d+\/results$/.test(path)) {
      return { ok: true, json: async () => results }
    }
    return { ok: true, json: async () => ({}) }
  })
}

function makeCsvFile(content, name = 'hosts.csv') {
  return new File([content], name, { type: 'text/csv' })
}

async function renderEndpoints(options) {
  const apiFetch = makeApiFetch(options)
  render(<Endpoints apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
  await waitFor(() => screen.getByText('Importar CSV'))
  return apiFetch
}

describe('Endpoints -- textos em português', () => {
  it('não deixa strings em inglês no fluxo principal', async () => {
    await renderEndpoints()
    screen.getByText('Adicionar host Linux')
    screen.getByText('IP ou faixa CIDR')
    screen.getByText('Nome (opcional)')
    screen.getByText('Adicionar')
    screen.getByText('Importar CSV')
    screen.getByText(/Hosts Linux/)
    screen.getByText('Sair')
    expect(screen.queryByText(/Add Linux host/i)).toBeNull()
    expect(screen.queryByText(/^Add$/)).toBeNull()
    expect(screen.queryByText(/Label \(optional\)/i)).toBeNull()
    expect(screen.queryByText(/Log out/i)).toBeNull()
  })
})

describe('Endpoints -- importar CSV', () => {
  it('envia o payload certo (com row por linha) e mostra o resumo', async () => {
    const apiFetch = await renderEndpoints({
      bulkResult: [
        { row: 2, address: '10.0.0.1', label: 'API', status: 'created', id: 1, detail: null },
        { row: 4, address: '999.1.1.1', label: 'Ruim', status: 'error', id: null, detail: 'Endereço IP ou CIDR inválido.' },
      ],
    })

    const csv = 'address,label\n10.0.0.1,API\n\n999.1.1.1,Ruim'
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeCsvFile(csv)] } })

    await waitFor(() => screen.getByText('Importação concluída'))

    const bulkCall = apiFetch.mock.calls.find(([path]) => path === '/api/endpoints/bulk')
    const sentRows = JSON.parse(bulkCall[1].body)
    expect(sentRows).toEqual([
      { row: 2, address: '10.0.0.1', label: 'API', tags: [] },
      { row: 4, address: '999.1.1.1', label: 'Ruim', tags: [] },
    ])

    screen.getByText(/1 adicionados/)
    screen.getByText(/1 não adicionados/)
    screen.getByText(/Linha 4 \(999.1.1.1\): Endereço IP ou CIDR inválido\./)
  })

  it('recusa um arquivo maior que o limite sem chamar a API', async () => {
    const apiFetch = await renderEndpoints()
    const bigContent = 'address\n' + '10.0.0.1\n'.repeat(1)
    const bigFile = makeCsvFile(bigContent)
    Object.defineProperty(bigFile, 'size', { value: 3 * 1024 * 1024 })

    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [bigFile] } })

    await waitFor(() => screen.getByText('O arquivo contém mais endpoints do que o limite permitido.'))
    expect(apiFetch.mock.calls.some(([path]) => path === '/api/endpoints/bulk')).toBe(false)
  })
})

describe('Endpoints -- evidência real de falha de discovery', () => {
  it('mostra o resumo em português e nunca os códigos internos crus', async () => {
    await renderEndpoints({
      endpoints: [{ id: 9, address: '192.168.150.9', label: 'Auditorio', tags: [], classification: 'unknown', confidence: 0 }],
      results: [
        {
          ip: '192.168.150.9',
          classification: 'unknown',
          confidence: 0,
          scanned_at: '2026-09-15T12:00:00Z',
          evidence: {
            open_ports: [],
            banners: {},
            port_attempts: [
              { port: 22, status: 'timeout' },
              { port: 80, status: 'refused' },
              { port: 443, status: 'network_unreachable' },
            ],
          },
        },
      ],
    })

    fireEvent.click(screen.getByText('Ver evidências →'))

    await waitFor(() => screen.getByText(/portas testadas/))
    screen.getByText('A rede de destino não possui rota alcançável a partir do ambiente de descoberta.')
    screen.getByText(/3 portas testadas · 0 abertas/)

    fireEvent.click(screen.getByText('Ver detalhes'))
    screen.getByText(/Porta 22 — Tempo limite/)
    screen.getByText(/Porta 80 — Conexão recusada/)
    screen.getByText(/Porta 443 — Rede sem rota/)

    // Nunca os códigos internos crus na tela.
    expect(document.body.textContent).not.toMatch(/\btimeout\b/)
    expect(document.body.textContent).not.toMatch(/\brefused\b/)
    expect(document.body.textContent).not.toMatch(/\bnetwork_unreachable\b/)
  })

  it('não mostra o resumo de falha quando existe porta aberta', async () => {
    await renderEndpoints({
      endpoints: [{ id: 2, address: '10.153.120.185', label: 'Debian', tags: [], classification: 'linux', confidence: 1 }],
      results: [
        {
          ip: '10.153.120.185',
          classification: 'linux',
          confidence: 1,
          scanned_at: '2026-09-15T12:00:00Z',
          evidence: { open_ports: [22], banners: { 22: 'SSH-2.0-OpenSSH_9.6' }, port_attempts: [{ port: 80, status: 'timeout' }] },
        },
      ],
    })

    fireEvent.click(screen.getByText('Ver evidências →'))

    await waitFor(() => screen.getByText('22'))
    expect(screen.queryByText('Ver detalhes')).toBeNull()
    expect(screen.queryByText(/Por que não identificamos/)).toBeNull()
  })

  it('mantém compatibilidade com discovery antigo (sem port_attempts)', async () => {
    await renderEndpoints({
      endpoints: [{ id: 9, address: '192.168.150.9', label: 'Auditorio', tags: [], classification: 'unknown', confidence: 0 }],
      results: [
        {
          ip: '192.168.150.9',
          classification: 'unknown',
          confidence: 0,
          scanned_at: '2026-09-15T12:00:00Z',
          evidence: { open_ports: [], banners: {} },
        },
      ],
    })

    fireEvent.click(screen.getByText('Ver evidências →'))

    await waitFor(() => screen.getByText('(nenhuma respondeu)'))
    expect(screen.queryByText('Ver detalhes')).toBeNull()
  })
})
