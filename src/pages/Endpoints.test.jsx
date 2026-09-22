// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Endpoints from './Endpoints.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function makeApiFetch({
  endpoints = [],
  bulkResult = [],
  results = [],
  checkResult = {},
  findings = [],
  previewResult = null,
  publishResult = null,
} = {}) {
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
    if (/\/api\/endpoints\/\d+\/check$/.test(path)) {
      return {
        ok: true,
        json: async () => ({ testable: true, os_id: 'debian', os_version_id: '12', reason: null, ...checkResult }),
      }
    }
    if (/\/api\/endpoints\/\d+\/assess$/.test(path)) {
      return { ok: true, json: async () => findings }
    }
    if (path === '/api/demo-host-snapshot/preview') {
      return {
        ok: true,
        json: async () =>
          previewResult ?? { ok: true, hosts: [], issues: [], unverified_endpoint_ids: [], not_demo_endpoint_ids: [], redaction_issues: [] },
      }
    }
    if (path === '/api/demo-host-snapshot/publish') {
      if (publishResult?.status === 'error') {
        return { ok: false, status: 422, json: async () => ({ detail: { message: publishResult.message } }) }
      }
      return { ok: true, json: async () => ({ status: 'published' }) }
    }
    if (path === '/api/demo-host-snapshot/revoke') {
      return { ok: true, json: async () => (publishResult?.revoke ?? { status: 'revoked' }) }
    }
    return { ok: true, json: async () => ({}) }
  })
}

function makeVisitorApiFetch({ hosts = [] } = {}) {
  return vi.fn(async (path) => {
    if (path === '/demo-host-snapshot') {
      return { ok: true, json: async () => ({ published_at: hosts.length ? '2026-09-20T00:00:00Z' : null, hosts }) }
    }
    return { ok: true, json: async () => ({}) }
  })
}

function headingMatcher(text) {
  return (name) => name.replace(/\s+/g, '') === text.replace(/\s+/g, '')
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

// Roda uma avaliação completa contra o único endpoint identificado
// (classification truthy) da lista -- pré-requisito de "Executar
// avaliação →" no card, mesma disciplina de Check/assess do console real.
async function renderAssessedEndpoint(options) {
  const apiFetch = await renderEndpoints(options)
  fireEvent.click(screen.getByText('Executar avaliação →'))
  await waitFor(() => screen.getByLabelText('Usuário'))
  fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'demo-lab' } })
  fireEvent.click(screen.getByRole('button', { name: 'Senha' }))
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'x' } })
  fireEvent.click(screen.getByText('Executar avaliação'))
  await waitFor(() => screen.getByText('← Back'))
  fireEvent.click(screen.getByText('← Back'))
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

describe('Endpoints -- separação visual Ambiente demonstrativo/operacional', () => {
  it('agrupa hosts demo e operacionais em seções separadas, por endpoint.is_demo', async () => {
    const endpoints = [
      { id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true },
      { id: 2, address: '10.0.0.5', label: 'prod-db', tags: [], classification: 'linux', confidence: 1, is_demo: false },
    ]
    await renderEndpoints({ endpoints })

    screen.getByRole('heading', { name: headingMatcher('Ambiente demonstrativo (1)') })
    screen.getByRole('heading', { name: headingMatcher('Ambiente operacional (1)') })
    screen.getByText('10.89.77.11')
    screen.getByText('10.0.0.5')
  })

  it('não mostra a seção operacional quando todo host é demo', async () => {
    const endpoints = [{ id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true }]
    await renderEndpoints({ endpoints })

    screen.getByRole('heading', { name: headingMatcher('Ambiente demonstrativo (1)') })
    expect(screen.queryByText(/Ambiente operacional/)).toBeNull()
  })
})

describe('Endpoints -- modo visitante (demo pública, sem sessão)', () => {
  it('busca /demo-host-snapshot, nunca /api/endpoints', async () => {
    const apiFetch = makeVisitorApiFetch({
      hosts: [{ name: 'web-prod-03.internal', address: '192.0.2.11', findings: [] }],
    })
    render(<Endpoints apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('web-prod-03.internal'))

    expect(apiFetch.mock.calls.some(([path]) => path === '/demo-host-snapshot')).toBe(true)
    expect(apiFetch.mock.calls.some(([path]) => path === '/api/endpoints')).toBe(false)
  })

  it('mostra o aviso de ambiente demonstrativo', async () => {
    const apiFetch = makeVisitorApiFetch()
    render(<Endpoints apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText(/Ambiente demonstrativo/))
  })

  it('não mostra nenhum botão de ação operacional nem formulário de credenciais', async () => {
    const apiFetch = makeVisitorApiFetch({
      hosts: [{ name: 'web-prod-03.internal', address: '192.0.2.11', findings: [] }],
    })
    render(<Endpoints apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('web-prod-03.internal'))

    expect(screen.queryByText('Descobrir →')).toBeNull()
    expect(screen.queryByText('Publicar como demo')).toBeNull()
    expect(screen.queryByLabelText('Usuário')).toBeNull()
    expect(screen.queryByText('Sair')).toBeNull()
  })

  it('mostra "Entrar" em vez de usuário/Sair, e aciona onRequestLogin', async () => {
    const apiFetch = makeVisitorApiFetch()
    const onRequestLogin = vi.fn()
    render(<Endpoints apiFetch={apiFetch} isVisitor onRequestLogin={onRequestLogin} />)

    await waitFor(() => screen.getByText('Entrar'))
    fireEvent.click(screen.getByText('Entrar'))

    expect(onRequestLogin).toHaveBeenCalled()
  })

  it('sem nenhuma demo publicada, mostra mensagem amigável', async () => {
    const apiFetch = makeVisitorApiFetch({ hosts: [] })
    render(<Endpoints apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('Nenhuma demo publicada no momento.'))
  })

  it('"Ver relatório →" abre os findings do snapshot sem chamar /api/endpoints/{id}/assess', async () => {
    const findings = [
      {
        target: 'web-prod-03.internal',
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
      hosts: [{ name: 'web-prod-03.internal', address: '192.0.2.11', findings }],
    })
    render(<Endpoints apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('web-prod-03.internal'))
    fireEvent.click(screen.getByText('Ver relatório →'))

    await waitFor(() => screen.getByText('1 FAIL'))
    expect(apiFetch.mock.calls.some(([path]) => /\/api\/endpoints\/\d+\/assess$/.test(path))).toBe(false)
  })

  it('mostra "Ver relatório consolidado" só com 2+ hosts, sem chamar /api/reports/pdf', async () => {
    vi.stubGlobal('open', vi.fn())
    const apiFetch = makeVisitorApiFetch({
      hosts: [
        { name: 'web-prod-03.internal', address: '192.0.2.11', findings: [] },
        { name: 'app-prod-07.internal', address: '192.0.2.12', findings: [] },
      ],
    })
    render(<Endpoints apiFetch={apiFetch} isVisitor onRequestLogin={() => {}} />)

    await waitFor(() => screen.getByText('Ver relatório consolidado'))
    fireEvent.click(screen.getByText('Ver relatório consolidado'))

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('/demo-host-snapshot/report?kind=consolidated'),
      '_blank',
      'noopener',
    )
    expect(apiFetch.mock.calls.some(([path]) => path === '/api/reports/pdf')).toBe(false)
  })
})

describe('Endpoints -- painel admin de publicação da demo', () => {
  it('"Publicar como demo" fica desabilitado sem nenhum assessment de sucesso', async () => {
    const endpoints = [{ id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true }]
    await renderEndpoints({ endpoints })

    const publishBtn = screen.getByText('Publicar como demo')
    expect(publishBtn.disabled).toBe(true)
  })

  it('avaliar com sucesso um host sem is_demo não habilita "Publicar como demo" (só ativos do Ambiente demonstrativo entram no lote)', async () => {
    const endpoints = [{ id: 1, address: '10.0.0.5', label: 'prod-db', tags: [], classification: 'linux', confidence: 1, is_demo: false }]
    await renderAssessedEndpoint({ endpoints })

    const publishBtn = screen.getByText('Publicar como demo')
    expect(publishBtn.disabled).toBe(true)
  })

  it('preview limpo mostra os hosts com alias e o botão de confirmar', async () => {
    const endpoints = [{ id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true }]
    const apiFetch = await renderAssessedEndpoint({ endpoints })
    apiFetch.mockImplementation(
      makeApiFetch({
        endpoints,
        previewResult: {
          ok: true,
          hosts: [{ name: 'web-prod-03.internal', address: '192.0.2.11', findings: [] }],
          issues: [],
          unverified_endpoint_ids: [],
          not_demo_endpoint_ids: [],
          redaction_issues: [],
        },
      }),
    )

    fireEvent.click(screen.getByText('Publicar como demo'))

    await waitFor(() => screen.getByText('Confirmar publicação'))
    screen.getByText(/web-prod-03.internal/)
  })

  it('preview com issues não mostra botão de confirmar', async () => {
    const endpoints = [{ id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true }]
    await renderAssessedEndpoint({
      endpoints,
      previewResult: {
        ok: false,
        hosts: [],
        issues: [{ field: 'hosts[0].findings[0].evidence_output', category: 'endpoint_address' }],
        unverified_endpoint_ids: [],
        not_demo_endpoint_ids: [],
        redaction_issues: [],
      },
    })

    fireEvent.click(screen.getByText('Publicar como demo'))

    await waitFor(() => screen.getByText(/identificadores do ambiente real/))
    expect(screen.queryByText('Confirmar publicação')).toBeNull()
    screen.getByText(/endpoint_address/)
  })

  it('preview com falha de redaction mostra mensagem distinta, sem misturar com "issues"', async () => {
    const endpoints = [{ id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true }]
    await renderAssessedEndpoint({
      endpoints,
      previewResult: {
        ok: false,
        hosts: [],
        issues: [],
        unverified_endpoint_ids: [],
        not_demo_endpoint_ids: [],
        redaction_issues: [{ field: 'hosts[0].findings[0].evidence_output', category: 'redaction_incomplete' }],
      },
    })

    fireEvent.click(screen.getByText('Publicar como demo'))

    await waitFor(() => screen.getByText(/a própria sanitização falhou/))
    expect(screen.queryByText('Confirmar publicação')).toBeNull()
    expect(screen.queryByText(/identificadores do ambiente real/)).toBeNull()
    screen.getByText(/redaction_incomplete/)
  })

  it('manda só endpoint_id + findings no payload de publish (nunca address/label)', async () => {
    const findings = [{ target: 'demo-host-web-01', external_id: '5.1.20', status: 'FAIL' }]
    const endpoints = [{ id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true }]
    const apiFetch = await renderAssessedEndpoint({ endpoints, findings })

    fireEvent.click(screen.getByText('Publicar como demo'))

    await waitFor(() => expect(apiFetch.mock.calls.some(([path]) => path === '/api/demo-host-snapshot/preview')).toBe(true))
    const call = apiFetch.mock.calls.find(([path]) => path === '/api/demo-host-snapshot/preview')
    const body = JSON.parse(call[1].body)
    expect(body).toEqual({ hosts: [{ endpoint_id: 1, findings }] })
  })

  it('"Despublicar demo" chama /api/demo-host-snapshot/revoke e mostra confirmação', async () => {
    const endpoints = [{ id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true }]
    const apiFetch = await renderEndpoints({ endpoints })

    fireEvent.click(screen.getByText('Despublicar demo'))

    await waitFor(() => screen.getByText(/Demo despublicada/))
    expect(apiFetch.mock.calls.some(([path, options]) => path === '/api/demo-host-snapshot/revoke' && options?.method === 'POST')).toBe(true)
  })

  it('"Despublicar demo" limpa um erro de publicação anterior, em vez de empilhar as duas mensagens', async () => {
    const endpoints = [{ id: 1, address: '10.89.77.11', label: 'demo-host-web-01', tags: [], classification: 'linux', confidence: 1, is_demo: true }]
    const apiFetch = await renderAssessedEndpoint({ endpoints })
    apiFetch.mockImplementation(async (path, options = {}) => {
      if (path === '/api/demo-host-snapshot/preview') return { ok: false, status: 413, json: async () => ({}) }
      if (path === '/api/demo-host-snapshot/revoke') return { ok: true, json: async () => ({ status: 'revoked' }) }
      if (path === '/api/endpoints' && (!options.method || options.method === 'GET')) return { ok: true, json: async () => endpoints }
      return { ok: true, json: async () => ({}) }
    })

    fireEvent.click(screen.getByText('Publicar como demo'))
    await waitFor(() => screen.getByText('HTTP 413'))

    fireEvent.click(screen.getByText('Despublicar demo'))
    await waitFor(() => screen.getByText(/Demo despublicada/))

    expect(screen.queryByText('HTTP 413')).toBeNull()
  })
})
