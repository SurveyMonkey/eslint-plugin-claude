// The sub-agents page, "Write subagent files": "The body becomes the system prompt that guides the
// subagent's behavior." A file with no body gives the agent no instructions. The rule reports a
// body that is empty or has only white space.
import { describe, expect, it } from 'vitest'
import { lintAt, PLACES } from '../agent-description.test-support.ts'

const HEAD = '---\nname: a\ndescription: d\n---\n'
const lint = (code: string, place: string = PLACES.local) =>
  lintAt('agent-body-nonempty', code, place)

describe('agent-body-nonempty', () => {
  it.fails('reports a file that ends at the closing delimiter, on that line', () => {
    expect(lint(HEAD)).toMatchObject([
      { messageId: 'empty', line: 4, column: 1, endLine: 4, endColumn: 4 },
    ])
  })

  it.fails('reports a closing delimiter with no final line break', () => {
    expect(lint('---\nname: a\ndescription: d\n---')).toMatchObject([
      { messageId: 'empty', line: 4, column: 1 },
    ])
  })

  it.fails('reports a body of white space only', () => {
    for (const body of ['\n', '\n\n', '   \n', '\n  \n\t\n', '\r\n\r\n', ' \n']) {
      expect(lint(HEAD + body), JSON.stringify(body)).toHaveLength(1)
    }
  })

  it.fails('reports each place of an agent', () => {
    for (const place of Object.values(PLACES)) {
      expect(lint(HEAD, place), place).toHaveLength(1)
    }
  })

  describe('stays silent', () => {
    it.fails('for a body with text, in each place', () => {
      for (const place of Object.values(PLACES)) {
        expect(lint(`${HEAD}\nYou review code.\n`, place), place).toEqual([])
      }
    })
    it.fails('for a body that is a heading, a comment or a code block', () => {
      expect(lint(`${HEAD}# Reviewer\n`)).toEqual([])
      expect(lint(`${HEAD}<!-- todo -->\n`)).toEqual([])
      expect(lint(`${HEAD}\`\`\`\nx\n\`\`\`\n`)).toEqual([])
    })
    it.fails('for a file with no frontmatter, or a block that does not parse', () => {
      expect(lint('')).toEqual([])
      expect(lint('\n')).toEqual([])
      expect(lint('Body only.\n')).toEqual([])
      expect(lint('---\nname: [a\n---\n')).toEqual([])
    })
    it.fails('for a file outside the agent folders, or one that a manifest leaves out', () => {
      expect(lint(HEAD, 'docs/a.md')).toEqual([])
      expect(lint(HEAD, 'plugins/q/agents/a.md')).toEqual([])
    })
  })
})
