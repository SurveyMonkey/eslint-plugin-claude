// The sub-agents page, "Understand automatic delegation": "To encourage proactive delegation,
// include phrases like "use proactively" in your subagent's description field." The rule reads
// the description of the agent. It reports a description that has no such phrase.
import { describe, expect, it } from 'vitest'
import { lintAt, PLACES } from '../agent-description.test-support.ts'

const lint = (description: string, place: string = PLACES.local) =>
  lintAt('agent-description-proactive', `---\nname: a\n${description}---\n\nBody.\n`, place)
const plain = (text: string) => lint(`description: ${text}\n`)

describe('agent-description-proactive', () => {
  it('reports a description with no phrase, on the value', () => {
    expect(plain('Reviews code.')).toMatchObject([
      { messageId: 'missing', line: 3, column: 14, endLine: 3, endColumn: 27 },
    ])
  })

  it('reports each place of an agent', () => {
    for (const place of Object.values(PLACES)) {
      expect(lint('description: Reviews code.\n', place), place).toHaveLength(1)
    }
  })

  it('reports a longer word that holds the phrase, and the word proactive', () => {
    expect(plain('Reviews code. Not proactivelyish.')).toHaveLength(1)
    expect(plain('Be proactive.')).toHaveLength(1)
    expect(plain('Reviews code. Unproactively.')).toHaveLength(1)
  })

  it('reports a description that spans lines, with no phrase', () => {
    expect(lint('description: |\n  Reviews code.\n  Runs often.\n')).toHaveLength(1)
  })

  describe('stays silent', () => {
    it('for the phrase, in any letter case', () => {
      for (const text of [
        'Use proactively',
        'use proactively',
        'use PROACTIVELY',
        'USE PROACTIVELY',
      ]) {
        expect(plain(`Reviews code. ${text} after a change.`)).toEqual([])
      }
    })
    it('for the word proactively in another phrase', () => {
      expect(plain('Reviews code proactively.')).toEqual([])
      expect(plain('Use this agent proactively.')).toEqual([])
    })
    it('for the phrase in each place', () => {
      for (const place of Object.values(PLACES)) {
        expect(lint('description: Use proactively.\n', place), place).toEqual([])
      }
    })
    it('for the phrase on a later line of a block', () => {
      expect(lint('description: |\n  Reviews code.\n  Use proactively.\n')).toEqual([])
    })
    it('for a description that is missing, empty or not a string', () => {
      expect(lint('')).toEqual([])
      expect(lint('description:\n')).toEqual([])
      expect(lint('description: ""\n')).toEqual([])
      expect(lint('description: "  "\n')).toEqual([])
      expect(lint('description: 5\n')).toEqual([])
      expect(lint('description: [a]\n')).toEqual([])
    })
    it('for a file with no frontmatter, a bad block, or outside the agent folders', () => {
      expect(lintAt('agent-description-proactive', 'Body only.\n')).toEqual([])
      expect(lintAt('agent-description-proactive', '---\nname: [a\n---\n')).toEqual([])
      expect(
        lintAt('agent-description-proactive', '---\ndescription: d\n---\n', 'docs/a.md'),
      ).toEqual([])
      expect(
        lintAt('agent-description-proactive', '---\ndescription: d\n---\n', 'plugins/p/other/a.md'),
      ).toEqual([])
    })
    it('for a plugin file that its manifest leaves out', () => {
      expect(lint('description: d\n', 'plugins/q/agents/a.md')).toEqual([])
      expect(lint('description: d\n', 'plugins/q/custom/b.md')).toEqual([])
    })
  })
})
