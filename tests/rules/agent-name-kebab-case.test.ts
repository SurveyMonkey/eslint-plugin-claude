// The sub-agents page, frontmatter reference: `name` is a "Unique identifier ... such as
// `code-reviewer` or `reviewer-v2`. ... The filename doesn't have to match." Every documented
// example is lowercase words joined by hyphens. The rule reports a name of another shape. The
// built-in names are the case of `agent-name-shadows-builtin`.
import { describe, expect, it } from 'vitest'
import { lintAt, PLACES } from '../agent-description.test-support.ts'

const lint = (name: string, place: string = PLACES.local) =>
  lintAt('agent-name-kebab-case', `---\nname: ${name}\ndescription: d\n---\n\nBody.\n`, place)

describe('agent-name-kebab-case', () => {
  it('reports a name that is not kebab-case, on the value', () => {
    expect(lint('My_Agent')).toMatchObject([
      { messageId: 'notKebab', line: 2, column: 7, endLine: 2, endColumn: 15 },
    ])
    expect(lint('My_Agent')[0]?.message).toContain('My_Agent')
  })

  it('reports other shapes', () => {
    for (const name of [
      'MyAgent',
      'my_agent',
      '"my agent"',
      '-lead',
      'lead-',
      'a--b',
      'a.b',
      'é',
    ]) {
      expect(lint(name), name).toHaveLength(1)
    }
  })

  it('reports each place of an agent', () => {
    for (const place of Object.values(PLACES)) {
      expect(lint('My_Agent', place), place).toHaveLength(1)
    }
  })

  describe('stays silent', () => {
    it('for kebab-case, in each place', () => {
      for (const place of Object.values(PLACES)) {
        expect(lint('my-agent', place), place).toEqual([])
      }
    })
    it('for the documented examples and digits', () => {
      for (const name of ['code-reviewer', 'reviewer-v2', 'a', 'agent2', '"2fa"', 'v2-reviewer']) {
        expect(lint(name), name).toEqual([])
      }
    })
    it('for a name that differs from the file name', () => {
      expect(lint('reviewer')).toEqual([])
      expect(lint('reviewer', 'plugins/p/agents/other-name.md')).toEqual([])
    })
    it('for the name of a built-in agent', () => {
      for (const name of ['Explore', 'Plan', 'general-purpose', 'claude', 'claude-code-guide']) {
        expect(lint(name), name).toEqual([])
      }
    })
    it('for a name that is missing, empty or not a string', () => {
      expect(lint('')).toEqual([])
      expect(lint('5')).toEqual([])
      expect(lint('[a]')).toEqual([])
      expect(lint('true')).toEqual([])
      expect(lintAt('agent-name-kebab-case', '---\ndescription: d\n---\n\nBody.\n')).toEqual([])
    })
    it('for a file with no frontmatter, a bad block, or outside the agent folders', () => {
      expect(lintAt('agent-name-kebab-case', 'Body only.\n')).toEqual([])
      expect(lintAt('agent-name-kebab-case', '---\nname: [My_A\n---\n')).toEqual([])
      expect(lint('My_Agent', 'docs/a.md')).toEqual([])
      expect(lint('My_Agent', 'plugins/q/agents/a.md')).toEqual([])
    })
  })
})
