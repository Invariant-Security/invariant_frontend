// Parser minimalista de CSV pro import em lote de endpoints -- não é um
// parser RFC 4180 completo de propósito (ver Endpoints.jsx). Cobre: BOM
// UTF-8, LF e CRLF, delimitador `,` ou `;` (detectado pela primeira linha
// não-vazia -- usuários brasileiros costumam exportar do Excel com `;`),
// cabeçalho opcional (`address,label` / `address;label` / só `address`),
// campo entre aspas duplas contendo o delimitador escolhido, linhas vazias
// ignoradas, espaços em volta de cada campo removidos.
//
// `row` em cada item devolvido é o número de linha REAL do arquivo
// original (1-based, contando o cabeçalho se houver) -- nunca a posição no
// array de saída. Isso é o que permite ao backend (POST /endpoints/bulk)
// reportar "erro na linha 4" corretamente mesmo com cabeçalho/linhas
// vazias no meio do arquivo.

function splitLine(line, delimiter) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields.map((f) => f.trim())
}

export function parseEndpointsCsv(text) {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const lines = withoutBom.split(/\r\n|\n/)

  const firstNonEmptyIdx = lines.findIndex((l) => l.trim() !== '')
  if (firstNonEmptyIdx === -1) return []

  const firstLine = lines[firstNonEmptyIdx].trim()
  const semicolons = firstLine.split(';').length - 1
  const commas = firstLine.split(',').length - 1
  const delimiter = semicolons > commas ? ';' : ','

  const headerNormalized = firstLine.toLowerCase().replace(/\s+/g, '')
  const isHeader = headerNormalized === `address${delimiter}label` || headerNormalized === 'address'

  const rows = []
  lines.forEach((rawLine, idx) => {
    if (idx === firstNonEmptyIdx && isHeader) return
    const line = rawLine.trim()
    if (line === '') return
    const fields = splitLine(line, delimiter)
    const address = fields[0]
    if (!address) return
    const label = fields[1] || null
    rows.push({ row: idx + 1, address, label, tags: [] })
  })
  return rows
}
