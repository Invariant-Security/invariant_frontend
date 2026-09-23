import { ExternalLink } from '../components/icons.jsx'
import { useDocumentLang } from '../hooks/useDocumentLang.js'
import './Historia.css'

// Diário de bordo institucional -- estático de propósito (sem backend/
// banco novo, ver plano). Uma entrada nova é uma edição neste array, não
// uma migration. `status: 'upcoming'` marca visualmente algo que ainda
// vai acontecer (nunca "conquistado") -- distinção importante pro PGTech
// 2026, que é o primeiro evento da empresa, não uma credencial já obtida.
//
// PENDÊNCIA: data exata e texto final desta entrada precisam de revisão
// do Victor antes de publicar -- o rascunho abaixo é só estrutura.
const ENTRIES = [
  {
    date: '2026',
    status: 'upcoming',
    title: 'PGTech 2026 — nosso primeiro evento como empresa',
    body: 'A Invariant vai participar do PGTech 2026, a primeira vez que apresentamos o produto num evento do setor. Mais detalhes (data exata, formato da apresentação) em breve, assim que confirmados.',
  },
]

function EntryStatus({ status }) {
  if (status === 'upcoming') return <span className="entry-status entry-status-upcoming">EM BREVE</span>
  return null
}

export default function Historia() {
  useDocumentLang('pt-BR')

  return (
    <div className="historia-shell">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;800&display=swap"
      />
      <header className="historia-header">
        <a className="wordmark" href="/">
          Invariant
        </a>
        <a className="back-link" href="/">
          ← Voltar
        </a>
      </header>

      <main className="historia-main">
        <div className="historia-intro">
          <p className="eyebrow">Nosso diário de bordo</p>
          <h1>Nossa história</h1>
          <p className="historia-lead">
            Um registro real do que a Invariant vai fazendo -- eventos, marcos, decisões. Sem prova social
            fabricada: o que ainda não aconteceu aparece marcado como tal.
          </p>
        </div>

        <ol className="entry-timeline">
          {ENTRIES.map((entry) => (
            <li key={entry.title} className="entry-card">
              <div className="entry-meta">
                <span className="entry-date">{entry.date}</span>
                <EntryStatus status={entry.status} />
              </div>
              <h2>{entry.title}</h2>
              <p>{entry.body}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="historia-footer">
        <div className="footer-brand">Invariant</div>
        <p>
          © 2026 Invariant Security. <a href="/">Página inicial</a>
        </p>
        <a href="https://github.com/Invariant-Security/Invariant" target="_blank" rel="noreferrer">
          Repositório público <ExternalLink size={14} />
        </a>
      </footer>
    </div>
  )
}
