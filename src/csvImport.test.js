import { describe, expect, it } from 'vitest'
import { parseEndpointsCsv } from './csvImport.js'

describe('parseEndpointsCsv', () => {
  it('parses comma-separated rows with a header', () => {
    const csv = 'address,label\n10.0.0.1,API\n10.0.0.2,Banco'
    expect(parseEndpointsCsv(csv)).toEqual([
      { row: 2, address: '10.0.0.1', label: 'API', tags: [] },
      { row: 3, address: '10.0.0.2', label: 'Banco', tags: [] },
    ])
  })

  it('parses semicolon-separated rows (Excel BR export)', () => {
    const csv = 'address;label\n10.0.0.1;API\n10.0.0.2;Banco'
    expect(parseEndpointsCsv(csv)).toEqual([
      { row: 2, address: '10.0.0.1', label: 'API', tags: [] },
      { row: 3, address: '10.0.0.2', label: 'Banco', tags: [] },
    ])
  })

  it('handles CRLF line endings', () => {
    const csv = 'address,label\r\n10.0.0.1,API\r\n10.0.0.2,Banco'
    expect(parseEndpointsCsv(csv)).toEqual([
      { row: 2, address: '10.0.0.1', label: 'API', tags: [] },
      { row: 3, address: '10.0.0.2', label: 'Banco', tags: [] },
    ])
  })

  it('strips a UTF-8 BOM', () => {
    const csv = '﻿address,label\n10.0.0.1,API'
    expect(parseEndpointsCsv(csv)).toEqual([{ row: 2, address: '10.0.0.1', label: 'API', tags: [] }])
  })

  it('accepts a header with only "address" (no label column)', () => {
    const csv = 'address\n10.0.0.1\n10.0.0.2'
    expect(parseEndpointsCsv(csv)).toEqual([
      { row: 2, address: '10.0.0.1', label: null, tags: [] },
      { row: 3, address: '10.0.0.2', label: null, tags: [] },
    ])
  })

  it('treats the first line as data when it is not a recognized header', () => {
    const csv = '10.0.0.1,API\n10.0.0.2,Banco'
    expect(parseEndpointsCsv(csv)).toEqual([
      { row: 1, address: '10.0.0.1', label: 'API', tags: [] },
      { row: 2, address: '10.0.0.2', label: 'Banco', tags: [] },
    ])
  })

  it('ignores empty lines and trims whitespace around fields', () => {
    const csv = 'address,label\n  10.0.0.1  ,  API  \n\n10.0.0.2,Banco'
    expect(parseEndpointsCsv(csv)).toEqual([
      { row: 2, address: '10.0.0.1', label: 'API', tags: [] },
      { row: 4, address: '10.0.0.2', label: 'Banco', tags: [] },
    ])
  })

  it('supports a quoted field containing the delimiter', () => {
    const csv = 'address,label\n10.0.0.20,"Banco, Produção"'
    expect(parseEndpointsCsv(csv)).toEqual([{ row: 2, address: '10.0.0.20', label: 'Banco, Produção', tags: [] }])
  })

  it('preserves the original file line number, not the array position, across a header and an empty line', () => {
    const csv = 'address,label\n10.0.0.1,API\n\n999.1.1.1,Banco'
    const rows = parseEndpointsCsv(csv)
    expect(rows.map((r) => r.row)).toEqual([2, 4])
  })

  it('returns an empty array for an empty or whitespace-only file', () => {
    expect(parseEndpointsCsv('')).toEqual([])
    expect(parseEndpointsCsv('   \n  \n')).toEqual([])
  })
})
