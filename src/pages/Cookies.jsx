import { useDocumentLang } from '../hooks/useDocumentLang.js'
import './Legal.css'

export default function Cookies() {
  useDocumentLang('pt-BR')

  return (
    <div className="legal-shell">
      <header className="legal-header">
        <a className="wordmark" href="/">
          Invariant
        </a>
        <a className="legal-back-link" href="/">
          ← Voltar
        </a>
      </header>

      <main className="legal-main">
        <p className="eyebrow">Documento legal</p>
        <h1>Política de Cookies</h1>
        <p className="legal-updated">Última atualização: 23 de setembro de 2026</p>

        <section>
          <h2>1. Resumo direto</h2>
          <p>
            <strong>O site público da Invariant não utiliza cookies de rastreamento, publicidade ou analytics, e
            não armazena nada no seu navegador</strong> (nem cookies, nem localStorage, nem sessionStorage) fora
            do que descrevemos abaixo. Por isso não existe um banner de consentimento nesta página — não há
            escolha não-essencial para você fazer.
          </p>
        </section>

        <section>
          <h2>2. A única exceção, e por que não te afeta</h2>
          <p>
            Nosso painel administrativo (usado só pela nossa equipe, atrás de login) usa um único cookie técnico
            de sessão, estritamente necessário para manter o login autenticado. Esse cookie:
          </p>
          <ul>
            <li>nunca é definido para um visitante comum do site público;</li>
            <li>não é usado para rastreamento, análise de comportamento ou publicidade;</li>
            <li>expira automaticamente após um período de inatividade.</li>
          </ul>
          <p>Se você está lendo esta página como visitante do site, esse cookie nunca chega até você.</p>
        </section>

        <section>
          <h2>3. Fontes do Google (sem cookie)</h2>
          <p>
            A página inicial e a página "Nossa história" carregam tipografia via Google Fonts
            (fonts.googleapis.com/fonts.gstatic.com). Isso gera uma requisição de rede ao Google — o suficiente
            para que o Google veja seu endereço IP e navegador nessa requisição — mas não define nenhum cookie no
            seu navegador. Não usamos Google Analytics, Google Tag Manager, nem qualquer outro produto Google de
            rastreamento.
          </p>
        </section>

        <section>
          <h2>4. O que não usamos</h2>
          <p>
            Não usamos: Google Analytics, Google Tag Manager, Meta Pixel, Cloudflare Web Analytics, Hotjar,
            Sentry, PostHog, Plausible, pixels de publicidade, ferramentas de chat/atendimento, ou qualquer outro
            script de rastreamento de terceiros.
          </p>
        </section>

        <section>
          <h2>5. Mudanças futuras</h2>
          <p>
            Se um dia adicionarmos alguma tecnologia que exija sua escolha (analytics, por exemplo),
            atualizaremos esta página e implementaremos um mecanismo de consentimento adequado antes de carregar
            esse script — nunca silenciosamente.
          </p>
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
