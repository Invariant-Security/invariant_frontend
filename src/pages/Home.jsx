import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Layers3,
  Menu,
  ScanSearch,
  X,
} from '../components/icons.jsx'
import { useScrollReveal } from '../hooks/useScrollReveal.js'
import './Home.css'

// Overridable via VITE_API_BASE, same convention as Demo.jsx.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

// Preço calculado aqui só pra exibir uma prévia -- quem decide o valor de
// verdade é o servidor (POST /billing/checkout), igual ao BabyBet nunca
// confia no valor que vem do navegador.
function computeAnnualPrice(plan, activations) {
  if (plan === 'single') return Math.max(0, activations) * 12000
  if (activations <= 0) return 0
  if (activations <= 3) return 30000
  return 30000 + (activations - 3) * 8000
}

const PLAN_COPY = {
  single: {
    title: 'Single Activation',
    blurb: 'Uma ativação para um ambiente operacional delimitado.',
    features: [
      'Execução on-premises no seu ambiente',
      'Um pacote de baselines contratado',
      'Atualizações de conteúdo e software por 12 meses',
      'Relatório de evidência por ativação',
      'Suporte padrão em horário comercial',
    ],
    priceLabel: 'R$ 12.000 / ativação / ano',
  },
  multi: {
    title: 'Multi Activation',
    blurb: 'Para filiais, datacenters, ambientes separados ou clientes distintos.',
    features: [
      'Tudo do Single Activation',
      '3 ativações incluídas no plano',
      'R$ 8.000 por ativação adicional',
      'Relatórios consolidados entre ativações',
      'Suporte prioritário',
    ],
    priceLabel: 'R$ 30.000 / 3 ativações / ano',
  },
}

function SourceNote({ children }) {
  return <p className="source-note">{children}</p>
}

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

function CheckoutPanel({ plan, activations, onClose }) {
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [state, setState] = useState('form') // form | loading | ready | error | paid
  const [checkout, setCheckout] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    setState('loading')
    setErrorMessage('')
    try {
      const response = await fetch(`${API_BASE}/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, activations, contact_name: contactName, contact_email: contactEmail }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.detail || `Erro ${response.status}`)
      }
      const data = await response.json()
      setCheckout(data)
      setState('ready')
      pollStatus(data.id)
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível iniciar o pagamento.')
      setState('error')
    }
  }

  function pollStatus(id) {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/billing/status/${id}`)
        if (!response.ok) return
        const data = await response.json()
        if (data.status === 'paid') {
          setState('paid')
          clearInterval(interval)
        }
      } catch {
        // rede instável durante o polling -- tenta de novo no próximo tick
      }
    }, 4000)
    setTimeout(() => clearInterval(interval), 15 * 60 * 1000)
  }

  return (
    <div className="checkout-panel">
      <div className="checkout-head">
        <h4>Contratar {PLAN_COPY[plan].title}</h4>
        <button type="button" className="checkout-close" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      {state === 'form' && (
        <form onSubmit={submit} className="checkout-form">
          <label>
            Nome
            <input value={contactName} onChange={(event) => setContactName(event.target.value)} required />
          </label>
          <label>
            E-mail
            <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} required />
          </label>
          <button type="submit" className="primary-action">
            Gerar cobrança Pix
          </button>
        </form>
      )}

      {state === 'loading' && <p className="checkout-status">Gerando cobrança...</p>}

      {state === 'error' && (
        <div className="checkout-status checkout-error">
          <p>{errorMessage}</p>
          <button type="button" className="secondary-action" onClick={() => setState('form')}>
            Tentar de novo
          </button>
        </div>
      )}

      {state === 'ready' && checkout && (
        <div className="checkout-qr">
          {checkout.qr_code_base64 && (
            <img src={`data:image/png;base64,${checkout.qr_code_base64}`} alt="QR code Pix" />
          )}
          <p className="checkout-code">{checkout.qr_code}</p>
          <p className="checkout-hint">Escaneie ou copie o código Pix. Confirmamos automaticamente após o pagamento.</p>
        </div>
      )}

      {state === 'paid' && (
        <div className="checkout-status checkout-paid">
          <CheckCircle2 size={22} />
          <p>Pagamento confirmado. Entraremos em contato para dar sequência à ativação.</p>
        </div>
      )}
    </div>
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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activations, setActivations] = useState(1)
  const [plan, setPlan] = useState('single')
  const [checkoutPlan, setCheckoutPlan] = useState(null)

  const annualPotential = useMemo(() => computeAnnualPrice(plan, activations), [plan, activations])
  const planLabel = PLAN_COPY[plan].title

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
          <button onClick={() => scrollTo('planos')}>Planos</button>
          <a href="/demo">Ver demo</a>
        </nav>

        <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Abrir menu">
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {isMenuOpen && (
          <div className="mobile-nav">
            <button onClick={() => scrollTo('como-funciona')}>Como funciona</button>
            <button onClick={() => scrollTo('mercado')}>Mercado</button>
            <button onClick={() => scrollTo('planos')}>Planos</button>
            <a href="/demo">Ver demo</a>
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
                Ver planos <ArrowDownRight size={18} />
              </button>
              <a className="secondary-action" href="/demo">
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
            eyebrow="Planos"
            title="Ativação on-premises: você roda no seu ambiente, a gente cuida da evidência."
            body="Sem custo de infraestrutura hospedada — você paga pelo direito de uso, atualizações e suporte da ativação, não por finding ou por hora de nuvem."
          />
          <div className="plans-grid">
            {(['single', 'multi']).map((key) => {
              const info = PLAN_COPY[key]
              return (
                <article key={key} className={`plan-card ${plan === key ? 'plan-card-active' : ''}`}>
                  <h3>{info.title}</h3>
                  <p className="plan-blurb">{info.blurb}</p>
                  <ul className="plan-features">
                    {info.features.map((feature) => (
                      <li key={feature}>
                        <CheckCircle2 size={16} /> {feature}
                      </li>
                    ))}
                  </ul>
                  <p className="plan-price">{info.priceLabel}</p>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => {
                      setPlan(key)
                      setCheckoutPlan(key)
                    }}
                  >
                    Contratar {info.title}
                  </button>
                </article>
              )
            })}
          </div>

          <div className="scenario-panel">
            <div className="scenario-intro">
              <p className="eyebrow">SIMULE SEU CONTRATO</p>
              <h3>Quantas ativações você precisa?</h3>
            </div>
            <div className="scenario-inputs">
              <label>
                Plano
                <select value={plan} onChange={(event) => setPlan(event.target.value)}>
                  <option value="single">Single Activation</option>
                  <option value="multi">Multi Activation</option>
                </select>
              </label>
              <label>
                Quantidade de ativações
                <input
                  type="number"
                  min="0"
                  value={activations || ''}
                  placeholder="Ex.: 3"
                  onChange={(event) => setActivations(Math.max(0, Number(event.target.value)))}
                />
              </label>
            </div>
            <div className="scenario-result">
              <span>ESTIMATIVA DE CONTRATO ANUAL</span>
              <strong>
                {annualPotential > 0
                  ? annualPotential.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                  : 'Preencha as premissas'}
              </strong>
              <small>{annualPotential > 0 ? `${planLabel} · ${activations} ativaç${activations === 1 ? 'ão' : 'ões'}` : ''}</small>
            </div>
          </div>

          {checkoutPlan && (
            <CheckoutPanel plan={checkoutPlan} activations={activations} onClose={() => setCheckoutPlan(null)} />
          )}

          <SourceNote>Valores são hipóteses de preço em teste, antes de impostos, sujeitas a ajuste por contrato.</SourceNote>
        </section>
      </main>

      <NewsletterForm />

      <footer className="site-footer">
        <div className="footer-brand">Invariant</div>
        <p>© 2026 Invariant Security. <a href="/demo">Ver demo</a></p>
        <a href="https://github.com/Invariant-Security/Invariant" target="_blank" rel="noreferrer">
          Repositório público <ExternalLink size={14} />
        </a>
      </footer>
    </div>
  )
}
