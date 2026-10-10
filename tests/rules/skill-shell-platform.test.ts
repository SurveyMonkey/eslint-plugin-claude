// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const skill = (shell: string) => `---\nshell: ${shell}\n---\n\n!\`date\`\n`
const ids = (code: string, platforms: string[]) =>
  lintMarkdown('skill-shell-platform', code, file, [{ platforms }]).map((m) => m.messageId)

describe('skill-shell-platform (red)', () => {
  it.fails('reports shell bash on Windows without Git Bash', () => {
    expect(ids(skill('bash'), ['windows-no-git-bash'])).toEqual(['bash'])
  })
  it.fails('reports shell powershell on macOS', () => {
    expect(ids(skill('powershell'), ['macos'])).toEqual(['powershell'])
  })
  it.fails('stays silent for shell bash on macOS', () => {
    expect(ids(skill('bash'), ['macos'])).toEqual([])
  })
})
