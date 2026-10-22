// The sub-agents page, frontmatter reference: `name` is a "Unique identifier ... such as
// `code-reviewer` or `reviewer-v2`. ... The filename doesn't have to match." Every documented
// example is lowercase words joined by hyphens. The rule reports a name of another shape. The
// built-in names are the case of `agent-name-shadows-builtin`.

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAt, PLACES } from '../agent-description.test-support.ts'
import { lintAgent } from '../agent-rules.test-support.ts'
import { repo } from '../agent-settings.test-support.ts'

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
      expect(lint('""')).toEqual([])
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

  // A marketplace entry with no `plugin.json` is the manifest. The check cannot model the
  // plugin of an entry whose key replaces a default location, so no report rests on its files.
  describe('for a plugin that a marketplace lists', () => {
    const bad = '---\nname: My_Agent\ndescription: d\n---\n\nBody.\n'
    const listed = (...plugins: object[]) => ({
      'p/agents/a.md': bad,
      '.claude-plugin/marketplace.json': JSON.stringify({ name: 'm', plugins }),
    })
    const lintListed = (files: Record<string, string>, dir: string) =>
      lintAgent('agent-name-kebab-case', bad, path.join(repo(files), dir, 'agents', 'a.md'))

    it('reports for a plain entry', () => {
      expect(lintListed(listed({ name: 'p', source: './p' }), 'p')).toHaveLength(1)
    })
    it('stays silent for an entry with a top-level themes or monitors key', () => {
      expect(lintListed(listed({ name: 'p', source: './p', themes: './t' }), 'p')).toEqual([])
      expect(lintListed(listed({ name: 'p', source: './p', monitors: './m.json' }), 'p')).toEqual(
        [],
      )
    })
    it('stays silent when a second entry names the directory with a replacing key', () => {
      const plain = { name: 'p', source: './p' }
      const replacing = { name: 'q', source: './p', agents: './agents/' }
      expect(lintListed(listed(plain, replacing), 'p')).toEqual([])
      expect(lintListed(listed(replacing, plain), 'p')).toEqual([])
    })
  })
})
