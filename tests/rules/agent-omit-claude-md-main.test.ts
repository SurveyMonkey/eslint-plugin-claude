// The `agent` setting runs a subagent as the main thread. `omitClaudeMd` then
// leaves the CLAUDE.md files out of the main session. The settings are on
// disk, because the rule reads `.claude/settings.json` and `.claude/settings.local.json`.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import rule from '../../src/rules/agent-omit-claude-md-main.ts'
import { agent, lintWith, repo } from '../agent-settings.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const AGENT = '.claude/agents/a.md'
const named = (name: string) => JSON.stringify({ agent: name })
const run = (files: Record<string, string>, code = agent('omitClaudeMd: true\n'), at = AGENT) => {
  const root = repo(files)
  return lintWith(rule, code, path.join(root, at))
}

describe('agent-omit-claude-md-main', () => {
  it('reports when the agent setting names the agent', () => {
    const messages = run({ '.claude/settings.json': named('a') })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'omitted', line: 4, column: 1, endColumn: 19 })
  })

  it('reports when the local file names the agent', () => {
    const messages = run({
      '.claude/settings.json': named('other'),
      '.claude/settings.local.json': named('a'),
    })
    expect(messages).toHaveLength(1)
  })

  it('reports an agent in a subfolder of agents', () => {
    const messages = run(
      { '.claude/settings.json': named('a') },
      agent('omitClaudeMd: true\n'),
      '.claude/agents/team/a.md',
    )
    expect(messages).toHaveLength(1)
  })

  describe('stays silent', () => {
    const names = { '.claude/settings.json': named('a') }

    it('for a plugin agent', () => {
      expect(lintWith(rule, agent('omitClaudeMd: true\n'), pluginAgent())).toEqual([])
    })
    it('without a settings file', () => {
      expect(run({})).toEqual([])
    })
    it('when the settings leave out the agent key', () => {
      expect(run({ '.claude/settings.json': '{}' })).toEqual([])
    })
    it('when the agent key names another agent', () => {
      expect(run({ '.claude/settings.json': named('other') })).toEqual([])
    })
    it('when the agent key is not a string', () => {
      expect(run({ '.claude/settings.json': '{"agent":5}' })).toEqual([])
      expect(run({ '.claude/settings.json': '{"agent":["a"]}' })).toEqual([])
    })
    it('when the local file names another agent', () => {
      expect(run({ ...names, '.claude/settings.local.json': named('other') })).toEqual([])
    })
    it('for an agent that does not set omitClaudeMd to true', () => {
      expect(run(names, agent(''))).toEqual([])
      expect(run(names, agent('omitClaudeMd: false\n'))).toEqual([])
      expect(run(names, agent('omitClaudeMd: "true"\n'))).toEqual([])
      expect(run(names, agent('omitClaudeMd:\n'))).toEqual([])
    })
    it('for an agent whose name is not a string', () => {
      expect(run(names, agent('omitClaudeMd: true\n', '5'))).toEqual([])
      expect(run(names, '---\nomitClaudeMd: true\n---\n\nBody.\n')).toEqual([])
    })
    it('for an agent with no name when the settings name no agent', () => {
      expect(
        run({ '.claude/settings.json': '{}' }, '---\nomitClaudeMd: true\n---\n\nBody.\n'),
      ).toEqual([])
    })
    it('for a file with no frontmatter or broken frontmatter', () => {
      expect(run(names, 'Body only.\n')).toEqual([])
      expect(run(names, '---\nomitClaudeMd: [unclosed\n---\n\nBody.\n')).toEqual([])
    })
    it('for a file outside the agents folders', () => {
      expect(run(names, agent('omitClaudeMd: true\n'), 'docs/a.md')).toEqual([])
    })
    it('when a settings file does not parse', () => {
      expect(run({ '.claude/settings.json': '{' })).toEqual([])
    })
    it('when a settings file cannot be read', () => {
      if (chmodCannotBlock) {
        return
      }
      const root = repo(names)
      withoutAccess(path.join(root, '.claude/settings.json'), () => {
        expect(lintWith(rule, agent('omitClaudeMd: true\n'), path.join(root, AGENT))).toEqual([])
      })
    })
  })
})
