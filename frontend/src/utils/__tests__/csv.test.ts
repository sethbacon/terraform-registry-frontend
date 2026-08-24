import { describe, it, expect } from 'vitest'
import { csvCell, toCsv } from '../csv'

/**
 * #682 — CSV formula injection.
 *
 * The table is over the LEAD CHARACTER rather than over "a payload", because
 * that is what the spreadsheet actually keys on. A test asserting one crafted
 * `=cmd|...` string passes while `@SUM(...)` still detonates.
 */
describe('csvCell', () => {
  it.each([
    ["=cmd|'/c calc'!A1", '='],
    ['+1+1', '+'],
    ['-1+1', '-'],
    ['@SUM(1,1)', '@'],
    ['\tSUM(1,1)', 'tab'],
    ['\rSUM(1,1)', 'CR'],
  ])('neutralises a leading %s (%s)', (payload) => {
    const out = csvCell(payload)
    // The apostrophe must be INSIDE the quotes, immediately before the payload —
    // outside, it would be CSV data rather than a spreadsheet text marker.
    expect(out.startsWith('"\'')).toBe(true)
    expect(out).toContain(payload.replace(/"/g, '""'))
  })

  it('leaves an ordinary value alone apart from quoting', () => {
    expect(csvCell('alice@example.com')).toBe('"alice@example.com"')
    expect(csvCell('plain')).toBe('"plain"')
  })

  it('does not treat these characters as dangerous away from the start', () => {
    // Only the FIRST character triggers evaluation. Prefixing on any occurrence
    // would corrupt ordinary data — arithmetic in a title, a scoped npm package.
    expect(csvCell('a=b')).toBe('"a=b"')
    expect(csvCell('x + y')).toBe('"x + y"')
  })

  it('escapes embedded quotes per RFC 4180', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('quoting alone does not save you — the apostrophe is the control', () => {
    // A spreadsheet strips the CSV quotes and evaluates what is inside, which is
    // why RFC 4180 quoting is not a mitigation and this test exists to say so.
    const out = csvCell('=1+1')
    expect(out).toBe('"\'=1+1"')
    expect(out).not.toBe('"=1+1"')
  })

  it('renders null and undefined as empty, not as the words', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })
})

describe('toCsv', () => {
  it('runs headers through the same encoder as cells', () => {
    // Headers are usually static, but an export that ever takes a dynamic column
    // name should not have a second, weaker path.
    expect(toCsv(['=evil'], [])).toBe('"\'=evil"')
  })

  it('joins rows with newlines and cells with commas', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('"a","b"\n"1","2"')
  })
})
