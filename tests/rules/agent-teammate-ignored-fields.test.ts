// The agent-teams page, "Use subagent definitions for teammates": Claude Code does not apply
// `skills` to a teammate. An in-process teammate ignores `mcpServers`. The Limitations list: a
// teammate that spawns a subagent whose definition sets `background: true` gets an error. Teammate
// use is a runtime fact. The files show one thing: the committed settings turn agent teams on,
// with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`. The settings are on disk.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { agent, repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const unreadable = chmodCannotBlock ? it.skip : it
const AGENT = '.claude/agents/a.md'
const PLUGIN = { 'plugins/p/.claude-plugin/plugin.json': '{"name":"p"}' }
const TEAMS = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'
const on = (value: unknown = '1', extra: object = {}) =>
  JSON.stringify({ env: { [TEAMS]: value }, ...extra })
const SKILLS = 'skills:\n  - lint\n'
const MCP = 'mcpServers:\n  - github\n'
const run = (files: Record<string, string>, fields: string, at = AGENT, options: unknown[] = []) =>
  lintAgent(
    'agent-teammate-ignored-fields',
    agent(fields),
    path.join(repo({ ...PLUGIN, ...files }), at),
    options,
  )

describe('agent-teammate-ignored-fields', () => {
  it('reports skills when the settings turn teams on, on the field', () => {
    expect(run({ '.claude/settings.json': on() }, SKILLS)).toMatchObject([
      { messageId: 'skills', line: 4, column: 1, endLine: 5, endColumn: 9 },
    ])
  })

  it('reports mcpServers when teammateMode is in-process, auto, or not a string', () => {
    for (const mode of ['in-process', 'auto', 5]) {
      const files = { '.claude/settings.json': on('1', { teammateMode: mode }) }
      expect(run(files, MCP), String(mode)).toHaveLength(1)
    }
  })

  it('reports mcpServers when the settings turn teams on', () => {
    expect(run({ '.claude/settings.json': on() }, MCP)).toMatchObject([
      { messageId: 'mcpServers', line: 4, column: 1 },
    ])
  })

  it('reports background when the settings turn teams on', () => {
    for (const value of ['true', 'yes', 'on', '1']) {
      expect(run({ '.claude/settings.json': on() }, `background: ${value}\n`), value).toMatchObject(
        [{ messageId: 'background', line: 4, column: 1, endLine: 4, endColumn: 13 + value.length }],
      )
    }
  })

  it('reports mcpServers written as a map', () => {
    const fields = 'mcpServers:\n  github:\n    command: x\n'
    expect(run({ '.claude/settings.json': on() }, fields)).toHaveLength(1)
  })

  it('reports each field, in the order of the file', () => {
    const messages = run({ '.claude/settings.json': on() }, `background: true\n${MCP}${SKILLS}`)
    expect(messages.map((m) => m.messageId)).toEqual(['background', 'mcpServers', 'skills'])
  })

  it('reads the value true, in any letter case, and the local file', () => {
    expect(run({ '.claude/settings.json': on('true') }, SKILLS)).toHaveLength(1)
    expect(run({ '.claude/settings.json': on('TRUE') }, SKILLS)).toHaveLength(1)
    expect(run({ '.claude/settings.local.json': on() }, SKILLS)).toHaveLength(1)
    expect(
      run({ '.claude/settings.json': on('0'), '.claude/settings.local.json': on() }, SKILLS),
    ).toHaveLength(1)
  })

  it('reports an agent in a subfolder of agents', () => {
    expect(run({ '.claude/settings.json': on() }, SKILLS, '.claude/agents/team/a.md')).toHaveLength(
      1,
    )
  })

  it('reports skills and background when teammateMode names split panes', () => {
    for (const mode of ['tmux', 'iterm2']) {
      const files = { '.claude/settings.json': on('1', { teammateMode: mode }) }
      expect(
        run(files, `${MCP}${SKILLS}background: true\n`).map((m) => m.messageId),
        mode,
      ).toEqual(['skills', 'background'])
    }
  })

  describe('stays silent', () => {
    it('when the settings do not turn teams on', () => {
      const fields = `${SKILLS}${MCP}background: true\n`
      expect(run({}, fields)).toEqual([])
      expect(run({ '.claude/settings.json': '{}' }, fields)).toEqual([])
      expect(run({ '.claude/settings.json': on('0') }, fields)).toEqual([])
      expect(run({ '.claude/settings.json': on('') }, fields)).toEqual([])
      expect(run({ '.claude/settings.json': on(1) }, fields)).toEqual([])
      expect(run({ '.claude/settings.json': JSON.stringify({ env: 'x' }) }, fields)).toEqual([])
      expect(
        run({ '.claude/settings.json': on(), '.claude/settings.local.json': on('0') }, fields),
      ).toEqual([])
    })
    it('for fields that a teammate keeps', () => {
      const files = { '.claude/settings.json': on() }
      expect(run(files, '')).toEqual([])
      expect(run(files, 'tools: Read\nmodel: sonnet\nmemory: project\n')).toEqual([])
    })
    it('for empty values and background that is not true', () => {
      const files = { '.claude/settings.json': on() }
      for (const fields of [
        'skills: []\n',
        'skills:\n',
        'skills: ""\n',
        'skills: "  "\n',
        'mcpServers: "  "\n',
        'mcpServers: []\n',
        'mcpServers: {}\n',
        'mcpServers:\n',
        'background: false\n',
        'background: no\n',
        'background: maybe\n',
        'background: [true]\n',
      ]) {
        expect(run(files, fields), fields).toEqual([])
      }
    })
    it('for a plugin agent, even when the repository settings turn teams on', () => {
      const files = { '.claude/settings.json': on(), 'plugins/p/.claude/settings.json': on() }
      expect(run(files, `${SKILLS}${MCP}background: true\n`, 'plugins/p/agents/a.md')).toEqual([])
    })
    it('for a file outside the agent folders, or with no frontmatter', () => {
      const files = { '.claude/settings.json': on() }
      expect(run(files, SKILLS, 'docs/a.md')).toEqual([])
      const root = repo({ ...files })
      expect(
        lintAgent('agent-teammate-ignored-fields', 'Body only.\n', path.join(root, AGENT)),
      ).toEqual([])
      expect(
        lintAgent(
          'agent-teammate-ignored-fields',
          '---\nskills: [a\n---\n',
          path.join(root, AGENT),
        ),
      ).toEqual([])
    })
    it('when a settings file does not parse', () => {
      expect(run({ '.claude/settings.json': '{' }, SKILLS)).toEqual([])
    })
    unreadable('when a settings file cannot be read', () => {
      const root = repo({ '.claude/settings.json': on() })
      withoutAccess(path.join(root, '.claude/settings.json'), () => {
        expect(
          lintAgent('agent-teammate-ignored-fields', agent(SKILLS), path.join(root, AGENT)),
        ).toEqual([])
      })
    })
  })
})
