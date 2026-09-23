import { useDocumentLang } from '../hooks/useDocumentLang.js'
import './Legal.css'

function Pending({ children }) {
  return <span className="legal-pending">{children}</span>
}

export default function Termos() {
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
        <h1>Termos de Uso</h1>
        <p className="legal-updated">Última atualização: 23 de setembro de 2026</p>

        <section>
          <h2>1. Sobre este documento</h2>
          <p>
            Estes Termos de Uso tratam do <strong>site institucional</strong> da Invariant Security
            (invariantsec.org) — sua navegação, conteúdo e formulários públicos. Não são um contrato de
            licenciamento ou prestação de serviço do produto Invariant, que é negociado separadamente com cada
            cliente.
          </p>
        </section>

        <section>
          <h2>2. Aceitação</h2>
          <p>Ao navegar neste site, você concorda com estes termos. Se não concordar, pedimos que não o utilize.</p>
        </section>

        <section>
          <h2>3. Uso permitido</h2>
          <p>
            Este site existe para apresentar a Invariant Security, explicar como o produto funciona e permitir
            contato comercial. Você pode navegar livremente, explorar a demonstração pública e entrar em contato
            através dos formulários disponíveis.
          </p>
        </section>

        <section>
          <h2>4. O que não é permitido</h2>
          <ul>
            <li>Tentar obter acesso não autorizado a qualquer parte do site ou de seus sistemas;</li>
            <li>Usar os formulários do site para envio de conteúdo abusivo, ilegal ou spam;</li>
            <li>Extrair dados do site de forma automatizada em volume que prejudique sua disponibilidade;</li>
            <li>Usar a demonstração pública para fins diferentes de avaliar o produto.</li>
          </ul>
        </section>

        <section>
          <h2>5. Propriedade intelectual</h2>
          <p>
            A marca "Invariant", sua identidade visual, textos, layout e demais conteúdos deste site pertencem à
            Invariant Security. Reprodução, distribuição ou uso comercial desse conteúdo sem autorização prévia
            não é permitido.
          </p>
        </section>

        <section>
          <h2>6. Links e serviços de terceiros</h2>
          <p>
            Este site contém links para serviços de terceiros (por exemplo, GitHub e WhatsApp). Não temos
            controle sobre esses serviços e não somos responsáveis por seu conteúdo, disponibilidade ou práticas
            de privacidade.
          </p>
        </section>

        <section>
          <h2>7. Disponibilidade</h2>
          <p>
            Fazemos esforços razoáveis para manter o site disponível, mas não garantimos operação ininterrupta ou
            livre de erros. Manutenções, instabilidades técnicas ou fatores fora do nosso controle podem afetar
            temporariamente o acesso.
          </p>
        </section>

        <section>
          <h2>8. Sobre as informações do produto</h2>
          <p>
            As informações apresentadas sobre o produto Invariant têm caráter informativo. O preenchimento do
            formulário de contato comercial não constitui contratação nem gera obrigação de compra — é apenas o
            início de uma conversa comercial.
          </p>
        </section>

        <section>
          <h2>9. Limitação de responsabilidade</h2>
          <p>
            Na medida permitida pela legislação aplicável, não nos responsabilizamos por danos indiretos
            decorrentes do uso deste site institucional. Isso não afasta responsabilidades que a lei brasileira
            considere irrenunciáveis.
          </p>
        </section>

        <section>
          <h2>10. Privacidade</h2>
          <p>
            O tratamento de dados pessoais coletados neste site é descrito em detalhe na nossa{' '}
            <a href="/privacidade">Política de Privacidade</a>.
          </p>
        </section>

        <section>
          <h2>11. Contato comercial</h2>
          <p>Use o formulário na página inicial ou o e-mail de contato indicado nela para falar com a nossa equipe.</p>
        </section>

        <section>
          <h2>12. Alterações destes termos</h2>
          <p>
            Podemos atualizar estes termos para refletir mudanças no site. A data no topo desta página sempre
            indica a versão mais recente.
          </p>
        </section>

        <section>
          <h2>13. Legislação aplicável e foro</h2>
          <p>
            Estes termos são regidos pela legislação brasileira. <Pending>Foro para eventuais disputas: a
            definir pela Invariant Security.</Pending>
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <div className="footer-brand">Invariant</div>
        <p>
          <a href="/">Página inicial</a> · <a href="/privacidade">Privacidade</a> · <a href="/cookies">Cookies</a>
        </p>
      </footer>
    </div>
  )
}
