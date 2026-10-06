// `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` makes each subagent use one model, so
// the `model` of a local agent has no effect. The settings are on disk,
// because the rule reads `.claude/settings.json` and `.claude/settings.local.json`.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import rule from '../../src/rules/agent-model-forced.ts'
import { agent, lintWith, repo } from '../agent-settings.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const settings = (env: Record<string, unknown>) => JSON.stringify({ env })
const FORCE = 'CLAUDE_CODE_SUBAGENT_MODEL_FORCE'
const AGENT = '.claude/agents/a.md'
const run = (files: Record<string, string>, code = agent('model: haiku\n'), at = AGENT) => {
  const root = repo(files)
  return lintWith(rule, code, path.join(root, at))
}

describe('agent-model-forced', () => {
  for (const value of ['1', 'true', 'TRUE']) {
    it(`reports a model with the force variable ${value}`, () => {
      const messages = run({ '.claude/settings.json': settings({ [FORCE]: value }) })
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({ messageId: 'forced', line: 4, column: 1, endColumn: 13 })
    })
  }

  it('reports when the local file turns the variable on', () => {
    const messages = run({
      '.claude/settings.json': settings({ [FORCE]: '0' }),
      '.claude/settings.local.json': settings({ [FORCE]: '1' }),
    })
    expect(messages).toHaveLength(1)
  })

  it('reports an agent in a subfolder of agents', () => {
    const messages = run(
      { '.claude/settings.json': settings({ [FORCE]: '1' }) },
      agent('model: haiku\n'),
      '.claude/agents/team/a.md',
    )
    expect(messages).toHaveLength(1)
  })

  describe('stays silent', () => {
    const on = { '.claude/settings.json': settings({ [FORCE]: '1' }) }

    it('for a plugin agent', () => {
      expect(lintWith(rule, agent('model: haiku\n'), pluginAgent())).toEqual([])
    })
    it('without a settings file', () => {
      expect(run({})).toEqual([])
    })
    it('when the settings leave out the variable', () => {
      expect(run({ '.claude/settings.json': settings({ OTHER: '1' }) })).toEqual([])
      expect(run({ '.claude/settings.json': '{}' })).toEqual([])
      expect(run({ '.claude/settings.json': '{"env":5}' })).toEqual([])
    })
    it('when the variable has a safe value', () => {
      for (const value of ['0', 'false', '', 1]) {
        expect(run({ '.claude/settings.json': settings({ [FORCE]: value }) })).toEqual([])
      }
    })
    it('when the local file turns the variable off', () => {
      expect(run({ ...on, '.claude/settings.local.json': settings({ [FORCE]: '0' }) })).toEqual([])
    })
    it('for an agent without a model', () => {
      expect(run(on, agent(''))).toEqual([])
      expect(run(on, agent('model:\n'))).toEqual([])
    })
    it('for a model of the wrong type', () => {
      expect(run(on, agent('model: 5\n'))).toEqual([])
      expect(run(on, agent('model: [a]\n'))).toEqual([])
    })
    it('for a file with no frontmatter or broken frontmatter', () => {
      expect(run(on, 'Body only.\n')).toEqual([])
      expect(run(on, '---\nmodel: [unclosed\n---\n\nBody.\n')).toEqual([])
    })
    it('for a file outside the agents folders', () => {
      expect(run(on, agent('model: haiku\n'), 'docs/a.md')).toEqual([])
    })
    it('when a settings file does not parse', () => {
      expect(run({ '.claude/settings.json': '{' })).toEqual([])
    })
    it('when a settings file cannot be read', () => {
      if (chmodCannotBlock) {
        return
      }
      const root = repo({ '.claude/settings.json': settings({ [FORCE]: '1' }) })
      const file = path.join(root, '.claude/settings.json')
      withoutAccess(file, () => {
        expect(lintWith(rule, agent('model: haiku\n'), path.join(root, AGENT))).toEqual([])
      })
    })
  })
})
