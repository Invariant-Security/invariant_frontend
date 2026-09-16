// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Home from './Home.jsx'

// Home.jsx's SectionHeader/reveal sections call useScrollReveal(), which
// needs window.matchMedia + IntersectionObserver -- neither exists in
// jsdom by default. Minimal polyfills, same spirit as Containers.test.jsx's
// vi.unstubAllGlobals() cleanup (this codebase already expects tests to
// stub/unstub globals around jsdom's gaps).
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  global.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Nome\*/), { target: { value: 'Ana Souza' } })
  fireEvent.change(screen.getByLabelText(/E-mail corporativo\*/), { target: { value: 'ana@example.com' } })
  fireEvent.change(screen.getByLabelText(/Empresa\*/), { target: { value: 'Exemplo LTDA' } })
  fireEvent.change(screen.getByLabelText(/Interesse\*/), { target: { value: 'linux' } })
}

function makeFetch(impl) {
  return vi.fn(impl)
}

describe('Home -- formulário "Fale com a Invariant"', () => {
  it('renderiza todos os campos e rótulos em português', () => {
    render(<Home />)

    screen.getByText('Fale com a Invariant')
    screen.getByText('Leve o Invariant para o seu ambiente.')
    screen.getByLabelText(/Nome\*/)
    screen.getByLabelText(/E-mail corporativo\*/)
    screen.getByLabelText(/Empresa\*/)
    screen.getByLabelText('Cargo')
    screen.getByLabelText(/Interesse\*/)
    screen.getByLabelText('Quantos ambientes Linux')
    screen.getByLabelText('Principal necessidade')
    screen.getByLabelText('Mensagem')
    screen.getByText('Falar com a Invariant')
    screen.getByText('Implantação on-premises · Licença anual · Atualizações e suporte incluídos.')
  })

  it('marca nome/e-mail/empresa/interesse como obrigatórios', () => {
    render(<Home />)

    expect(screen.getByLabelText(/Nome\*/).required).toBe(true)
    expect(screen.getByLabelText(/E-mail corporativo\*/).required).toBe(true)
    expect(screen.getByLabelText(/Empresa\*/).required).toBe(true)
    expect(screen.getByLabelText(/Interesse\*/).required).toBe(true)
    expect(screen.getByLabelText('Cargo').required).toBe(false)
    expect(screen.getByLabelText('Mensagem').required).toBe(false)
  })

  it('mostra o aviso de privacidade, sem link', () => {
    render(<Home />)

    const notice = screen.getByText('Usaremos seus dados para responder ao seu contato comercial.')
    expect(notice.querySelector('a')).toBeNull()
  })

  it('mostra "Enviando..." e desabilita o botão durante o envio', async () => {
    let resolveFetch
    vi.stubGlobal(
      'fetch',
      makeFetch(() => new Promise((resolve) => { resolveFetch = resolve })),
    )
    render(<Home />)
    fillRequiredFields()

    fireEvent.click(screen.getByText('Falar com a Invariant'))

    await waitFor(() => screen.getByText('Enviando...'))
    expect(screen.getByText('Enviando...').disabled).toBe(true)

    resolveFetch({ ok: true, json: async () => ({ status: 'received' }) })
  })

  it('em caso de sucesso, mostra a mensagem certa e esconde o form', async () => {
    vi.stubGlobal('fetch', makeFetch(async () => ({ ok: true, json: async () => ({ status: 'received' }) })))
    render(<Home />)
    fillRequiredFields()

    fireEvent.click(screen.getByText('Falar com a Invariant'))

    await waitFor(() =>
      screen.getByText(
        'Recebemos seus dados. Nosso time entrará em contato para entender seu ambiente e apresentar o Invariant.',
      ),
    )
    expect(screen.queryByLabelText(/Nome\*/)).toBeNull()
  })

  it('em caso de erro, mostra a mensagem certa e preserva os valores digitados', async () => {
    vi.stubGlobal('fetch', makeFetch(async () => ({ ok: false, json: async () => ({}) })))
    render(<Home />)
    fillRequiredFields()

    fireEvent.click(screen.getByText('Falar com a Invariant'))

    await waitFor(() =>
      screen.getByText('Não foi possível enviar seus dados. Tente novamente em alguns instantes.'),
    )
    expect(screen.getByLabelText(/Nome\*/).value).toBe('Ana Souza')
    expect(screen.getByLabelText(/E-mail corporativo\*/).value).toBe('ana@example.com')
    expect(screen.getByLabelText(/Empresa\*/).value).toBe('Exemplo LTDA')
  })

  it('envia o payload certo, com códigos (não rótulos em português)', async () => {
    const fetchMock = makeFetch(async () => ({ ok: true, json: async () => ({ status: 'received' }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<Home />)

    fillRequiredFields()
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'CTO' } })
    fireEvent.change(screen.getByLabelText('Quantos ambientes Linux'), { target: { value: '11_50' } })
    fireEvent.change(screen.getByLabelText('Principal necessidade'), { target: { value: 'compliance_cis' } })
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Queremos avaliar conformidade CIS.' } })

    fireEvent.click(screen.getByText('Falar com a Invariant'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/leads$/)
    const body = JSON.parse(options.body)
    expect(body).toEqual({
      name: 'Ana Souza',
      email: 'ana@example.com',
      company: 'Exemplo LTDA',
      role: 'CTO',
      target_scope: 'linux',
      environment_size: '11_50',
      primary_need: 'compliance_cis',
      message: 'Queremos avaliar conformidade CIS.',
      website: '',
    })
  })
})
