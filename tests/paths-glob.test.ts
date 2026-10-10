// The checks of a `paths` glob list, for a skill and a rule file. The docs examples are in
// https://code.claude.com/docs/en/memory#path-specific-rules: `src/*.{ts,tsx}` is two patterns
// and `{a,b}/{c,d}/*.{ts,tsx}` is eight.
import { describe, expect, it } from 'vitest'
import { checkGlobs } from '../src/paths-glob.ts'

describe('checkGlobs', () => {
  it('counts the patterns of the brace groups of a list', () => {
    expect(checkGlobs(['src/*.{ts,tsx}'])).toEqual({
      broken: [],
      count: 2,
      bytes: 17,
      overBudget: false,
    })
    expect(checkGlobs('{a,b}/{c,d}/*.{ts,tsx}').count).toBe(8)
  })

  it('leaves out a pattern with no brace group', () => {
    expect(checkGlobs(['src/**', 'lib/*.ts'])).toEqual({
      broken: [],
      count: 0,
      bytes: 0,
      overBudget: false,
    })
  })

  it('splits a string at each comma outside a brace group', () => {
    expect(checkGlobs('a[, src/*.{ts,tsx}, b[').broken).toEqual(['a[', 'b['])
  })

  it('reports the patterns with a [ that starts no bracket expression, in order', () => {
    expect(checkGlobs(['[a', 'ok/[abc].ts', 'photos \\[1', 'b[']).broken).toEqual(['[a', 'b['])
  })

  it('is over the budget at 1,001 patterns and not at 1,000', () => {
    const group = (n: number) => `{${'abcdefghijklmnopqrstuvwxyz'.slice(0, n).split('').join(',')}}`
    expect(checkGlobs(`${group(10)}/${group(10)}/${group(10)}`).overBudget).toBe(false)
    expect(checkGlobs(`${group(7)}/${group(11)}/${group(13)}`).overBudget).toBe(true)
  })

  it('reads a value that is not a string or a list as no pattern', () => {
    for (const value of [undefined, null, 3, {}, [1, null]]) {
      expect(checkGlobs(value)).toEqual({ broken: [], count: 0, bytes: 0, overBudget: false })
    }
  })
})
