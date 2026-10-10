// A `disabledMcpjsonServers` entry in any settings file still rejects the server, so a name in
// both lists leaves the enable with no effect (settings reference). The lists of the settings
// files of one place merge: the two project files of a `.claude/` folder, or the files of one
// managed source. The files are on disk, so the cases use `Linter` and a repository with a `.git`
// directory.
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const NAME = 'mcp-approval-conflict'
const lists = (enabled?: unknown, disabled?: unknown) =>
  JSON.stringify({ enabledMcpjsonServers: enabled, disabledMcpjsonServers: disabled })

/** Lint `code` as `file` of a repository with `files`. */
function lint(code: string, files: Record<string, string>, file = '.claude/settings.json') {
  return lintJson(NAME, code, path.join(repo(files), file))
}
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

it('reports a name in both lists of one file, on the enabled entry', () => {
  const found = lint(lists(['a', 'db'], ['db']), {})
  expect(ids(found)).toEqual(['conflict'])
  expect(found[0]).toMatchObject({ line: 1, column: 31, endColumn: 35 })
  expect(found[0]?.message).toContain('"db"')
})
it('reports a name that the other project file disables', () => {
  expect(
    ids(lint(lists(['db']), { '.claude/settings.local.json': lists(undefined, ['db']) })),
  ).toEqual(['conflict'])
  expect(
    ids(
      lint(
        lists(['db']),
        { '.claude/settings.json': lists(undefined, ['db']) },
        '.claude/settings.local.json',
      ),
    ),
  ).toEqual(['conflict'])
})
it('reports in the file with the enabled entry, and not in the file with the disabled one', () => {
  const files = { '.claude/settings.json': lists(['db']) }
  expect(ids(lint(lists(undefined, ['db']), files, '.claude/settings.local.json'))).toEqual([])
})
it('reports in a managed file and a drop-in, from the files of the merged source', () => {
  const files = {
    'managed-settings.json': lists(undefined, ['db']),
    'managed-settings.d/10-a.json': lists(['db']),
    'managed-settings.d/20-b.json': lists(['x']),
  }
  expect(ids(lint(lists(['db']), files, 'managed-settings.d/30-c.json'))).toEqual(['conflict'])
  expect(
    ids(lint(files['managed-settings.d/10-a.json'], files, 'managed-settings.d/10-a.json')),
  ).toEqual(['conflict'])
  expect(ids(lint(files['managed-settings.json'], files, 'managed-settings.json'))).toEqual([])
})
it('does not mix the project files with a managed file', () => {
  const files = { 'managed-settings.json': lists(undefined, ['db']) }
  expect(ids(lint(lists(['db']), files))).toEqual([])
  const project = { '.claude/settings.json': lists(undefined, ['db']) }
  expect(ids(lint(lists(['db']), project, 'managed-settings.json'))).toEqual([])
})
it('stays silent for distinct names, and for a list on one side only', () => {
  expect(ids(lint(lists(['a'], ['b']), {}))).toEqual([])
  expect(ids(lint(lists(['a']), {}))).toEqual([])
  expect(ids(lint(lists(undefined, ['a']), {}))).toEqual([])
  expect(ids(lint(lists([], []), {}))).toEqual([])
  expect(ids(lint('{}', {}))).toEqual([])
  expect(ids(lint('[]', {}))).toEqual([])
})
it('reads the last of two list keys, and skips values it cannot read', () => {
  const twice =
    '{"enabledMcpjsonServers": ["db"], "enabledMcpjsonServers": ["x"], "disabledMcpjsonServers": ["db"]}'
  expect(ids(lint(twice, {}))).toEqual([])
  expect(ids(lint(lists([1, null, ['db']], ['db']), {}))).toEqual([])
  expect(ids(lint(lists('db', ['db']), {}))).toEqual([])
  expect(ids(lint(lists(['db'], 'db'), {}))).toEqual([])
  expect(
    ids(lint(lists(['db']), { '.claude/settings.local.json': lists(undefined, 'db') })),
  ).toEqual([])
  expect(
    ids(lint(lists(['db']), { '.claude/settings.local.json': lists(undefined, [1, 'db']) })),
  ).toEqual(['conflict'])
})
it('keeps the conflict of the file when a sibling cannot be read', () => {
  expect(ids(lint(lists(['db'], ['db']), { '.claude/settings.local.json': '{ not json' }))).toEqual(
    ['conflict'],
  )
  expect(ids(lint(lists(['db']), { '.claude/settings.local.json': '{ not json' }))).toEqual([])
  expect(ids(lint(lists(['db']), { '.claude/settings.local.json': '[1]' }))).toEqual([])
  const managed = { 'managed-settings.json': '{ not json' }
  expect(ids(lint(lists(['db'], ['db']), managed, 'managed-settings.d/10-a.json'))).toEqual([
    'conflict',
  ])
  expect(ids(lint(lists(['db']), managed, 'managed-settings.d/10-a.json'))).toEqual([])
})
it('keeps the conflict of the file when a sibling is locked', () => {
  const root = repo({ '.claude/settings.local.json': lists(undefined, ['db']) })
  if (chmodCannotBlock) {
    return
  }
  const file = path.join(root, '.claude', 'settings.json')
  const own = withoutAccess(path.join(root, '.claude', 'settings.local.json'), () =>
    lintJson(NAME, lists(['db'], ['db']), file),
  )
  expect(ids(own)).toEqual(['conflict'])
  const alone = withoutAccess(path.join(root, '.claude', 'settings.local.json'), () =>
    lintJson(NAME, lists(['db']), file),
  )
  expect(ids(alone)).toEqual([])
})
it('reads no hidden drop-in, and ignores a hidden sibling', () => {
  const hidden = 'managed-settings.d/.10-a.json'
  expect(ids(lint(lists(['db'], ['db']), {}, hidden))).toEqual([])
  const files = { 'managed-settings.d/.10-a.json': lists(undefined, ['db']) }
  expect(ids(lint(lists(['db']), files, 'managed-settings.json'))).toEqual([])
})
it('keeps the conflict that readable managed files show when one drop-in cannot be read', () => {
  const files = {
    'managed-settings.json': lists(undefined, ['db']),
    'managed-settings.d/05-bad.json': '{ nope',
  }
  expect(ids(lint(lists(['db']), files, 'managed-settings.d/10-a.json'))).toEqual(['conflict'])
})
it('reads no sibling that is a link out of the repository', () => {
  const root = repo({ '.claude/settings.json': '{}' })
  const outside = mkdtempSync(path.join(tmpdir(), 'mcp-conflict-outside-'))
  try {
    writeFileSync(path.join(outside, 'local.json'), lists(undefined, ['db']))
    symlinkSync(path.join(outside, 'local.json'), path.join(root, '.claude', 'settings.local.json'))
    const file = path.join(root, '.claude', 'settings.json')
    expect(ids(lintJson(NAME, lists(['db']), file))).toEqual([])
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
it('reads a sibling list of one character as a list, not as a string', () => {
  const sibling = { '.claude/settings.local.json': lists(undefined, 'd') }
  expect(ids(lint(lists(['d']), sibling))).toEqual([])
})
