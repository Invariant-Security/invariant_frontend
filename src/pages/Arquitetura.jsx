import { useEffect, useState } from 'react'
import { useDocumentLang } from '../hooks/useDocumentLang.js'
import './Legal.css'
import './Arquitetura.css'

// Versão PÚBLICA da arquitetura: descreve o produto como ele roda no
// ambiente do cliente (appliance on-premises). De propósito NÃO cita a
// infraestrutura que hospeda invariantsec.org (provedor, proxy, rede,
// pontos fracos conhecidos), rotas internas da API nem modelo de negócio --
// a versão completa existe só fora deste repositório público, servida em
// teste.invariantsec.org atrás do Cloudflare Access. Arquitetura.test.jsx
// falha se algum desses termos internos aparecer aqui.

export const DIAGRAMS = {
  mapa: `flowchart LR
  user["Equipe de segurança<br/>(navegador)"]
  subgraph CLIENTE["Ambiente do cliente · instalação on-premises"]
    web["Console<br/>invariant_frontend"]
    api["Orquestrador<br/>invariant_api"]
    db[("Banco de dados<br/>PostgreSQL")]
    disc["Descoberta<br/>invariant_discovery"]
    asm["Avaliação CIS<br/>invariant_assessment"]
    ing["Base de controles<br/>invariant_ingestion"]
    alvos["Servidores avaliados<br/>Linux e containers"]
  end
  cis[("CIS Benchmarks<br/>documentos públicos")]
  user --> web --> api
  api --> db
  api --> disc & asm & ing
  disc -- "identifica cada host" --> alvos
  asm -- "coleta via SSH ou Docker" --> alvos
  ing -- "baixa os benchmarks" --> cis`,
  fluxo: `sequenceDiagram
  autonumber
  actor U as Equipe de segurança
  participant C as Console
  participant O as Orquestrador
  participant D as Descoberta
  participant A as Avaliação CIS
  participant H as Servidor avaliado
  U->>C: informa um IP ou uma faixa de rede
  C->>O: cadastra o alvo
  O->>D: pede a descoberta
  D->>H: testa portas e assinaturas de serviço
  D-->>O: tipo de cada host (Linux, Docker...)
  U->>C: pede a avaliação
  O->>A: envia o alvo e a credencial de acesso
  A->>H: coleta a configuração (somente leitura)
  A-->>O: resultado de cada controle, com evidência
  O->>O: cruza com a base de controles CIS
  O-->>C: achados e recomendações
  U->>C: gera o relatório em PDF`,
}

const COMPONENTS = [
  ['invariant_frontend', 'React · Vite', 'O console: onde a equipe cadastra os alvos, acompanha as avaliações e baixa os relatórios.'],
  ['invariant_api', 'Python · FastAPI · PostgreSQL', 'O orquestrador. Único componente com acesso ao banco: guarda alvos e resultados, coordena os demais serviços e gera os relatórios em PDF.'],
  ['invariant_discovery', 'Python · FastAPI', 'Recebe um IP ou uma faixa de rede e identifica o tipo de cada host por portas e assinaturas de serviço, sem ferramentas invasivas.'],
  ['invariant_assessment', 'Python · FastAPI · SSH', 'Coleta a configuração de cada servidor, em modo somente leitura, e avalia cada controle CIS implementado, com a evidência encontrada.'],
  ['invariant_ingestion', 'Python · FastAPI', 'Transforma os documentos públicos de benchmark da CIS em uma base estruturada de controles, com a versão de cada documento.'],
  ['invariant_contracts', 'Python · Pydantic', 'Os formatos de dados compartilhados por todos os serviços, para que achados e alvos tenham sempre a mesma estrutura.'],
  ['invariant_packaging', 'Pacote .deb · systemd', 'O instalador: coloca todos os componentes no servidor do cliente com um único pacote.'],
]

const PRINCIPLES = [
  ['Tudo roda no seu ambiente', 'O Invariant é instalado em um servidor seu. Os resultados e a configuração dos seus servidores ficam no seu banco de dados.'],
  ['Coleta somente leitura', 'A avaliação lê a configuração dos servidores e não altera nada neles.'],
  ['Credenciais não ficam guardadas', 'A credencial de acesso a um servidor é usada durante a avaliação e não é armazenada no banco.'],
  ['Um serviço, uma função', 'Descoberta, avaliação e base de controles são serviços separados. Só o orquestrador acessa o banco.'],
]

function Diagram({ id, code, svg }) {
  return (
    <div className="arq-diagram">
      {svg ? (
        <div className="arq-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <pre className="arq-source" aria-label={`Diagrama ${id}`}>
          {code}
        </pre>
      )}
    </div>
  )
}

export default function Arquitetura() {
  useDocumentLang('pt-BR')
  const [svgs, setSvgs] = useState({})

  useEffect(() => {
    let cancelled = false
    // mermaid só é carregado nesta página (chunk próprio). Se falhar, o
    // diagrama continua legível como texto. Espera a Manrope carregar antes
    // de desenhar: o mermaid mede o texto para dimensionar cada caixa, e
    // medir com a fonte de fallback corta os rótulos depois que a Manrope
    // entra.
    const fontsReady = document.fonts
      ? Promise.all([document.fonts.load('400 16px Manrope'), document.fonts.ready]).catch(() => {})
      : Promise.resolve()
    fontsReady
      .then(() => import('mermaid'))
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            fontFamily: 'Manrope, system-ui, sans-serif',
            primaryColor: '#e3f5ef',
            primaryBorderColor: '#05a67c',
            primaryTextColor: '#0b2842',
            lineColor: '#33506b',
            clusterBkg: '#ffffff',
            clusterBorder: '#d9d3c4',
            actorBkg: '#e3f5ef',
            actorBorder: '#05a67c',
          },
        })
        const out = {}
        for (const [key, code] of Object.entries(DIAGRAMS)) {
          const { svg } = await mermaid.render(`arq-${key}`, code)
          out[key] = svg
        }
        if (!cancelled) setSvgs(out)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="legal-shell">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;800&display=swap"
      />
      <header className="legal-header">
        <a className="wordmark" href="/">
          Invariant
        </a>
        <a className="legal-back-link" href="/">
          ← Voltar
        </a>
      </header>

      <main className="legal-main arq-main">
        <p className="eyebrow">Como funciona</p>
        <h1>Arquitetura do Invariant</h1>
        <p className="arq-lead">
          O Invariant é um conjunto de serviços pequenos, cada um com uma função, instalados no ambiente do próprio
          cliente.
        </p>

        <section>
          <h2>Visão geral</h2>
          <Diagram id="mapa" code={DIAGRAMS.mapa} svg={svgs.mapa} />
        </section>

        <section>
          <h2>Princípios</h2>
          <div className="arq-grid arq-grid-2">
            {PRINCIPLES.map(([title, text]) => (
              <article key={title} className="arq-card">
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>Componentes</h2>
          <div className="arq-grid">
            {COMPONENTS.map(([name, stack, text]) => (
              <article key={name} className="arq-card">
                <h3>
                  <code>{name}</code>
                </h3>
                <p className="arq-stack">{stack}</p>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>Uma avaliação, passo a passo</h2>
          <Diagram id="fluxo" code={DIAGRAMS.fluxo} svg={svgs.fluxo} />
        </section>
      </main>

      <footer className="legal-footer">
        <div className="footer-brand">Invariant</div>
        <p>
          <a href="/">Página inicial</a> · <a href="/privacidade">Privacidade</a> · <a href="/termos">Termos de Uso</a>
        </p>
      </footer>
    </div>
  )
}
