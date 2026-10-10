// The sub-agents page, frontmatter reference and "Choose a model": `model` is `sonnet`, `opus`,
// `haiku`, `fable`, `inherit`, or a full model ID, and a full ID "accepts the same values as the
// `--model` flag". The model configuration page lists the aliases of `--model`.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { agent } from '../agent-settings.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'

const AGENT = path.resolve('/project/.claude/agents/a.md')
const lint = (fields: string, filename = AGENT, options: unknown[] = []) =>
  lintAgent('agent-model-value', agent(fields), filename, options)

describe('agent-model-value', () => {
  it('reports a value that is no alias, no ID and no inherit, on the value', () => {
    expect(lint('model: sonet\n')).toMatchObject([
      { messageId: 'unknown', line: 4, column: 8, endColumn: 13 },
    ])
    expect(lint('model: sonet\n')[0]?.message).toContain('sonet')
  })

  it('reports other wrong shapes', () => {
    for (const value of ['gpt-4', 'claude-', 'claude opus', 'claude4', '"opus plan"']) {
      expect(lint(`model: ${value}\n`)).toHaveLength(1)
    }
  })

  it('reports a plugin agent', () => {
    expect(lint('model: sonet\n', pluginAgent())).toHaveLength(1)
  })

  it('stays silent for each value the docs list', () => {
    for (const value of ['sonnet', 'opus', 'haiku', 'fable', 'inherit', 'claude-opus-5-5']) {
      expect(lint(`model: ${value}\n`)).toEqual([])
    }
  })

  it('stays silent for the other aliases and the forms of --model', () => {
    for (const value of ['best', 'opusplan', 'default', 'opus[1m]', 'claude-sonnet-5[1m]']) {
      expect(lint(`model: "${value}"\n`)).toEqual([])
    }
    expect(lint('model: Sonnet\n')).toEqual([])
    expect(lint('model: INHERIT\n')).toEqual([])
  })

  it('stays silent for a provider ID', () => {
    for (const value of [
      'us.anthropic.claude-opus-4-8',
      'arn:aws:bedrock:us-east-1:111111111111:application-inference-profile/abc',
      'anthropic.claude-sonnet-5',
    ]) {
      expect(lint(`model: ${value}\n`)).toEqual([])
    }
  })

  it('stays silent for a value in the option allow', () => {
    expect(lint('model: team-gateway-model\n', AGENT, [{ allow: ['team-gateway-model'] }])).toEqual(
      [],
    )
  })

  it('stays silent when model is absent, empty or not a string', () => {
    expect(lint('')).toEqual([])
    expect(lint('model:\n')).toEqual([])
    expect(lint('model: ""\n')).toEqual([])
    expect(lint('model: 5\n')).toEqual([])
    expect(lint('model: [opus]\n')).toEqual([])
    expect(lint('model: sonet\n', path.resolve('/project/docs/a.md'))).toEqual([])
  })
})
