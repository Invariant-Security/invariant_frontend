// Resume o resultado de um discovery sem porta aberta -- port_attempts
// (invariant_discovery/src/invariant_discovery/probe.py) já é evidência
// real (tentativa TCP de verdade, timeout real), nunca inventada aqui.
// Rótulos em português; os códigos internos (timeout/refused/
// network_unreachable/host_unreachable/error) nunca aparecem crus pro
// usuário. Terminologia deliberadamente precisa: timeout e refused NÃO
// significam "inalcançável" -- só network_unreachable/host_unreachable
// sustentam essa palavra.

export const STATUS_LABEL = {
  timeout: 'Tempo limite',
  refused: 'Conexão recusada',
  network_unreachable: 'Rede sem rota',
  host_unreachable: 'Host inalcançável',
  error: 'Erro na tentativa',
}

export function summarizeFailedProbe(evidence) {
  const attempts = evidence?.port_attempts ?? [] // ausente = discovery anterior a esta feature
  const openPorts = evidence?.open_ports ?? []
  if (openPorts.length > 0 || attempts.length === 0) return null

  const counts = {}
  for (const a of attempts) counts[a.status] = (counts[a.status] ?? 0) + 1
  const total = openPorts.length + attempts.length

  let headline = 'Nenhum serviço foi identificado nas portas testadas.'
  if (counts.network_unreachable || counts.host_unreachable) {
    headline = 'A rede de destino não possui rota alcançável a partir do ambiente de descoberta.'
  } else if (attempts.every((a) => a.status === 'timeout')) {
    headline = `Tentamos ${total} portas conhecidas e nenhuma respondeu dentro do tempo limite.`
  }

  return { headline, total, openCount: openPorts.length, counts, attempts }
}
