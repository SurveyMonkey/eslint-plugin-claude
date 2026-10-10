// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const ids = (code: string) =>
  lintMarkdown('skill-side-effects-manual-only', code, file).map((m) => m.messageId)

describe('skill-side-effects-manual-only (red)', () => {
  it.fails('reports git push in allowed-tools', () => {
    expect(ids('---\nallowed-tools: Bash(git push *)\n---\n\nShip it.\n')).toEqual(['sideEffect'])
  })
  it.fails('reports git push in an injected command', () => {
    expect(ids('---\ndescription: d\n---\n\n!`git push origin main`\n')).toEqual(['sideEffect'])
  })
  it.fails('stays silent when the skill is manual only', () => {
    expect(
      ids(
        '---\ndisable-model-invocation: true\nallowed-tools: Bash(git push *)\n---\n\nShip it.\n',
      ),
    ).toEqual([])
  })
})
