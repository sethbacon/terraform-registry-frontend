import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import { normalize, extractPath } from '../contract-check'

/** Parse `<expr>` as the initializer of `const __x = <expr>;` for extractPath() tests. */
function parseExpression(src: string): ts.Expression {
  const sf = ts.createSourceFile('__fixture.ts', `const __x = ${src};`, ts.ScriptTarget.Latest, true)
  const stmt = sf.statements[0] as ts.VariableStatement
  const initializer = stmt.declarationList.declarations[0].initializer
  if (!initializer) throw new Error(`fixture did not parse to an initializer: ${src}`)
  return initializer
}

describe('normalize', () => {
  it.each([
    ['/api/v1/modules', '/api/v1/modules'],
    ['/api/v1/modules/{id}', '/api/v1/modules/{}'],
    ['/api/v1/modules/{namespace}/{name}/{system}', '/api/v1/modules/{}/{}/{}'],
    ['/api/v1/modules/{id}/versions/{version}/download', '/api/v1/modules/{}/versions/{}/download'],
    // The brace matcher excludes '/' inside the braces so it never spans a
    // segment boundary on a malformed/unbalanced path.
    ['/api/v1/modules/{id', '/api/v1/modules/{id'],
  ])('normalizes %s -> %s', (input, expected) => {
    expect(normalize(input)).toBe(expected)
  })
})

describe('extractPath', () => {
  it('extracts a plain string literal', () => {
    expect(extractPath(parseExpression(`'/api/v1/modules'`))).toBe('/api/v1/modules')
  })

  it('extracts a no-substitution template literal', () => {
    expect(extractPath(parseExpression('`/api/v1/modules`'))).toBe('/api/v1/modules')
  })

  it('renders each template-literal expression as a {x} placeholder', () => {
    expect(extractPath(parseExpression('`/api/v1/modules/${ns}/${name}/${system}`'))).toBe(
      '/api/v1/modules/{x}/{x}/{x}',
    )
  })

  it('keeps the static text around a single interpolation', () => {
    expect(extractPath(parseExpression('`/api/v1/modules/${ns}/versions/download`'))).toBe(
      '/api/v1/modules/{x}/versions/download',
    )
  })

  it('returns null for an expression it cannot statically resolve', () => {
    expect(extractPath(parseExpression('someVar'))).toBeNull()
  })
})
