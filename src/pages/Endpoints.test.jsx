// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Endpoints from './Endpoints.jsx'

afterEach(cleanup)

function makeApiFetch({ endpoints = [], bulkResult = [] } = {}) {
  return vi.fn(async (path, options = {}) => {
    if (path === '/api/endpoints' && (!options.method || options.method === 'GET')) {
      return { ok: true, json: async () => endpoints }
    }
    if (path === '/api/endpoints/bulk') {
      return { ok: true, json: async () => bulkResult }
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
