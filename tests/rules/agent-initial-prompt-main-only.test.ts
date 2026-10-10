// The sub-agents page, frontmatter reference, `initialPrompt`: the text is auto-submitted "when
// this agent runs as the main session agent (via `--agent` or the `agent` setting)". The rule
// reads the `agent` key of the committed settings. It cannot see the `--agent` flag. The settings
// are on disk, because the rule reads them in the project folder and in each folder above it.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { agent, repo } from '../agent-settings.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const unreadable = chmodCannotBlock ? it.skip : it
const AGENT = '.claude/agents/a.md'
const PROMPT = 'initialPrompt: Start with /review\n'
const named = (name: unknown) => JSON.stringify({ agent: name })
const run = (
  files: Record<string, string>,
  code = agent(PROMPT),
  at = AGENT,
  options: unknown[] = [],
) => lintAgent('agent-initial-prompt-main-only', code, path.join(repo(files), at), options)

describe('agent-initial-prompt-main-only', () => {
  it('reports when no settings file names the agent, on the field', () => {
    expect(run({})).toMatchObject([
      { messageId: 'ignored', line: 4, column: 1, endLine: 4, endColumn: 34 },
    ])
  })

  it('reports when the agent setting names another agent', () => {
    expect(run({ '.claude/settings.json': named('other') })).toHaveLength(1)
  })

  it('reports when the agent setting is not a string', () => {
    expect(run({ '.claude/settings.json': named(5) })).toHaveLength(1)
  })

  it('reports an agent in a subfolder of agents', () => {
    expect(run({}, agent(PROMPT), '.claude/agents/team/a.md')).toHaveLength(1)
  })

  describe('stays silent', () => {
    it('when the settings name the agent', () => {
      expect(run({ '.claude/settings.json': named('a') })).toEqual([])
      expect(run({ '.claude/settings.local.json': named('a') })).toEqual([])
    })
    it('when the settings of a folder above name the agent', () => {
      const files = { '.claude/settings.json': named('a') }
      expect(run(files, agent(PROMPT), 'pkg/.claude/agents/a.md')).toEqual([])
    })
    it('for a name in the option allow', () => {
      expect(run({}, agent(PROMPT), AGENT, [{ allow: ['a'] }])).toEqual([])
    })
    it('for a plugin agent', () => {
      expect(lintAgent('agent-initial-prompt-main-only', agent(PROMPT), pluginAgent())).toEqual([])
    })
    it('for an initialPrompt with no text', () => {
      expect(run({}, agent(''))).toEqual([])
      expect(run({}, agent('initialPrompt:\n'))).toEqual([])
      expect(run({}, agent('initialPrompt: ""\n'))).toEqual([])
      expect(run({}, agent('initialPrompt: 5\n'))).toEqual([])
    })
    it('for an agent whose name is not a string', () => {
      expect(run({}, agent(PROMPT, '5'))).toEqual([])
      expect(run({}, `---\n${PROMPT}---\n\nBody.\n`)).toEqual([])
    })
    it('for a file with no frontmatter, or outside the agents folders', () => {
      expect(run({}, 'Body only.\n')).toEqual([])
      expect(run({}, agent(PROMPT), 'docs/a.md')).toEqual([])
    })
    it('when a settings file does not parse, here or above', () => {
      expect(run({ '.claude/settings.json': '{' })).toEqual([])
      expect(
        run({ '.claude/settings.json': '{' }, agent(PROMPT), 'pkg/.claude/agents/a.md'),
      ).toEqual([])
    })
    unreadable('when a settings file cannot be read', () => {
      const root = repo({ '.claude/settings.json': named('other') })
      withoutAccess(path.join(root, '.claude/settings.json'), () => {
        expect(
          lintAgent('agent-initial-prompt-main-only', agent(PROMPT), path.join(root, AGENT)),
        ).toEqual([])
      })
    })
  })
})
