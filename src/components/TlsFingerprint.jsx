import { useEffect, useState } from 'react'

// Impressão digital do certificado HTTPS do appliance, para o cliente ou o
// vendedor conferirem/fixarem. Só aparece quando há certificado do
// appliance (GET /api/appliance/tls -> available); nas instalações
// hospedadas o TLS é da borda (Cloudflare) e nada é exibido. Falha ao
// buscar também não exibe nada -- é informação auxiliar, não bloqueia a tela.
export default function TlsFingerprint({ apiFetch }) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/appliance/tls')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && body?.available) setInfo(body)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [apiFetch])

  if (!info) return null
  return (
    <p className="tls-fingerprint">
      Certificado HTTPS deste appliance · SHA-256 <code>{info.sha256}</code>
    </p>
  )
}
