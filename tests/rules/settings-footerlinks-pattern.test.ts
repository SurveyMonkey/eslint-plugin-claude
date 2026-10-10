// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '/repo/managed-settings.json') =>
  lintJson('settings-footerlinks-pattern', code, filename).map((m) => m.messageId)
const entry = (fields: object) =>
  JSON.stringify({ footerLinksRegexes: [{ type: 'regex', url: 'https://x.example/', ...fields }] })

describe('settings-footerlinks-pattern (red)', () => {
  it.fails('reports a nested quantifier', () => {
    expect(ids(entry({ pattern: '(a+)+' }))).toEqual(['nested'])
  })
  it.fails('reports a label over 28 columns', () => {
    expect(ids(entry({ pattern: 'a', label: 'x'.repeat(29) }))).toEqual(['labelTooWide'])
  })
})
