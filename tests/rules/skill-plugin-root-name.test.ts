// Red first: the rule does not exist yet, so each case is expected to fail.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-plugin-root-name-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}
put('plug/.claude-plugin/plugin.json', '{}')
const root = put('plug/SKILL.md', '')
const ids = (code: string) =>
  lintMarkdown('skill-plugin-root-name', code, root).map((m) => m.messageId)

describe('skill-plugin-root-name (red)', () => {
  it.fails('reports a plugin-root SKILL.md with no name', () => {
    expect(ids('---\ndescription: d\n---\n')).toEqual(['missing'])
  })
  it.fails('reports a plugin-root SKILL.md with no frontmatter', () => {
    expect(ids('# S\n')).toEqual(['missing'])
  })
  it.fails('stays silent for a plugin-root SKILL.md with a name', () => {
    expect(ids('---\nname: review\n---\n')).toEqual([])
  })
})
