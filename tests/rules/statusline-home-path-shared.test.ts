// The expected values come from the statusline page
// (https://code.claude.com/docs/en/statusline#manually-configure-a-status-line): the example
// `command` is `~/.claude/statusline.sh`, and `~` is the home directory of one user. The rule
// reads the shared file only, and reads no script. The file globs are in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const project = '/repo/.claude/settings.json'
const command = (text: unknown) =>
  JSON.stringify({ statusLine: { type: 'command', command: text } })
const ids = (code: string, filename = project) =>
  lintJson('statusline-home-path-shared', code, filename).map((m) => m.messageId)

describe('statusline-home-path-shared', () => {
  it.each([
    '~/.claude/statusline.sh',
    'bash ~/.claude/statusline.sh',
    '"~/.claude/my script.sh"',
    'cd ~/.claude/ && ./run.sh',
  ])('reports %s, on the command', (text) => {
    const [message] = lintJson('statusline-home-path-shared', command(text), project)
    expect(message?.messageId).toBe('home')
    expect(message?.column).toBe(43)
  })

  it.each([
    '.claude/statusline.sh',
    `\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`,
    '~/status.sh',
    '~/.claudex/s.sh',
    '$HOME/.claude/statusline.sh',
    '',
  ])('is silent for %j', (text) => {
    expect(ids(command(text))).toEqual([])
  })

  it('is silent for a command that is not a string, and when statusLine is unset', () => {
    expect(ids(command(1))).toEqual([])
    expect(ids(JSON.stringify({ statusLine: 'x' }))).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    const twice = '{"statusLine": {"command": "~/.claude/a.sh", "command": ".claude/a.sh"}}'
    expect(ids(twice)).toEqual([])
  })
})
