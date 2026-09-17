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
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function makeApiFetch({
  containers = [{ name: 'tamois', image: 'tamois-img', id: 'real-id-1' }],
  checkResult = {},
  findings = [],
  previewResult = null,
  publishResult = null,
} = {}) {
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
    if (path.startsWith('/api/assess/')) {
      return { ok: true, json: async () => findings }
    }
    if (path === '/api/reports/pdf') {
      return { ok: true, json: async () => ({}), blob: async () => new Blob() }
    }
    if (path === '/demo-snapshot/preview') {
      return { ok: true, json: async () => previewResult ?? { ok: true, containers: [], issues: [], unverified_container_ids: [] } }
    }
    if (path === '/demo-snapshot/publish') {
      if (publishResult?.status === 'error') {
        return { ok: false, status: 422, json: async () => ({ detail: { message: publishResult.message } }) }
      }
      return { ok: true, json: async () => ({ status: 'published' }) }
    }
    if (path === '/demo-snapshot/revoke') {
      return { ok: true, json: async () => (publishResult?.revoke ?? { status: 'revoked' }) }
    }
    return { ok: true, json: async () => ({}) }
  })
}

function makeVisitorApiFetch({ containers = [] } = {}) {
  return vi.fn(async (path) => {
    if (path === '/demo-snapshot') {
      return { ok: true, json: async () => ({ published_at: containers.length ? '2026-09-17T00:00:00Z' : null, containers }) }
    }
    return { ok: true, json: async () => ({}) }
  })
}

function headingMatcher(text) {
  return (name) => name.replace(/\s+/g, '') === text.replace(/\s+/g, '')
}

async function renderCheckedContainers(options) {
  const apiFetch = makeApiFetch(options)
  render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
  await waitFor(() => screen.getByRole('heading', { name: headingMatcher('Containers (1)') }))
  fireEvent.click(screen.getByText('Verificar compatibilidade'))
  await waitFor(() => screen.getByText('tamois'))
  return apiFetch
}

async function renderCheckedMultiple(names) {
  const containers = names.map((name) => ({ name, image: `${name}-img` }))
  const apiFetch = makeApiFetch({ containers })
  render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
  await waitFor(() => screen.getByRole('heading', { name: headingMatcher(`Containers (${names.length})`) }))
  fireEvent.click(screen.getByText('Verificar compatibilidade'))
  await waitFor(() => names.forEach((name) => screen.getByText(name)))
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

describe('Containers -- card antes de "Verificar compatibilidade"', () => {
  it('não oferece "Executar avaliação" antes de checar compatibilidade', async () => {
    const apiFetch = makeApiFetch()
    render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
    await waitFor(() => screen.getByRole('heading', { name: headingMatcher('Containers (1)') }))
    await waitFor(() => screen.getByText('tamois'))

    expect(screen.queryByText('Executar avaliação →')).toBeNull()
    // A checagem em si não deve ter sido disparada automaticamente.
    expect(apiFetch.mock.calls.some(([path]) => path.endsWith('/check'))).toBe(false)
  })

  it('não repete a dica de compatibilidade por card', async () => {
    const containers = ['tamois', 'babybet', 'redis'].map((name) => ({ name, image: `${name}-img` }))
    const apiFetch = makeApiFetch({ containers })
    render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
    await waitFor(() => screen.getByRole('heading', { name: headingMatcher('Containers (3)') }))
    await waitFor(() => containers.forEach((c) => screen.getByText(c.name)))

    // A dica de compatibilidade existe uma vez só, no FlowGuide -- nenhum
    // card individual deve repeti-la.
    expect(document.querySelectorAll('.target-card p').length).toBe(0)
  })
})

describe('Containers -- mini-tutorial do fluxo', () => {
  it('aparece uma única vez, antes e depois de verificar compatibilidade', async () => {
    const containers = ['tamois', 'babybet', 'redis'].map((name) => ({ name, image: `${name}-img` }))
    const apiFetch = makeApiFetch({ containers })
    render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
    await waitFor(() => screen.getByRole('heading', { name: headingMatcher('Containers (3)') }))
    expect(document.querySelectorAll('.flow-guide').length).toBe(1)

    fireEvent.click(screen.getByText('Verificar compatibilidade'))
    await waitFor(() => containers.forEach((c) => screen.getByText(c.name)))
    expect(document.querySelectorAll('.flow-guide').length).toBe(1)
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

  it('continua desabilitado quando só 1 container foi avaliado com sucesso', async () => {
    await renderCheckedMultiple(['tamois'])
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText(/Executar selecionados/))

    await waitFor(() => {
      const btn = screen.getByText('Exportar relatório consolidado')
      if (!btn.title.includes('pelo menos dois')) throw new Error('avaliação ainda não terminou')
    })

    const exportBtn = screen.getByText('Exportar relatório consolidado')
    expect(exportBtn.disabled).toBe(true)
  })

  it('habilita quando 2 containers avulsos (não em lote) foram avaliados e selecionados', async () => {
    await renderCheckedMultiple(['tamois', 'babybet'])

    fireEvent.click(screen.getByText('tamois').closest('.target-card').querySelector('.link-btn'))
    await waitFor(() => screen.getByText('← Back'))
    fireEvent.click(screen.getByText('← Back'))

    fireEvent.click(screen.getByText('babybet').closest('.target-card').querySelector('.link-btn'))
    await waitFor(() => screen.getByText('← Back'))
    fireEvent.click(screen.getByText('← Back'))

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    const exportBtn = screen.getByText('Exportar relatório consolidado')
    expect(exportBtn.disabled).toBe(false)
  })

  it('habilita quando o lote executado teve 2 ou mais containers', async () => {
    await renderCheckedMultiple(['tamois', 'babybet'])
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText(/Executar selecionados/))

    await waitFor(() => {
      const btn = screen.getByText('Exportar relatório consolidado')
      expect(btn.disabled).toBe(false)
    })
  })

  it('desmarcar um container já avaliado desabilita de novo (seleção viva, não lote congelado)', async () => {
    await renderCheckedMultiple(['tamois', 'babybet'])
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText(/Executar selecionados/))

    await waitFor(() => {
      const btn = screen.getByText('Exportar relatório consolidado')
      expect(btn.disabled).toBe(false)
    })

    fireEvent.click(checkboxes[0])

    const exportBtn = screen.getByText('Exportar relatório consolidado')
    expect(exportBtn.disabled).toBe(true)
  })

  it('exporta só os containers selecionados agora, não todos os já avaliados', async () => {
    // jsdom não implementa URL.createObjectURL -- sem isso o download real
    // (irrelevante pro que este teste verifica) lançaria e cairia no
    // window.alert() de erro, também não implementado pelo jsdom.
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} })

    const apiFetch = await renderCheckedMultiple(['tamois', 'babybet', 'redis'])
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach((cb) => fireEvent.click(cb))
    fireEvent.click(screen.getByText(/Executar selecionados/))
    await waitFor(() => {
      const btn = screen.getByText('Exportar relatório consolidado')
      expect(btn.disabled).toBe(false)
    })

    // Desmarca "redis" -- só tamois e babybet devem ir no relatório.
    fireEvent.click(checkboxes[2])

    fireEvent.click(screen.getByText('Exportar relatório consolidado'))
    await waitFor(() => {
      const call = apiFetch.mock.calls.find(([path]) => path === '/api/reports/pdf')
      if (!call) throw new Error('export ainda não chamou a API')
    })

    const call = apiFetch.mock.calls.find(([path]) => path === '/api/reports/pdf')
    const body = JSON.parse(call[1].body)
    expect(body.assets.map((a) => a.name).sort()).toEqual(['babybet', 'tamois'])
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

describe('Containers -- modo visitante (demo pública, sem sessão)', () => {
  it('busca /demo-snapshot, nunca /api/containers', async () => {
    const apiFetch = makeVisitorApiFetch({
      containers: [{ name: 'app-frontend', image: 'registry.example.com/demo-enterprise/frontend:2.4.1', findings: [] }],
    })
    render(<Containers apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('app-frontend'))

    expect(apiFetch.mock.calls.some(([path]) => path === '/demo-snapshot')).toBe(true)
    expect(apiFetch.mock.calls.some(([path]) => path === '/api/containers')).toBe(false)
  })

  it('mostra o aviso de ambiente demonstrativo', async () => {
    const apiFetch = makeVisitorApiFetch()
    render(<Containers apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText(/Ambiente demonstrativo/))
  })

  it('não mostra nenhum botão de ação operacional', async () => {
    const apiFetch = makeVisitorApiFetch({
      containers: [{ name: 'app-frontend', image: 'registry.example.com/demo-enterprise/frontend:2.4.1', findings: [] }],
    })
    render(<Containers apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('app-frontend'))

    expect(screen.queryByText('Verificar compatibilidade')).toBeNull()
    expect(screen.queryByText(/Executar selecionados/)).toBeNull()
    expect(screen.queryByText('Exportar relatório consolidado')).toBeNull()
    expect(screen.queryByText('Publicar como demo')).toBeNull()
    expect(screen.queryByText('Sair')).toBeNull()
  })

  it('mostra "Entrar" em vez de usuário/Sair, e aciona onRequestLogin', async () => {
    const apiFetch = makeVisitorApiFetch()
    const onRequestLogin = vi.fn()
    render(<Containers apiFetch={apiFetch} isVisitor onRequestLogin={onRequestLogin} />)

    await waitFor(() => screen.getByText('Entrar'))
    fireEvent.click(screen.getByText('Entrar'))

    expect(onRequestLogin).toHaveBeenCalled()
  })

  it('sem nenhuma demo publicada, mostra mensagem amigável', async () => {
    const apiFetch = makeVisitorApiFetch({ containers: [] })
    render(<Containers apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('Nenhuma demo publicada no momento.'))
  })

  it('"Ver relatório →" abre os findings do snapshot sem chamar /api/assess', async () => {
    const findings = [
      {
        target: 'app-frontend',
        external_id: '5.1.20',
        status: 'FAIL',
        control_title: 'Ensure sshd PermitRootLogin is disabled',
        source_name: 'cis',
        document_name: 'debian_linux_12',
        document_version: '2.0.0',
        evidence_output: 'PermitRootLogin yes',
        level: 1,
        scored: true,
      },
    ]
    const apiFetch = makeVisitorApiFetch({
      containers: [{ name: 'app-frontend', image: 'registry.example.com/demo-enterprise/frontend:2.4.1', findings }],
    })
    render(<Containers apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('app-frontend'))
    fireEvent.click(screen.getByText('Ver relatório →'))

    await waitFor(() => screen.getByText('1 FAIL'))
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith('/api/assess/'))).toBe(false)
  })

  it('mostra "Ver relatório consolidado" só com 2+ containers, sem chamar /api/reports/pdf', async () => {
    vi.stubGlobal('open', vi.fn())
    const apiFetch = makeVisitorApiFetch({
      containers: [
        { name: 'app-frontend', image: 'registry.example.com/demo-enterprise/frontend:2.4.1', findings: [] },
        { name: 'app-backend', image: 'registry.example.com/demo-enterprise/backend:1.9.3', findings: [] },
      ],
    })
    render(<Containers apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('Ver relatório consolidado'))
    fireEvent.click(screen.getByText('Ver relatório consolidado'))

    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('/demo-snapshot/report?kind=consolidated'), '_blank', 'noopener')
    expect(apiFetch.mock.calls.some(([path]) => path === '/api/reports/pdf')).toBe(false)
  })
})

describe('Containers -- painel admin de publicação da demo', () => {
  it('"Publicar como demo" fica desabilitado sem nenhum assessment de sucesso', async () => {
    await renderCheckedContainers()

    const publishBtn = screen.getByText('Publicar como demo')
    expect(publishBtn.disabled).toBe(true)
  })

  it('preview limpo mostra os containers com alias e o botão de confirmar', async () => {
    const apiFetch = await renderCheckedContainers()
    apiFetch.mockImplementation(
      makeApiFetch({
        previewResult: {
          ok: true,
          containers: [{ name: 'app-frontend', image: 'registry.example.com/demo-enterprise/frontend:2.4.1', findings: [] }],
          issues: [],
          unverified_container_ids: [],
        },
      }),
    )
    fireEvent.click(screen.getByText('Executar avaliação →'))
    await waitFor(() => screen.getByText('← Back'))
    fireEvent.click(screen.getByText('← Back'))

    fireEvent.click(screen.getByText('Publicar como demo'))

    await waitFor(() => screen.getByText('Confirmar publicação'))
    screen.getByText(/app-frontend/)
  })

  it('preview com issues não mostra botão de confirmar', async () => {
    const containers = [{ name: 'tamois', image: 'tamois-img', id: 'real-id-1' }]
    const apiFetch = vi.fn(async (path) => {
      if (path === '/api/containers') return { ok: true, json: async () => containers }
      if (path.endsWith('/check')) return { ok: true, json: async () => ({ testable: true, os_id: 'debian', os_version_id: '12', reason: null }) }
      if (path.startsWith('/api/assess/')) return { ok: true, json: async () => [] }
      if (path === '/demo-snapshot/preview') {
        return {
          ok: true,
          json: async () => ({
            ok: false,
            containers: [],
            issues: [{ field: 'containers[0].findings[0].evidence_output', category: 'container_name' }],
            unverified_container_ids: [],
          }),
        }
      }
      return { ok: true, json: async () => ({}) }
    })
    render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
    await waitFor(() => screen.getByRole('heading', { name: headingMatcher('Containers (1)') }))
    fireEvent.click(screen.getByText('Verificar compatibilidade'))
    await waitFor(() => screen.getByText('tamois'))
    fireEvent.click(screen.getByText('Executar avaliação →'))
    await waitFor(() => screen.getByText('← Back'))
    fireEvent.click(screen.getByText('← Back'))

    fireEvent.click(screen.getByText('Publicar como demo'))

    await waitFor(() => screen.getByText(/identificadores do ambiente real/))
    expect(screen.queryByText('Confirmar publicação')).toBeNull()
    screen.getByText(/container_name/)
  })

  it('manda só container_id + findings no payload de publish (nunca name/image)', async () => {
    const findings = [{ target: 'tamois', external_id: '5.1.20', status: 'FAIL' }]
    const containers = [{ name: 'tamois', image: 'tamois-img', id: 'real-id-1' }]
    const apiFetch = vi.fn(async (path) => {
      if (path === '/api/containers') return { ok: true, json: async () => containers }
      if (path.endsWith('/check')) return { ok: true, json: async () => ({ testable: true, os_id: 'debian', os_version_id: '12', reason: null }) }
      if (path.startsWith('/api/assess/')) return { ok: true, json: async () => findings }
      if (path === '/demo-snapshot/preview') return { ok: true, json: async () => ({ ok: true, containers: [], issues: [], unverified_container_ids: [] }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
    await waitFor(() => screen.getByRole('heading', { name: headingMatcher('Containers (1)') }))
    fireEvent.click(screen.getByText('Verificar compatibilidade'))
    await waitFor(() => screen.getByText('tamois'))
    fireEvent.click(screen.getByText('Executar avaliação →'))
    await waitFor(() => screen.getByText('← Back'))
    fireEvent.click(screen.getByText('← Back'))

    fireEvent.click(screen.getByText('Publicar como demo'))

    await waitFor(() => expect(apiFetch.mock.calls.some(([path]) => path === '/demo-snapshot/preview')).toBe(true))
    const call = apiFetch.mock.calls.find(([path]) => path === '/demo-snapshot/preview')
    const body = JSON.parse(call[1].body)
    expect(body).toEqual({ containers: [{ container_id: 'real-id-1', findings }] })
  })

  it('"Despublicar demo" chama /demo-snapshot/revoke e mostra confirmação', async () => {
    const apiFetch = await renderCheckedContainers()

    fireEvent.click(screen.getByText('Despublicar demo'))

    await waitFor(() => screen.getByText(/Demo despublicada/))
    expect(apiFetch.mock.calls.some(([path, options]) => path === '/demo-snapshot/revoke' && options?.method === 'POST')).toBe(true)
  })

  it('"Despublicar demo" limpa um erro de publicação anterior, em vez de empilhar as duas mensagens', async () => {
    // Reproduz o bug relatado: um 413/422 de "Publicar como demo" que
    // ficava na tela ao mesmo tempo que a confirmação de "Despublicar
    // demo" seguinte, parecendo que a segunda ação também tinha falhado.
    const containers = [{ name: 'tamois', image: 'tamois-img', id: 'real-id-1' }]
    const apiFetch = vi.fn(async (path) => {
      if (path === '/api/containers') return { ok: true, json: async () => containers }
      if (path.endsWith('/check')) return { ok: true, json: async () => ({ testable: true, os_id: 'debian', os_version_id: '12', reason: null }) }
      if (path.startsWith('/api/assess/')) return { ok: true, json: async () => [] }
      if (path === '/demo-snapshot/preview') return { ok: false, status: 413, json: async () => ({}) }
      if (path === '/demo-snapshot/revoke') return { ok: true, json: async () => ({ status: 'revoked' }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<Containers apiFetch={apiFetch} username="admin" onLogout={() => {}} />)
    await waitFor(() => screen.getByRole('heading', { name: headingMatcher('Containers (1)') }))
    fireEvent.click(screen.getByText('Verificar compatibilidade'))
    await waitFor(() => screen.getByText('tamois'))
    fireEvent.click(screen.getByText('Executar avaliação →'))
    await waitFor(() => screen.getByText('← Back'))
    fireEvent.click(screen.getByText('← Back'))

    fireEvent.click(screen.getByText('Publicar como demo'))
    await waitFor(() => screen.getByText('HTTP 413'))

    fireEvent.click(screen.getByText('Despublicar demo'))
    await waitFor(() => screen.getByText(/Demo despublicada/))

    expect(screen.queryByText('HTTP 413')).toBeNull()
  })
})
