import { describe, expect, it } from 'vitest'
import { normalizePath } from './App.jsx'

describe('normalizePath', () => {
  it('ignora a barra final', () => {
    expect(normalizePath('/arquitetura/')).toBe('/arquitetura')
    expect(normalizePath('/containers//')).toBe('/containers')
  })
  it('mantém a raiz e caminhos sem barra final', () => {
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('/arquitetura')).toBe('/arquitetura')
  })
})
