// A matcher or a hook field that names a thing which does not exist makes a hook that never fires. The
// docs: "A misspelled tool name produces a matcher that matches nothing"
// (https://code.claude.com/docs/en/debug-your-config#check-hooks). A `SubagentStart` and `SubagentStop`
// matcher is the `name` of a subagent
// (https://code.claude.com/docs/en/sub-agents#project-level-hooks-for-subagent-events). The `server` of an
// `mcp_tool` hook is "the name of a configured MCP server"
// (https://code.claude.com/docs/en/hooks#mcp-tool-hook-fields). The rule reads the agent files and the
// `.mcp.json` files of the repository. It reports no name of a kind that it cannot read in full.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { agent, repo } from '../agent-settings.test-support.ts'
import { command, FILES, frontmatter, hooks, markdownIds, settings } from '../hooks.test-support.ts'
import { lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'hooks-matcher-name-unresolved'
const json = JSON.stringify
const SETTINGS_FILE = '.claude/settings.json'
const mcp = (servers: unknown) => json({ mcpServers: servers })
const subagents = (matcher: unknown, event = 'SubagentStop') =>
  settings(hooks(event, [command()], matcher))
const server = (value: unknown) =>
  settings(hooks('PostToolUse', [{ type: 'mcp_tool', server: value, tool: 't' }]))

/** The messages for the text `text` at `target` of a repository that holds `files`. The repository holds
 *  the linted file too, so that a rule that reads siblings can meet it. */
function lint(
  files: Record<string, string>,
  text: string,
  target = SETTINGS_FILE,
  options: unknown[] = [],
) {
  const root = repo({ ...files, [target]: text })
  return lintJson(name, text, path.join(root, target), options)
}
const ids = (
  files: Record<string, string>,
  text: string,
  target = SETTINGS_FILE,
  options: unknown[] = [],
) => lint(files, text, target, options).map((message) => message.messageId)

describe(`${name}: a tool name`, () => {
  it.fails('reports a name that is no tool, on each tool event', () => {
    for (const event of [
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'PermissionRequest',
      'PermissionDenied',
    ]) {
      expect(ids({}, settings(hooks(event, [command()], 'Edt'))), event).toEqual(['tool'])
    }
  })

  it.fails('reports each unknown segment of a list, and names it', () => {
    const text = settings(hooks('PreToolUse', [command()], 'Bash|Edt, Wrte'))
    expect(ids({}, text)).toEqual(['tool', 'tool'])
    expect(lint({}, text)[0]?.message).toBe(
      'The matcher value "Edt" is not the name of a tool that Claude Code knows, so it matches no tool.',
    )
  })

  it.fails('reports in a plugin hooks.json, a skill and an agent, which need no sibling', () => {
    expect(
      ids({}, settings(hooks('PreToolUse', [command()], 'Edt')), 'plugins/p/hooks/hooks.json'),
    ).toEqual(['tool'])
    const text = frontmatter(
      'PreToolUse:\n  - matcher: Edt\n    hooks:\n      - type: command\n        command: ./a.sh\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['tool'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['tool'])
  })

  it.fails('is silent for a canonical name, an old name and an MCP name', () => {
    for (const matcher of [
      'Bash',
      'Task',
      'MultiEdit',
      'Edit|Write',
      'mcp__memory__create',
      'mcp__memory',
      'mcp__',
      'Cd',
    ]) {
      expect(ids({}, settings(hooks('PreToolUse', [command()], matcher))), matcher).toEqual([])
    }
  })

  it.fails('is silent for a case variant and the advisor, which hooks-matcher-never-matches reports', () => {
    for (const matcher of ['bash', 'WRITE', 'advisor', 'Advisor']) {
      expect(ids({}, settings(hooks('PreToolUse', [command()], matcher))), matcher).toEqual([])
    }
  })

  it.fails('is silent for a regular expression, a match-all matcher and an event that matches no tool', () => {
    for (const matcher of ['^Edt$', 'Edt.*', '*', '']) {
      expect(ids({}, settings(hooks('PreToolUse', [command()], matcher))), matcher).toEqual([])
    }
    expect(ids({}, settings(hooks('PreToolUse', [command()])))).toEqual([])
    for (const event of ['SessionStart', 'Notification', 'FileChanged', 'Stop', 'Bogus']) {
      expect(ids({}, settings(hooks(event, [command()], 'Edt'))), event).toEqual([])
    }
  })

  it.fails('is silent for a name in the option allow', () => {
    const text = settings(hooks('PreToolUse', [command()], 'Edt|Mine'))
    expect(ids({}, text, SETTINGS_FILE, [{ allow: ['Edt', 'Mine'] }])).toEqual([])
    expect(ids({}, text, SETTINGS_FILE, [{ allow: ['Mine'] }])).toEqual(['tool'])
  })

  it.fails('is silent for a hidden drop-in', () => {
    expect(
      ids({}, settings(hooks('PreToolUse', [command()], 'Edt')), 'managed-settings.d/.a.json'),
    ).toEqual([])
  })
})

describe(`${name}: a subagent name`, () => {
  const files = { '.claude/agents/reviewer.md': agent('', 'reviewer') }

  it.fails('reports an unknown agent name on SubagentStop and SubagentStart', () => {
    expect(ids(files, subagents('revewer'))).toEqual(['agent'])
    expect(ids(files, subagents('revewer', 'SubagentStart'))).toEqual(['agent'])
  })

  it.fails('names the agent, and reports each unknown name of a list', () => {
    const found = lint(files, subagents('reviewer|Explore, nope|zip'))
    expect(found.map((message) => message.messageId)).toEqual(['agent', 'agent'])
    expect(found[0]?.message).toBe(
      'No file in ".claude/agents/" defines an agent named "nope", and it is no built-in agent. The matcher matches no subagent.',
    )
  })

  it.fails('reports in settings.local.json', () => {
    expect(ids(files, subagents('nope'), '.claude/settings.local.json')).toEqual(['agent'])
  })

  it.fails('is silent for a known agent, a built-in agent and a case variant', () => {
    for (const matcher of [
      'reviewer',
      'REVIEWER',
      'Explore',
      'Plan',
      'general-purpose',
      'claude',
      'statusline-setup',
      'claude-code-guide',
    ]) {
      expect(ids(files, subagents(matcher)), matcher).toEqual([])
    }
  })

  it.fails('reads the agent name from the name field, and not from the file name', () => {
    expect(ids({ '.claude/agents/x.md': agent('', 'reviewer') }, subagents('reviewer'))).toEqual([])
    expect(
      ids({ '.claude/agents/reviewer.md': agent('', 'other') }, subagents('reviewer')),
    ).toEqual(['agent'])
  })

  it.fails('reads an agent file in a sub folder', () => {
    expect(ids({ '.claude/agents/team/x.md': agent('', 'deep') }, subagents('deep'))).toEqual([])
  })

  it.fails('reads the agents of a folder above the settings file, up to the repository root', () => {
    const all = { '.claude/agents/reviewer.md': agent('', 'reviewer') }
    expect(ids(all, subagents('reviewer'), 'packages/a/.claude/settings.json')).toEqual([])
    expect(ids(all, subagents('nope'), 'packages/a/.claude/settings.json')).toEqual(['agent'])
  })

  it.fails('is silent for a plugin-scoped name and a regular expression', () => {
    for (const matcher of ['my-plugin:reviewer', '^my-plugin:reviewer$', '^rev', '*', '']) {
      expect(ids(files, subagents(matcher)), matcher).toEqual([])
    }
  })

  it.fails('is silent when the repository has no agent file', () => {
    expect(ids({}, subagents('nope'))).toEqual([])
    expect(ids({ '.claude/agents/README.txt': 'x' }, subagents('nope'))).toEqual([])
    expect(ids({ '.claude/agents/a.md': 'no frontmatter' }, subagents('nope'))).toEqual([])
    expect(
      ids({ '.claude/agents/a.md': agent('').replace('name: a', 'name: 5') }, subagents('nope')),
    ).toEqual([])
  })

  it.fails('is silent for a name in the option allow', () => {
    expect(ids(files, subagents('mine'), SETTINGS_FILE, [{ allow: ['mine'] }])).toEqual([])
  })

  it.fails('is silent in a plugin hooks.json, a managed file, a skill and an agent file', () => {
    expect(ids(files, subagents('nope'), 'plugins/p/hooks/hooks.json')).toEqual([])
    expect(ids(files, subagents('nope'), 'managed-settings.json')).toEqual([])
    const text = frontmatter(
      'SubagentStop:\n  - matcher: nope\n    hooks:\n      - type: command\n        command: ./a.sh\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual([])
    expect(markdownIds(name, text, FILES.agent)).toEqual([])
  })

  it.fails('is silent when the settings file is not in a .claude folder', () => {
    expect(ids(files, subagents('nope'), 'config/settings.json')).toEqual([])
  })

  it.fails('is silent when the agents folder cannot be read', () => {
    const root = repo(files)
    const text = subagents('nope')
    withoutAccess(path.join(root, '.claude/agents'), () => {
      expect(lintJson(name, text, path.join(root, SETTINGS_FILE))).toEqual([])
    })
  })

  it.fails('is silent when one agent file cannot be read', () => {
    const root = repo({ ...files, '.claude/agents/b.md': agent('', 'b') })
    withoutAccess(path.join(root, '.claude/agents/b.md'), () => {
      expect(lintJson(name, subagents('nope'), path.join(root, SETTINGS_FILE))).toEqual([])
    })
  })

  it.fails('is silent when the agents folder is a link out of the repository', () => {
    const outside = repo({ 'agents/out.md': agent('', 'out') })
    const root = repo({ '.claude/settings.json': '{}' })
    symlinkSync(path.join(outside, 'agents'), path.join(root, '.claude/agents'))
    expect(lintJson(name, subagents('nope'), path.join(root, SETTINGS_FILE))).toEqual([])
  })
})

describe(`${name}: an MCP server name`, () => {
  const files = { '.mcp.json': mcp({ db: { command: 'x' } }) }

  it.fails('reports a server that .mcp.json does not define', () => {
    expect(ids(files, server('dbx'))).toEqual(['server'])
  })

  it.fails('names the server, at the value', () => {
    const [message] = lint(files, server('dbx'))
    expect(message?.message).toBe(
      '".mcp.json" defines no MCP server named "dbx", so this hook has no server to call.',
    )
    expect([message?.line, message?.column]).toEqual([1, 61])
  })

  it.fails('reads a .mcp.json above the settings file, and reports in settings.local.json', () => {
    expect(ids(files, server('dbx'), 'packages/a/.claude/settings.json')).toEqual(['server'])
    expect(ids(files, server('dbx'), '.claude/settings.local.json')).toEqual(['server'])
  })

  it.fails('reports when .mcp.json has no mcpServers key', () => {
    expect(ids({ '.mcp.json': '{}' }, server('db'))).toEqual(['server'])
  })

  it.fails('is silent for a server that .mcp.json defines', () => {
    expect(ids(files, server('db'))).toEqual([])
    expect(ids(files, server('db'), 'packages/a/.claude/settings.json')).toEqual([])
  })

  it.fails('is silent for a plugin-scoped server name and a name in the option allow', () => {
    expect(ids(files, server('plugin:my-plugin:db'))).toEqual([])
    expect(ids(files, server('mine'), SETTINGS_FILE, [{ allow: ['mine'] }])).toEqual([])
  })

  it.fails('is silent when the repository has no .mcp.json, which a user or local server could replace', () => {
    expect(ids({}, server('dbx'))).toEqual([])
  })

  it.fails('is silent when .mcp.json does not parse, is no object, or holds a bad mcpServers value', () => {
    for (const text of ['{', '[]', '"x"', mcp([]), mcp('x'), mcp(null), 'null']) {
      expect(ids({ '.mcp.json': text }, server('dbx')), text).toEqual([])
    }
  })

  it.fails('is silent when one of two .mcp.json files cannot be read', () => {
    expect(
      ids(
        { '.mcp.json': mcp({}), 'packages/.mcp.json': '{' },
        server('dbx'),
        'packages/a/.claude/settings.json',
      ),
    ).toEqual([])
  })

  it.fails('is silent when .mcp.json cannot be read', () => {
    const root = repo(files)
    withoutAccess(path.join(root, '.mcp.json'), () => {
      expect(lintJson(name, server('dbx'), path.join(root, SETTINGS_FILE))).toEqual([])
    })
  })

  it.fails('is silent when .mcp.json is a link out of the repository', () => {
    const outside = repo({ 'm.json': mcp({ db: {} }) })
    const root = repo({})
    symlinkSync(path.join(outside, 'm.json'), path.join(root, '.mcp.json'))
    expect(lintJson(name, server('dbx'), path.join(root, SETTINGS_FILE))).toEqual([])
  })

  it.fails('is silent for a handler that is not an mcp_tool hook, or a server that is no string', () => {
    for (const handler of [
      { type: 'command', server: 'dbx' },
      { server: 'dbx' },
      { type: 'mcp_tool', server: 5 },
      { type: 'mcp_tool' },
    ]) {
      expect(ids(files, settings(hooks('PostToolUse', [handler]))), json(handler)).toEqual([])
    }
  })

  it.fails('is silent in a plugin hooks.json, a managed file and a file outside .claude', () => {
    expect(ids(files, server('dbx'), 'plugins/p/hooks/hooks.json')).toEqual([])
    expect(ids(files, server('dbx'), 'managed-settings.json')).toEqual([])
    expect(ids(files, server('dbx'), 'config/settings.json')).toEqual([])
  })
})
