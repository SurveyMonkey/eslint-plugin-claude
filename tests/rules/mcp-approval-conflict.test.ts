// A `disabledMcpjsonServers` entry in any settings file still rejects the server, so a name in
// both lists leaves the enable with no effect (settings reference). The lists of the settings
// files of one place merge: the two project files of a `.claude/` folder, or the files of one
// managed source. The files are on disk, so the cases use `Linter` and a repository with a `.git`
// directory.
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

it.fails('reports a name in both lists of one file, on the enabled entry', () => {
  const found = lint(lists(['a', 'db'], ['db']), {})
  expect(ids(found)).toEqual(['conflict'])
  expect(found[0]).toMatchObject({ line: 1, column: 33, endColumn: 37 })
  expect(found[0]?.message).toContain('"db"')
})
it.fails('reports a name that the other project file disables', () => {
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
it.fails('reports in the file with the enabled entry, and not in the file with the disabled one', () => {
  const files = { '.claude/settings.json': lists(['db']) }
  expect(ids(lint(lists(undefined, ['db']), files, '.claude/settings.local.json'))).toEqual([])
})
it.fails('reports in a managed file and a drop-in, from the files of the merged source', () => {
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
it.fails('does not mix the project files with a managed file', () => {
  const files = { 'managed-settings.json': lists(undefined, ['db']) }
  expect(ids(lint(lists(['db']), files))).toEqual([])
  const project = { '.claude/settings.json': lists(undefined, ['db']) }
  expect(ids(lint(lists(['db']), project, 'managed-settings.json'))).toEqual([])
})
it.fails('stays silent for distinct names, and for a list on one side only', () => {
  expect(ids(lint(lists(['a'], ['b']), {}))).toEqual([])
  expect(ids(lint(lists(['a']), {}))).toEqual([])
  expect(ids(lint(lists(undefined, ['a']), {}))).toEqual([])
  expect(ids(lint(lists([], []), {}))).toEqual([])
  expect(ids(lint('{}', {}))).toEqual([])
  expect(ids(lint('[]', {}))).toEqual([])
})
it.fails('reads the last of two list keys, and skips values it cannot read', () => {
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
it.fails('keeps the conflict of the file when a sibling cannot be read', () => {
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
it.fails('keeps the conflict of the file when a sibling is locked', () => {
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
it.fails('reads no hidden drop-in, and ignores a hidden sibling', () => {
  const hidden = 'managed-settings.d/.10-a.json'
  expect(ids(lint(lists(['db'], ['db']), {}, hidden))).toEqual([])
  const files = { 'managed-settings.d/.10-a.json': lists(undefined, ['db']) }
  expect(ids(lint(lists(['db']), files, 'managed-settings.json'))).toEqual([])
})
