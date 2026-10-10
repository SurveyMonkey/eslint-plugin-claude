// Red first: the rule does not exist yet, so each case is expected to fail.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-no-bom-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}
const ids = (file: string) =>
  lintMarkdown('skill-no-bom', '---\nname: s\n---\n', file).map((m) => m.messageId)

describe('skill-no-bom (red)', () => {
  it.fails('reports a SKILL.md that starts with a byte order mark', () => {
    expect(ids(put('.claude/skills/s/SKILL.md', '\u{feff}---\nname: s\n---\n'))).toEqual(['bom'])
  })
  it.fails('reports a command file that starts with a byte order mark', () => {
    expect(ids(put('.claude/commands/c.md', '\u{feff}# C\n'))).toEqual(['bom'])
  })
  it.fails('stays silent for a file with no byte order mark', () => {
    expect(ids(put('.claude/skills/t/SKILL.md', '---\nname: t\n---\n'))).toEqual([])
  })
})
