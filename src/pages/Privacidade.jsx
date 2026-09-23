import { useDocumentLang } from '../hooks/useDocumentLang.js'
import './Legal.css'

// Todo o conteúdo abaixo reflete uma auditoria real do código deste
// repositório (frontend + invariant_api), não um texto genérico de
// template -- ver o plano desta rodada pra cada achado citado aqui.
// Trechos marcados com <Pending> são exatamente os pontos que o
// código não pode determinar sozinho (CNPJ, endereço, canal de
// contato dedicado) -- não são placeholders esquecidos, são a
// sinalização explícita pedida: não inventar.
function Pending({ children }) {
  return <span className="legal-pending">{children}</span>
}

export default function Privacidade() {
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
        <h1>Política de Privacidade</h1>
        <p className="legal-updated">Última atualização: 23 de setembro de 2026</p>

        <section>
          <h2>1. Controlador</h2>
          <p>
            Esta política é mantida pela Invariant Security, responsável pelo tratamento dos dados pessoais
            descritos aqui. <Pending>Razão social e endereço formais: a confirmar quando a empresa estiver
            formalmente constituída.</Pending>
          </p>
        </section>

        <section>
          <h2>2. Quais dados coletamos</h2>
          <p>Coletamos exatamente os dados que você nos envia diretamente, em dois formulários:</p>
          <ul>
            <li>
              <strong>Formulário de contato comercial</strong> (seção "Fale com a Invariant"): nome, e-mail
              corporativo e empresa (obrigatórios); cargo, quantidade de ambientes, principal necessidade e uma
              mensagem livre (opcionais).
            </li>
            <li>
              <strong>Inscrição na newsletter</strong>: apenas o e-mail.
            </li>
          </ul>
          <p>
            Não coletamos nenhum outro dado pessoal no site — não há login, não há perfil de usuário, e nenhuma
            outra área do site pede informação pessoal.
          </p>
        </section>

        <section>
          <h2>3. Como os dados são coletados</h2>
          <p>
            Sempre por ação direta e explícita sua, ao preencher e enviar um dos dois formulários acima. Não
            coletamos dados automaticamente por navegação, não usamos cookies de rastreamento (ver nossa{' '}
            <a href="/cookies">Política de Cookies</a>) e não compramos ou recebemos listas de contato de
            terceiros.
          </p>
        </section>

        <section>
          <h2>4. Para que usamos esses dados</h2>
          <p>
            <strong>Formulário comercial:</strong> exclusivamente para responder à sua solicitação e entrar em
            contato sobre a Invariant — avaliar seu cenário, agendar uma conversa ou demonstração.
          </p>
          <p>
            <strong>Newsletter:</strong> finalidade separada e independente — envio de novidades sobre a
            Invariant. Inscrever-se em uma não inscreve automaticamente na outra.
          </p>
        </section>

        <section>
          <h2>5. Base legal</h2>
          <p>
            Para o formulário comercial, tratamos seus dados com base na <strong>execução de procedimentos
            preliminares a um possível contrato</strong>, a seu pedido (art. 7º, V, LGPD), e no nosso{' '}
            <strong>legítimo interesse</strong> em responder solicitações comerciais recebidas (art. 7º, IX).
            Não tratamos esse envio como consentimento genérico para outras finalidades.
          </p>
          <p>
            Para a newsletter, a base legal é o <strong>consentimento</strong> (art. 7º, I) — uma ação separada e
            opcional, que você pode retirar a qualquer momento.
          </p>
        </section>

        <section>
          <h2>6. Com quem compartilhamos</h2>
          <ul>
            <li>
              <strong>Slack</strong>: quando você envia o formulário comercial, os dados desse envio (nome,
              e-mail, empresa, cargo, interesse, ambientes, necessidade e mensagem) são encaminhados a um canal
              interno do Slack da nossa equipe, para que possamos responder rapidamente. O Slack atua como nosso
              operador nessa notificação.
            </li>
          </ul>
          <p>
            Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins de marketing de
            terceiros.
          </p>
        </section>

        <section>
          <h2>7. Cookies e tecnologias semelhantes</h2>
          <p>
            O site público não utiliza cookies de rastreamento nem tecnologias semelhantes que exijam sua
            escolha. Página inicial e a página "Nossa história" carregam fontes do Google Fonts, o que gera uma
            requisição de rede ao Google (sem cookie). Detalhes completos na <a href="/cookies">Política de
            Cookies</a>.
          </p>
        </section>

        <section>
          <h2>8. Logs técnicos</h2>
          <p>
            Como qualquer aplicação web, nossa infraestrutura gera logs técnicos de operação (registros de
            requisições, por exemplo). O endereço IP de quem envia o formulário comercial é usado momentaneamente
            para limitar o número de envios em um curto período (prevenção de abuso/spam) e não é gravado em
            nosso banco de dados nem incluído na notificação enviada ao Slack.
          </p>
        </section>

        <section>
          <h2>9. Por quanto tempo guardamos seus dados</h2>
          <p>
            Hoje não temos um processo automático de exclusão por prazo fixo — os dados enviados permanecem
            armazenados até que sejam apagados mediante solicitação sua (ver seção 11) ou por decisão nossa de
            expurgo. Estamos avaliando definir um prazo de retenção formal; até lá, preferimos informar esse
            estado real em vez de prometer um prazo que ainda não está implementado.
          </p>
        </section>

        <section>
          <h2>10. Segurança</h2>
          <p>
            Adotamos medidas técnicas razoáveis de proteção: conexão criptografada (HTTPS/TLS) em todo o site e
            acesso restrito ao nosso banco de dados. Nenhuma medida de segurança é infalível — não garantimos
            proteção absoluta contra qualquer incidente, mas trabalhamos para reduzir os riscos de forma
            contínua.
          </p>
        </section>

        <section>
          <h2>11. Seus direitos (LGPD, art. 18)</h2>
          <p>Você pode, a qualquer momento, solicitar:</p>
          <ul>
            <li>confirmação de que tratamos seus dados e acesso a eles;</li>
            <li>correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
            <li>portabilidade dos dados a outro fornecedor, quando aplicável;</li>
            <li>eliminação dos dados tratados com base em consentimento (ex.: sair da newsletter);</li>
            <li>informação sobre com quem compartilhamos seus dados;</li>
            <li>revogação do consentimento, quando essa for a base legal aplicável.</li>
          </ul>
        </section>

        <section>
          <h2>12. Como exercer seus direitos</h2>
          <p>
            Envie sua solicitação para <a href="mailto:victor@invariantsec.org">victor@invariantsec.org</a>. Vamos
            responder dentro de um prazo razoável.
          </p>
        </section>

        <section>
          <h2>13. Alterações desta política</h2>
          <p>
            Podemos atualizar esta política para refletir mudanças no site ou na legislação. A data no topo desta
            página sempre indica a versão mais recente.
          </p>
        </section>
      </main>

      <footer className="legal-footer">
        <div className="footer-brand">Invariant</div>
        <p>
          <a href="/">Página inicial</a> · <a href="/termos">Termos de Uso</a> · <a href="/cookies">Cookies</a>
        </p>
      </footer>
    </div>
  )
}
