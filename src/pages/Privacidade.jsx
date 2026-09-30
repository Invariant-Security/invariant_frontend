import { useDocumentLang } from '../hooks/useDocumentLang.js'
import './Legal.css'

// Todo o conteúdo abaixo reflete uma auditoria real do código deste
// repositório (frontend + invariant_api), não um texto genérico de
// template, e acompanha o ROPA/RIPD do projeto -- mudar um tratamento
// de dados aqui sem mudar lá (ou vice-versa) deixa os dois divergentes.

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
        <p className="legal-updated">Última atualização: 28 de setembro de 2026</p>

        <section>
          <h2>1. Controlador e encarregado</h2>
          <p>
            Esta política é mantida pela Invariant Security. Enquanto a empresa não estiver formalmente
            constituída, o controlador dos dados pessoais descritos aqui é o seu fundador, Victor Dias
            Gonçalves, pessoa física. Quando a empresa for constituída, esta página será
            atualizada com a razão social, o CNPJ e o endereço.
          </p>
          <p>
            O encarregado pelo tratamento de dados pessoais (art. 41 da LGPD) também é Victor Dias Gonçalves,
            pelo e-mail{' '}
            <a href="mailto:privacidade@invariantsec.org">privacidade@invariantsec.org</a>.
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
            <li>
              <strong>Hostinger</strong>: provedor do servidor onde o site, o banco de dados e os backups ficam
              hospedados. O servidor fica nos Estados Unidos.
            </li>
            <li>
              <strong>Cloudflare</strong>: todo o tráfego do site passa pela Cloudflare, que fornece a conexão
              segura (HTTPS), proteção contra ataques e DNS. Ela recebe dados técnicos da conexão, como o endereço
              IP.
            </li>
            <li>
              <strong>Microsoft 365</strong>: nosso provedor de e-mail. Se você nos escrever, a mensagem fica
              armazenada lá.
            </li>
          </ul>
          <p>
            Por isso, os dados que você nos envia são armazenados fora do Brasil, e alguns dos demais fornecedores
            também os processam no exterior. Essa transferência internacional se apoia nas garantias contratuais e de proteção de dados oferecidas por cada um deles
            (art. 33 da LGPD).
          </p>
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
            Como qualquer aplicação web, nossa infraestrutura gera logs técnicos de operação, como registros de
            acesso (endereço IP, data e hora, página acessada e navegador). Usamos esses registros para operar o
            site, investigar falhas e nos proteger de abusos, com base no legítimo interesse (art. 7º, IX) e no
            dever legal de guarda de registros de acesso (art. 15 do Marco Civil da Internet). O endereço IP de
            quem envia o formulário comercial também é usado momentaneamente para limitar o número de envios em
            um curto período (prevenção de abuso/spam) e não é gravado em nosso banco de dados nem incluído na
            notificação enviada ao Slack.
          </p>
        </section>

        <section>
          <h2>9. Por quanto tempo guardamos seus dados</h2>
          <ul>
            <li>
              <strong>Formulário comercial:</strong> até 24 meses após o último contato, se a conversa não evoluir
              para um contrato. Depois disso, os dados são eliminados.
            </li>
            <li>
              <strong>Newsletter:</strong> até você cancelar a inscrição ou retirar o consentimento.
            </li>
            <li>
              <strong>Registros de acesso:</strong> 6 meses, prazo exigido pelo Marco Civil da Internet. Outros
              logs técnicos: 30 dias.
            </li>
            <li>
              <strong>Backups:</strong> cópias diárias guardadas por 30 dias e uma cópia mensal guardada por 12
              meses. Um dado eliminado do sistema deixa de existir nos backups ao fim desses ciclos.
            </li>
          </ul>
          <p>
            Você pode pedir a eliminação antes desses prazos a qualquer momento (ver seção 12), exceto quando a
            lei exigir que um dado seja mantido.
          </p>
        </section>

        <section>
          <h2>10. Segurança</h2>
          <p>
            Adotamos medidas técnicas razoáveis de proteção: conexão criptografada (HTTPS/TLS) em todo o site,
            autenticação para as áreas administrativas, ambiente de testes isolado e sem dados reais, e avaliações
            periódicas de segurança com um plano de correção acompanhado. Nenhuma medida de segurança é
            infalível — não garantimos proteção absoluta contra qualquer incidente, mas trabalhamos para reduzir
            os riscos de forma contínua. Se ocorrer um incidente de segurança que possa trazer risco ou dano
            relevante a você, vamos comunicar você e a Autoridade Nacional de Proteção de Dados (ANPD), como
            prevê o art. 48 da LGPD.
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
            Envie sua solicitação para{' '}
            <a href="mailto:privacidade@invariantsec.org">privacidade@invariantsec.org</a>. Respondemos pedidos de
            confirmação e de acesso aos seus dados em até 15 dias (art. 19 da LGPD) e os demais pedidos no menor
            prazo possível. Você também pode apresentar uma reclamação à ANPD.
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
