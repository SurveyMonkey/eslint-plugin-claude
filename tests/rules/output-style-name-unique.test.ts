// The output styles page, "Create a custom output style": the file name is
// the style name unless `name` is set. The files are on disk, because the
// rule reads the other styles of the folder.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const style = (name: string) => `---\nname: ${name}\n---\n\nBody.\n`
const lint = (root: string, at: string, code: string) =>
  lintMarkdown('output-style-name-unique', code, path.join(root, at))

describe('output-style-name-unique', () => {
  it.fails('reports two styles of one folder with one name', () => {
    const root = repo({ '.claude/output-styles/b.md': style('dup') })
    const messages = lint(root, '.claude/output-styles/a.md', style('dup'))
    expect(messages).toMatchObject([{ messageId: 'duplicate', line: 2, column: 7 }])
    expect(messages[0]?.message).toContain('`b.md`')
  })

  it.fails('stays silent for styles with different names', () => {
    const root = repo({ '.claude/output-styles/b.md': style('other') })
    expect(lint(root, '.claude/output-styles/a.md', style('dup'))).toEqual([])
  })
})
