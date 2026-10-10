// Red first: the rule does not exist yet, so each case is expected to fail.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-listing-budget-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (name: string, description: string) => {
  const file = path.join(scratch, '.claude', 'skills', name, 'SKILL.md')
  mkdirSync(path.dirname(file), { recursive: true })
  const code = `---\ndescription: ${description}\n---\n`
  writeFileSync(file, code)
  return { file, code }
}
const a = put('a', 'x'.repeat(1500))
const b = put('b', 'x'.repeat(1500))
const ids = (file: string, code: string, options: unknown[] = []) =>
  lintMarkdown('skill-listing-budget', code, file, options).map((m) => m.messageId)

describe('skill-listing-budget (red)', () => {
  it.fails('stays silent while the listing is within the budget', () => {
    expect(ids(a.file, a.code)).toEqual([])
  })
  it.fails('reports when the listing is over the budget', () => {
    expect(ids(a.file, a.code, [{ max: 2000 }])).toEqual(['overConfiguredLimit'])
  })
  it.fails('reports in the other file too', () => {
    expect(ids(b.file, b.code, [{ max: 2000 }])).toEqual(['overConfiguredLimit'])
  })
})
