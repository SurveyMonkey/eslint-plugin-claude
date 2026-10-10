// The plugin components page, "Organize agents in subfolders": the scoped
// name of a plugin agent is the plugin name, each subfolder and the file
// name, or the `name` field in place of the file name. The files are on disk.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { agent, repo } from '../agent-settings.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const PLUGIN = { '.claude-plugin/plugin.json': '{}' }
const lint = (root: string, at: string, code?: string) =>
  lintMarkdown('agent-plugin-scoped-name-unique', code ?? agent('', 'x'), path.join(root, at))

describe('agent-plugin-scoped-name-unique', () => {
  it.fails('reports a file whose name field is the file name of another file', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': agent('', 'b') })
    const messages = lint(root, 'agents/a.md', agent('', 'b'))
    expect(messages).toMatchObject([{ messageId: 'duplicate', line: 2, column: 7 }])
  })

  it.fails('stays silent for scoped names that differ', () => {
    const root = repo({ ...PLUGIN, 'agents/b.md': agent('', 'b') })
    expect(lint(root, 'agents/a.md', agent('', 'c'))).toEqual([])
  })
})
