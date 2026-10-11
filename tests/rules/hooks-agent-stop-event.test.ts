// Claude Code converts a `Stop` hook in the frontmatter of a subagent to `SubagentStop`
// (https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents and
// https://code.claude.com/docs/en/sub-agents#hooks-in-subagent-frontmatter).
import { describe, expect, it } from 'vitest'
import {
  command,
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  markdownIds,
  SETTINGS,
  settings,
} from '../hooks.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const name = 'hooks-agent-stop-event'
const yaml = (event: string) =>
  frontmatter(`${event}:\n  - hooks:\n      - type: command\n        command: ./c.sh\n`)

describe(`${name}: the report`, () => {
  it('reports a Stop hook in the frontmatter of a project subagent', () => {
    expect(markdownIds(name, yaml('Stop'), FILES.agent)).toEqual(['stop'])
  })

  it('reports at the Stop key, and names SubagentStop', () => {
    const [message] = lintMarkdown(name, yaml('Stop'), FILES.agent)
    expect([message?.line, message?.column]).toEqual([5, 3])
    expect(message?.message).toBe(
      'Claude Code converts a "Stop" hook in subagent frontmatter to "SubagentStop". Name the event "SubagentStop", so that the file says what fires. Keep "Stop" only for an agent that you run as the main session.',
    )
  })

  it('reports once for a Stop key next to a SubagentStop key', () => {
    const text = frontmatter(
      'Stop:\n  - hooks:\n      - type: command\n        command: ./c.sh\nSubagentStop:\n  - hooks:\n      - type: command\n        command: ./c.sh\n',
    )
    expect(markdownIds(name, text, FILES.agent)).toEqual(['stop'])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for SubagentStop and for other events in a subagent', () => {
    expect(markdownIds(name, yaml('SubagentStop'), FILES.agent)).toEqual([])
    expect(markdownIds(name, yaml('PreToolUse'), FILES.agent)).toEqual([])
    expect(markdownIds(name, yaml('StopFailure'), FILES.agent)).toEqual([])
  })

  it('is silent for a Stop hook in a skill, which Claude Code does not convert', () => {
    expect(markdownIds(name, yaml('Stop'), FILES.skill)).toEqual([])
  })

  it('is silent for a Stop hook with no handler, and for an agent with no hooks', () => {
    expect(markdownIds(name, frontmatter('Stop: []\n'), FILES.agent)).toEqual([])
    expect(markdownIds(name, '---\nname: a\ndescription: d\n---\n', FILES.agent)).toEqual([])
  })

  it('is silent for a Stop hook in a settings file or a plugin hooks.json', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(jsonIds(name, settings(hooks('Stop', [command()])), file), file).toEqual([])
    }
  })

  it('is silent for a plugin agent, where Claude Code ignores hooks', () => {
    expect(markdownIds(name, yaml('Stop'), '/repo/plugins/p/agents/a.md')).toEqual([])
  })
})
