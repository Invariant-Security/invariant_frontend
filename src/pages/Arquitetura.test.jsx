// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import Arquitetura from './Arquitetura.jsx'

// /arquitetura é pública. A versão completa (infra da VPS, pontos fracos,
// modelo de negócio) fica fora deste repositório -- este teste impede que
// algum desses detalhes internos escorregue para a página ou para o fonte.
const INTERNAL_TERMS = [
  'hostinger',
  'cloudflare',
  'nginx-proxy',
  'vps',
  'docker.sock',
  'srv1662201',
  '/srv/projects',
  'slack',
  'ghcr',
  'demo lab',
  'licensing',
  'gateway',
  'r$',
  'teste.invariantsec.org',
  'invariant-next',
]

describe('Arquitetura (pública)', () => {
  afterEach(cleanup)

  it('mostra as seções e os componentes', () => {
    render(<Arquitetura />)
    expect(screen.getByRole('heading', { level: 1, name: 'Arquitetura do Invariant' })).toBeTruthy()
    for (const name of ['Visão geral', 'Princípios', 'Componentes', 'Uma avaliação, passo a passo']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy()
    }
    expect(screen.getByText('invariant_assessment')).toBeTruthy()
  })

  it('não expõe detalhes internos da infraestrutura nem do negócio', () => {
    const { container } = render(<Arquitetura />)
    const rendered = container.textContent.toLowerCase()
    const source = readFileSync(resolve(process.cwd(), 'src/pages/Arquitetura.jsx'), 'utf8')
      .toLowerCase()
      // o comentário do topo cita "teste.invariantsec.org" e "cloudflare"
      // para explicar onde está a versão completa -- só ele é exceção
      .replace(/^\/\/.*$/gm, '')
    for (const term of INTERNAL_TERMS) {
      expect(rendered, `texto renderizado contém "${term}"`).not.toContain(term)
      expect(source, `código da página contém "${term}"`).not.toContain(term)
    }
  })
})
