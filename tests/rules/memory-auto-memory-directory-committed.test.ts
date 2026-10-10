// A project settings file can set `autoMemoryDirectory`. Claude Code honors it under the same
// workspace trust rule as hooks in settings files. While
// `permissions.blockReadsOutsideWorkingDirectories` is on, it loads no auto memory from a
// directory that a repository-supplied settings file chooses
// (https://code.claude.com/docs/en/memory#storage-location). Any settings scope can set the key,
// so the rule reads the two project files only. The globs are in tests/configs.test.ts.
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'

const RULE = 'memory-auto-memory-directory-committed'

/** The messages for the settings text `code` in the file `file`. */
function lint(code: string, file = '.claude/settings.json') {
  return new Linter({ cwd: '/' }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${RULE}`]: 'error' },
      },
    ],
    { filename: `/repo/${file}` },
  )
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it.fails('reports the key in the project file, at the member', () => {
    const messages = lint('{\n  "autoMemoryDirectory": "~/team-memory"\n}\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'committed',
      line: 2,
      column: 3,
      endLine: 2,
      endColumn: 41,
    })
    expect(messages[0]?.message).toContain('`.claude/settings.json`')
    expect(messages[0]?.message).toContain('blockReadsOutsideWorkingDirectories')
  })

  it.fails('reports the key in the local file, and names that file', () => {
    const messages = lint('{"autoMemoryDirectory": "/srv/memory"}', '.claude/settings.local.json')
    expect(ids(messages)).toEqual(['committed'])
    expect(messages[0]?.message).toContain('`.claude/settings.local.json`')
  })

  it.fails('reports a value of any type except null, since the key is set', () => {
    for (const value of ['"relative/dir"', '""', '5', 'true', '["a"]', '{"a": 1}']) {
      expect(ids(lint(`{"autoMemoryDirectory": ${value}}`)), value).toEqual(['committed'])
    }
  })

  it.fails('reports the last of two keys of one name, once', () => {
    const messages = lint('{"autoMemoryDirectory": "~/a", "autoMemoryDirectory": "~/b"}')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.column).toBe(33)
  })

  it.fails('stays silent when the key is not set, or null, which reads as unset', () => {
    expect(lint('{}')).toEqual([])
    expect(lint('{"autoMemoryEnabled": true}')).toEqual([])
    expect(lint('{"autoMemoryDirectory": null}')).toEqual([])
    expect(lint('{"autoMemoryDirectory": "~/a", "autoMemoryDirectory": null}')).toEqual([])
    expect(lint('{"nested": {"autoMemoryDirectory": "~/a"}}')).toEqual([])
    expect(lint('[1]')).toEqual([])
  })

  it.fails('stays silent on a managed file, which is not a repository-supplied project file', () => {
    const code = '{"autoMemoryDirectory": "/srv/memory"}'
    expect(lint(code, 'managed-settings.json')).toEqual([])
    expect(lint(code, 'managed-settings.d/10-memory.json')).toEqual([])
    expect(lint(code, 'managed-settings.d/.20-hidden.json')).toEqual([])
    expect(lint(code, 'managed-settings.d/settings.local.json')).toEqual([])
  })
})
