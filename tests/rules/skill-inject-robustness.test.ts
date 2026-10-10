// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const ids = (code: string) =>
  lintMarkdown('skill-inject-robustness', code, file).map((m) => m.messageId)

describe('skill-inject-robustness (red)', () => {
  it.fails('reports a command that no allowed-tools rule matches', () => {
    expect(ids('---\nallowed-tools: Bash(gh *)\n---\n\n!`npm test`\n')).toEqual(['unmatched'])
  })
  it.fails('stays silent for a command that a rule matches', () => {
    expect(ids('---\nallowed-tools: Bash(gh *)\n---\n\n!`gh pr diff`\n')).toEqual([])
  })
  it.fails('reports a relative script path', () => {
    expect(ids('---\nallowed-tools: Bash\n---\n\n!`./scripts/run.sh`\n')).toEqual(['relativePath'])
  })
  it.fails('reports a check script with no fallback', () => {
    expect(ids(`---\nallowed-tools: Bash\n---\n\n!\`\${CLAUDE_SKILL_DIR}/check.sh\`\n`)).toEqual([
      'checkExit',
    ])
  })
  it.fails('reports a command that prints a placeholder', () => {
    expect(ids("---\nallowed-tools: Bash\n---\n\n```!\necho '!`date`'\n```\n")).toEqual(['nested'])
  })
})
