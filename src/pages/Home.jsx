import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Layers3,
  Menu,
  ScanSearch,
  X,
} from '../components/icons.jsx'
import { useDocumentLang } from '../hooks/useDocumentLang.js'
import { useScrollReveal } from '../hooks/useScrollReveal.js'
import './Home.css'

// Overridable via VITE_API_BASE, same convention as Demo.jsx.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

function SectionHeader({ index, eyebrow, title, body }) {
  const ref = useScrollReveal()
  return (
    <div className="section-header reveal" ref={ref}>
      <div className="evidence-index">{index}</div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p className="section-body">{body}</p>
    </div>
  )
}

const TARGET_SCOPE_OPTIONS = [
  { value: 'linux', label: 'Linux' },
  { value: 'containers', label: 'Containers' },
  { value: 'linux_containers', label: 'Linux + Containers' },
]
const ENVIRONMENT_SIZE_OPTIONS = [
  { value: '1_10', label: '1–10' },
  { value: '11_50', label: '11–50' },
  { value: '51_100', label: '51–100' },
  { value: '100_plus', label: 'Mais de 100' },
  { value: 'evaluating', label: 'Ainda estou avaliando' },
]
const PRIMARY_NEED_OPTIONS = [
  { value: 'compliance_cis', label: 'Conformidade / CIS' },
  { value: 'audit', label: 'Auditoria' },
  { value: 'evidence', label: 'Evidências' },
  { value: 'hardening', label: 'Hardening' },
  { value: 'devsecops', label: 'DevSecOps' },
  { value: 'other', label: 'Outro' },
]

function LeadForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [targetScope, setTargetScope] = useState('')
  const [environmentSize, setEnvironmentSize] = useState('')
  const [primaryNeed, setPrimaryNeed] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot -- humano nunca preenche
  const [state, setState] = useState('idle') // idle | loading | success | error

  async function submit(event) {
    event.preventDefault()
    setState('loading')
    try {
      const response = await fetch(`${API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          role: role || null,
          target_scope: targetScope,
          environment_size: environmentSize || null,
          primary_need: primaryNeed || null,
          message: message || null,
          website,
        }),
      })
      if (!response.ok) throw new Error()
      setState('success')
    } catch {
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <p className="lead-form-status">
        Recebemos seus dados. Nosso time entrará em contato para entender seu ambiente e apresentar o Invariant.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="lead-form">
      <label>
        Nome*
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        E-mail corporativo*
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        Empresa*
        <input value={company} onChange={(event) => setCompany(event.target.value)} required />
      </label>
      <label>
        Cargo
        <input value={role} onChange={(event) => setRole(event.target.value)} />
      </label>
      <label>
        Interesse*
        <select value={targetScope} onChange={(event) => setTargetScope(event.target.value)} required>
          <option value="" disabled>
            Selecione
          </option>
          {TARGET_SCOPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Quantos ambientes Linux
        <select value={environmentSize} onChange={(event) => setEnvironmentSize(event.target.value)}>
          <option value="">Selecione</option>
          {ENVIRONMENT_SIZE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Principal necessidade
        <select value={primaryNeed} onChange={(event) => setPrimaryNeed(event.target.value)}>
          <option value="">Selecione</option>
          {PRIMARY_NEED_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mensagem
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
      </label>

      {/* Honeypot -- escondido da tela, humano nunca preenche */}
      <input
        type="text"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <p className="lead-form-privacy">Usaremos seus dados para responder ao seu contato comercial.</p>

      <button type="submit" className="primary-action" disabled={state === 'loading'}>
        {state === 'loading' ? 'Enviando...' : 'Falar com a Invariant'}
      </button>
      {state === 'error' && (
        <p className="lead-form-status lead-form-error">
          Não foi possível enviar seus dados. Tente novamente em alguns instantes.
        </p>
      )}
    </form>
  )
}

function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | loading | success | error

  async function submit(event) {
    event.preventDefault()
    setState('loading')
    try {
      const response = await fetch(`${API_BASE}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) throw new Error()
      setState('success')
    } catch {
      setState('error')
    }
  }

  return (
    <section className="newsletter-section">
      <div className="newsletter-copy">
        <p className="eyebrow">Fique por dentro</p>
        <h3>Receba novidades da Invariant</h3>
      </div>
      {state === 'success' ? (
        <p className="newsletter-status">Inscrição confirmada. Obrigado!</p>
      ) : (
        <form onSubmit={submit} className="newsletter-form">
          <input
            type="email"
            required
            placeholder="seu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="E-mail"
          />
          <button type="submit" className="primary-action" disabled={state === 'loading'}>
            {state === 'loading' ? 'Enviando...' : 'Inscrever'}
          </button>
        </form>
      )}
      {state === 'error' && <p className="newsletter-status newsletter-error">Não foi possível inscrever agora. Tente de novo.</p>}
    </section>
  )
}

export default function Home() {
  useDocumentLang('pt-BR')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setIsMenuOpen(false)
  }

  const thesisRef = useScrollReveal()
  const legacyRef = useScrollReveal()
  const positioningRef = useScrollReveal()

  return (
    <div className="research-shell">
      {/* React 19 hoists <link> rendered here to <head> and dedupes it --
          scoped to Home (lazy-loaded) so /demo never requests these fonts. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;800&display=swap"
      />
      <header className="site-header">
        <button className="brand-lockup" onClick={() => scrollTo('top')} aria-label="Voltar ao início">
          <span className="wordmark">Invariant</span>
        </button>

        <nav className="desktop-nav" aria-label="Navegação principal">
          <button onClick={() => scrollTo('como-funciona')}>Como funciona</button>
          <button onClick={() => scrollTo('mercado')}>Mercado</button>
          <button onClick={() => scrollTo('planos')}>Falar com a gente</button>
          <a href="/containers">Ver demo</a>
        </nav>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Abrir menu">
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {isMenuOpen && (
          <div className="mobile-nav">
            <button onClick={() => scrollTo('como-funciona')}>Como funciona</button>
            <button onClick={() => scrollTo('mercado')}>Mercado</button>
            <button onClick={() => scrollTo('planos')}>Falar com a gente</button>
            <a href="/containers">Ver demo</a>
          </div>
        )}
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-overlay" />
          <div className="hero-grid" />
          <div className="hero-content">
            <div className="hero-kicker">
              <span className="live-marker" /> AVALIAÇÃO DE HARDENING BASEADA EM EVIDÊNCIA
            </div>
            <h1>
              O que não se consegue <em>explicar</em>, não se consegue defender.
            </h1>
            <p className="hero-lead">
              A Invariant transforma configuração de infraestrutura crítica em evidência auditável — pra ambientes
              híbridos e legados que não podem parar.
            </p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => scrollTo('planos')}>
                Falar com a gente <ArrowDownRight size={18} />
              </button>
              <a className="secondary-action" href="/containers">
                Ver demo ao vivo <ExternalLink size={16} />
              </a>
            </div>
          </div>
          <div className="hero-evidence">
            <span className="evidence-label">EVIDÊNCIA PRINCIPAL</span>
            <p>Finding → Control → Source → Document Version</p>
          </div>
        </section>

        <section id="como-funciona" className="content-section thesis-section">
          <SectionHeader
            index="01"
            eyebrow="Como funciona"
            title="Hardening não termina em alerta. Termina em decisão, correção e evidência."
            body="A Invariant não é mais um scanner que gera alertas soltos — é a camada que torna cada finding explicável, rastreável e acionável."
          />
          <div className="thesis-layout reveal" ref={thesisRef}>
            <div className="thesis-card thesis-card-dark">
              <div className="card-label">
                <ScanSearch size={16} /> A DOR OPERACIONAL
              </div>
              <h3>Ativos críticos mudam. A evidência se perde.</h3>
              <p>
                Em ambientes legados e híbridos, uma configuração fora do padrão pode atravessar mudanças de
                equipe, ferramentas e prioridades sem uma trilha clara de decisão.
              </p>
              <div className="mini-rail">
                <span>desvio</span>
                <ChevronRight size={15} />
                <span>planilha</span>
                <ChevronRight size={15} />
                <span>incerteza</span>
              </div>
            </div>
            <div className="thesis-card thesis-card-light">
              <div className="card-label">
                <FileCheck2 size={16} /> A RESPOSTA DO PRODUTO
              </div>
              <h3>Uma cadeia que conecta regra, versão, ativo e correção.</h3>
              <p>
                A Invariant normaliza benchmarks em controles versionados e relaciona cada finding à fonte e à
                versão aplicável — do jeito que você já pode ver na demo ao vivo.
              </p>
              <div className="mini-rail green-rail">
                <span>benchmark</span>
                <ChevronRight size={15} />
                <span>controle</span>
                <ChevronRight size={15} />
                <span>evidência</span>
              </div>
            </div>
          </div>
        </section>

        <section className="proof-strip">
          <div className="strip-copy">
            <p className="eyebrow">O que existe hoje</p>
            <h2>Prova técnica, não promessa comercial.</h2>
          </div>
          <div className="proof-points">
            <div>
              <span>01</span>
              <p>
                <strong>CIS + Linux</strong> em demo pública de assessment.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Rastreabilidade</strong> entre finding, controle, fonte e versão.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>VMware ou Windows legado</strong> como próximas plataformas no roadmap.
              </p>
            </div>
          </div>
        </section>

        <section id="mercado" className="content-section market-section">
          <SectionHeader
            index="02"
            eyebrow="O contexto"
            title="O mercado brasileiro já paga por postura e compliance."
            body="Os números abaixo são um indicador de demanda macro, não uma promessa sobre o seu contrato — cada ambiente tem seu próprio caso de negócio."
          />
          <div className="market-stats">
            <div className="market-stat-block">
              <p className="stat-overline">MERCADO BRASILEIRO DE SEGURANÇA DA INFORMAÇÃO</p>
              <div className="market-number">R$ 104,6 bi</div>
              <p className="stat-description">
                Movimentação projetada entre <strong>2025 e 2028</strong>, segundo a Brasscom.
              </p>
            </div>
            <div className="market-stat-block">
              <p className="stat-overline">CRESCIMENTO ACUMULADO PROJETADO</p>
              <div className="market-number">+43,8%</div>
              <p className="stat-description">No mesmo período, mesma fonte.</p>
            </div>
          </div>
          <div className="market-warning">
            <CircleAlert size={18} />
            <span>
              <strong>Leitura correta:</strong> indicador macro de mercado, não uma estimativa do seu contrato.
            </span>
          </div>
        </section>

        <section className="legacy-section reveal" ref={legacyRef}>
          <div className="legacy-copy">
            <p className="eyebrow">POR QUE LEGADO É UMA CUNHA</p>
            <h2>Legado não é só tecnologia antiga. É uma dependência de negócio que não pode parar.</h2>
            <p>
              Orientação do Australian Cyber Security Centre descreve tecnologia legada como fonte de risco
              cibernético e de impacto operacional duradouro. Quando substituição não é imediata, hardening,
              segmentação, inventário e monitoramento tornam-se medidas temporárias essenciais.
            </p>
            <div className="legacy-list">
              <div>
                <ArrowUpRight size={17} />
                <span>Ambiente híbrido torna a evidência fragmentada.</span>
              </div>
              <div>
                <ArrowUpRight size={17} />
                <span>Versões e benchmarks precisam permanecer rastreáveis.</span>
              </div>
              <div>
                <ArrowUpRight size={17} />
                <span>Auditoria pede explicação, não apenas um score.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="positioning-section reveal" ref={positioningRef}>
          <div className="positioning-copy">
            <p className="eyebrow">O FOCO DA INVARIANT</p>
            <h2>Não somos "segurança para tudo". Somos a resposta auditável para ambientes que não podem parar.</h2>
            <p>
              Feito pra organizações com ambiente híbrido, legado, pressão de auditoria e um time que ainda
              explica desvio de configuração manualmente.
            </p>
            <div className="positioning-pill">
              <Layers3 size={18} /> Ambientes híbridos + legados + evidência versionada
            </div>
          </div>
        </section>

        <section id="planos" className="content-section pricing-section">
          <SectionHeader
            index="03"
            eyebrow="Fale com a Invariant"
            title="Leve o Invariant para o seu ambiente."
            body="Conte um pouco sobre a sua operação. Nós avaliamos o cenário e entramos em contato para mostrar como o Invariant pode ser aplicado ao seu ambiente."
          />
          <LeadForm />
          <p className="deployment-note">Implantação on-premises · Licença anual · Atualizações e suporte incluídos.</p>
        </section>
      </main>

      <NewsletterForm />

      <footer className="site-footer">
        <div className="footer-brand">Invariant</div>
        <p>© 2026 Invariant Security. <a href="/containers">Ver demo</a></p>
        <a href="https://github.com/Invariant-Security/Invariant" target="_blank" rel="noreferrer">
          Repositório público <ExternalLink size={14} />
        </a>
      </footer>
    </div>
  )
}
