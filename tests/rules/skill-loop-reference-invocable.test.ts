// Red first: the rule does not exist yet, so each case is expected to fail.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-loop-red-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
mkdirSync(path.join(scratch, '.git'))
mkdirSync(path.join(scratch, '.claude/skills/deploy'), { recursive: true })
writeFileSync(
  path.join(scratch, '.claude/skills/deploy/SKILL.md'),
  '---\ndisable-model-invocation: true\n---\n',
)
mkdirSync(path.join(scratch, '.claude/skills/review'), { recursive: true })
writeFileSync(path.join(scratch, '.claude/skills/review/SKILL.md'), '---\ndescription: d\n---\n')
const loop = path.join(scratch, '.claude/loop.md')
const ids = (code: string) =>
  lintMarkdown('skill-loop-reference-invocable', code, loop).map((m) => m.messageId)

describe('skill-loop-reference-invocable (red)', () => {
  it.fails('reports a manual-only skill', () => {
    expect(ids('/deploy staging\n')).toEqual(['manualOnly'])
  })
  it.fails('stays silent for an invocable skill', () => {
    expect(ids('/review 12\n')).toEqual([])
  })
})
