// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    screen.getByLabelText('Principal necessidade')
    screen.getByLabelText('Mensagem')
    screen.getByText('Falar com a Invariant')
    screen.getByText('Implantação on-premises · Licença anual · Atualizações e suporte incluídos.')
  })

  it('marca nome/e-mail/empresa/interesse como obrigatórios, sem checkbox de consentimento', () => {
    render(<Home />)

    expect(screen.getByLabelText(/Nome\*/).required).toBe(true)
    expect(screen.getByLabelText(/E-mail corporativo\*/).required).toBe(true)
    expect(screen.getByLabelText(/Empresa\*/).required).toBe(true)
    expect(screen.getByLabelText(/Interesse\*/).required).toBe(true)
    expect(screen.getByLabelText('Cargo').required).toBe(false)
    expect(screen.getByLabelText('Mensagem').required).toBe(false)
    // Aviso de transparência, não um contrato de consentimento -- não há
    // checkbox obrigatório de "li e aceito" neste formulário.
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('esconde "Quantos ambientes Linux" até o interesse incluir Linux', () => {
    render(<Home />)

    expect(screen.queryByLabelText('Quantos ambientes Linux')).toBeNull()

    fireEvent.change(screen.getByLabelText(/Interesse\*/), { target: { value: 'containers' } })
    expect(screen.queryByLabelText('Quantos ambientes Linux')).toBeNull()

    fireEvent.change(screen.getByLabelText(/Interesse\*/), { target: { value: 'linux' } })
    screen.getByLabelText('Quantos ambientes Linux')

    fireEvent.change(screen.getByLabelText(/Interesse\*/), { target: { value: 'linux_containers' } })
    screen.getByLabelText('Quantos ambientes Linux')
  })

  it('mostra o aviso de privacidade com link pra /privacidade', () => {
    render(<Home />)

    const link = screen.getByRole('link', { name: 'Política de Privacidade' })
    expect(link.getAttribute('href')).toBe('/privacidade')
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

    // O form some (fade-out, ~200ms) antes da confirmação ser montada --
    // ver LeadForm's useEffect/isLeaving em Home.jsx -- por isso o
    // waitFor aqui cobre esse atraso real, não é só uma troca instantânea.
    await waitFor(() => screen.getByText('Recebemos seus dados.'))
    screen.getByText('Nosso time entrará em contato para entender seu ambiente e apresentar o Invariant.')
    // "Explorar demo" já aparece em outros lugares da página (hero, nav,
    // rodapé) -- o card de sucesso soma sua própria ocorrência, então o
    // jeito certo de checar é dentro do próprio card, não contar o total
    // de matches na página inteira.
    const successCard = document.querySelector('.lead-success')
    within(successCard).getByText('Explorar demo', { exact: false })
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
