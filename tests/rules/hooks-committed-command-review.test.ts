// A command hook runs with the full user permissions
// (https://code.claude.com/docs/en/hooks#disclaimer). Claude Code runs hooks outside the sandbox
// (https://code.claude.com/docs/en/plugins/security#understand-what-a-plugin-can-do). In a `claude -p` or SDK session, the
// hooks of a project settings file and of a project skill run in a folder that nobody trusted
// (https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder). The rule asks for a review
// of each command hook that a repository commits.
import { describe, expect, it } from 'vitest'
import {
  command,
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  markdownIds,
  settings,
} from '../hooks.test-support.ts'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-committed-command-review'
const ids = (handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks('PostToolUse', [handler])), file)
const yaml = 'PostToolUse:\n  - hooks:\n      - type: command\n        command: ./a.sh\n'

describe(`${name}: the report`, () => {
  it.fails('reports a command hook in .claude/settings.json', () => {
    expect(ids(command())).toEqual(['committed'])
  })

  it.fails('reports a command hook in a plugin hooks.json', () => {
    expect(ids(command(), FILES.plugin)).toEqual(['plugin'])
  })

  it.fails('reports a command hook in agent frontmatter', () => {
    expect(markdownIds(name, frontmatter(yaml), FILES.agent)).toEqual(['agent'])
  })

  it.fails('reports a command hook in skill frontmatter', () => {
    expect(markdownIds(name, frontmatter(yaml), FILES.skill)).toEqual(['committed'])
  })

  it.fails('reports a command hook in the skill of a plugin as a plugin hook', () => {
    expect(markdownIds(name, frontmatter(yaml), pluginSkill())).toEqual(['plugin'])
  })

  it.fails('reports each command handler, at the handler', () => {
    const text =
      '{\n  "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "a"}, {"type": "http", "url": "u"}, {"type": "command", "command": "b"}]}]}\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['committed', 2, 28],
      ['committed', 2, 103],
    ])
  })

  it.fails('names the risk in each message', () => {
    expect(lintJson(name, settings(hooks('Stop', [command()])), FILES.project)[0]?.message).toBe(
      'This command hook runs with your full user permissions, outside the sandbox. In a "claude -p" or SDK session it runs in a folder that nobody trusted, with no dialog. Review the command.',
    )
    expect(lintJson(name, settings(hooks('Stop', [command()])), FILES.plugin)[0]?.message).toBe(
      'This plugin command hook runs with your full user permissions, outside the sandbox. Review the command before you publish or install the plugin.',
    )
  })
})

describe(`${name}: the silent cases`, () => {
  it.fails('is silent in .claude/settings.local.json, which nobody commits', () => {
    expect(ids(command(), FILES.local)).toEqual([])
  })

  it.fails('is silent in a managed settings file, which an administrator sets', () => {
    for (const file of [FILES.managed, FILES.dropIn]) {
      expect(ids(command(), file), file).toEqual([])
    }
  })

  it.fails('is silent for a hidden drop-in', () => {
    expect(ids(command(), FILES.hidden)).toEqual([])
  })

  it.fails('is silent for the other handler types, and a handler with no type', () => {
    for (const type of ['http', 'mcp_tool', 'prompt', 'agent', 'other']) {
      expect(ids({ type, command: 'a' }), type).toEqual([])
    }
    expect(ids({ command: 'a' })).toEqual([])
  })

  it.fails('is silent for a file with no hooks', () => {
    expect(jsonIds(name, '{}', FILES.project)).toEqual([])
    expect(markdownIds(name, '---\nname: a\ndescription: d\n---\n', FILES.agent)).toEqual([])
  })
})
