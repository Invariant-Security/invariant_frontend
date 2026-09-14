// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Containers from './Containers.jsx'

// This project doesn't set vitest's `test.globals: true`, so
// @testing-library/react's own auto-cleanup (which relies on detecting a
// global test framework) never registers -- without this, each test's
// render() piles on top of the previous one in the same jsdom document,
// and queries that expect a single match (getByRole/getByText) fail with
// "found multiple elements" the moment more than one test has rendered.
afterEach(cleanup)

function makeApiFetch({ containers = [{ name: 'tamois', image: 'tamois-img' }], checkResult = {} } = {}) {
  return vi.fn(async (path) => {
    if (path === '/api/containers') {
      return { ok: true, json: async () => containers }
    }
    if (path.endsWith('/check')) {
      return {
        ok: true,
        json: async () => ({ testable: true, os_id: 'debian', os_version_id: '12', reason: null, ...checkResult }),
      }
    }
    return { ok: true, json: async () => ({}) }
  })
}

async function renderCheckedContainers(options) {
  const apiFetch = makeApiFetch(options)
  render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
  await waitFor(() => screen.getByRole('heading', { name: (name) => name.replace(/\s+/g, '') === 'Containers(1)' }))
  fireEvent.click(screen.getByText('Verificar compatibilidade'))
  await waitFor(() => screen.getByText('tamois'))
  return apiFetch
}

describe('Containers -- textos em português', () => {
  it('não deixa strings em inglês no fluxo principal', async () => {
    await renderCheckedContainers()
    // getByText/getByRole throw if no match exists -- reaching the next
    // line already proves presence, no extra matcher needed.
    screen.getByText('Verificar compatibilidade')
    screen.getByText(/Executar selecionados/)
    screen.getByText('Exportar relatório consolidado')
    screen.getByText('Sair')
    // queryByText returns null instead of throwing -- this is the right
    // query for "must NOT be present".
    expect(screen.queryByText(/Check compatibility/i)).toBeNull()
    expect(screen.queryByText(/Run selected/i)).toBeNull()
    expect(screen.queryByText(/Export consolidated/i)).toBeNull()
    expect(screen.queryByText(/Log out/i)).toBeNull()
  })
})

describe('Containers -- botão de exportar consolidado', () => {
  it('já aparece no primeiro render, antes de qualquer verificação', async () => {
    const apiFetch = makeApiFetch()
    render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
    await waitFor(() => screen.getByRole('heading', { name: (name) => name.replace(/\s+/g, '') === 'Containers(1)' }))

    screen.getByText('Verificar compatibilidade')
    screen.getByText(/Executar selecionados/)
    screen.getByText('Exportar relatório consolidado')
  })

  it('começa desabilitado e tem um title explicando o motivo', async () => {
    const apiFetch = makeApiFetch()
    render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
    await waitFor(() => screen.getByRole('heading', { name: (name) => name.replace(/\s+/g, '') === 'Containers(1)' }))

    const exportBtn = screen.getByText('Exportar relatório consolidado')
    expect(exportBtn.disabled).toBe(true)
    expect(exportBtn.title).not.toBe('')
  })
})

describe('Containers -- área clicável do card compatível', () => {
  it('clicar no checkbox seleciona o container', async () => {
    await renderCheckedContainers()
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.checked).toBe(false)

    fireEvent.click(checkbox)

    expect(checkbox.checked).toBe(true)
  })

  it('clicar no nome do container seleciona', async () => {
    await renderCheckedContainers()
    const checkbox = screen.getByRole('checkbox')

    fireEvent.click(screen.getByText('tamois'))

    expect(checkbox.checked).toBe(true)
  })

  it('clicar no corpo do card seleciona', async () => {
    await renderCheckedContainers()
    const checkbox = screen.getByRole('checkbox')
    const card = checkbox.closest('.target-card')

    fireEvent.click(card)

    expect(checkbox.checked).toBe(true)
  })

  // "Ver relatório →" and "Tentar novamente" render inside the exact same
  // wrapper div as "Executar avaliação →" (AssessAction's different status
  // branches, same parent element in CompatibleCard), with the same single
  // stopPropagation() call around all of them -- so this one case proves
  // the mechanism for all three. They're not tested individually because
  // both of those buttons synchronously call setDetail() and navigate away
  // from the card list the instant they're clicked (by design, unrelated
  // to selection), which makes "assert the checkbox is unchanged right
  // after" moot -- the checkbox itself is gone from the DOM by then.
  it('clicar em "Executar avaliação" não altera a seleção', async () => {
    await renderCheckedContainers()
    const checkbox = screen.getByRole('checkbox')

    fireEvent.click(screen.getByText('Executar avaliação →'))

    expect(checkbox.checked).toBe(false)
  })

  it('o card mostra um estado visual de selecionado', async () => {
    await renderCheckedContainers()
    const checkbox = screen.getByRole('checkbox')
    const card = checkbox.closest('.target-card')
    expect(card.className).not.toContain('target-card--selected')

    fireEvent.click(checkbox)

    expect(card.className).toContain('target-card--selected')
  })
})
