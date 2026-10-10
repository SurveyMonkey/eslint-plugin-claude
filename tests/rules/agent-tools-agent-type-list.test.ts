// The sub-agents page, "Restrict which subagents can be spawned": the `Agent(agent_type)` list
// "applies only to an agent running as the main thread with `claude --agent`". In a subagent
// definition any type list inside the parentheses is ignored. The main thread is the agent that
// the `agent` setting names. The rule cannot see the flag. The files are on disk, because the rule
// reads the settings and the agent files of the project folder and each folder above it.
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { agent, repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const unreadable = chmodCannotBlock ? it.skip : it
const AGENT = '.claude/agents/a.md'
const PLUGIN = { 'plugins/p/.claude-plugin/plugin.json': '{"name":"p"}' }
const named = (name: string) => JSON.stringify({ agent: name })
const MAIN = { '.claude/settings.json': named('a') }
const run = (
  files: Record<string, string>,
  fields = 'tools: Agent(worker), Read\n',
  at = AGENT,
  options: unknown[] = [],
) => lintAgent('agent-tools-agent-type-list', agent(fields), path.join(repo(files), at), options)

describe('agent-tools-agent-type-list', () => {
  describe('in an agent that no setting runs as the main thread', () => {
    it('reports the entry', () => {
      expect(run({})).toMatchObject([{ messageId: 'ignored', line: 4, column: 8, endColumn: 21 }])
    })
    it('reports Task with a type list, and a list item', () => {
      expect(run({}, 'tools: Task(worker), Read\n')).toHaveLength(1)
      expect(run({}, 'tools:\n  - Read\n  - Agent(worker)\n')).toHaveLength(1)
    })
    it('reports each entry with a type list', () => {
      expect(run({}, 'tools: Agent(a), Task(b)\n')).toHaveLength(2)
    })
    it('reports when the setting names another agent', () => {
      expect(run({ '.claude/settings.json': named('other') })).toHaveLength(1)
    })
    it('stays silent for the plain tool, a disallowedTools entry and an empty list', () => {
      expect(run({}, 'tools: Agent, Read\n')).toEqual([])
      expect(run({}, 'tools: Agent(), Read\n')).toEqual([])
      expect(run({}, 'disallowedTools: Agent(worker)\n')).toEqual([])
      expect(run({}, 'tools: Read(src/*)\n')).toEqual([])
      expect(run({}, 'tools: Read, (\n')).toEqual([])
      expect(run({}, '')).toEqual([])
    })
    it('stays silent for broken frontmatter and for a name that is no name', () => {
      expect(run({}, 'tools: [unclosed\n')).toEqual([])
      const code = '---\nname: ""\ndescription: d\ntools: Agent(worker)\n---\n'
      expect(lintAgent('agent-tools-agent-type-list', code, path.join(repo({}), AGENT))).toEqual([])
    })
    it('stays silent for a name in the option allow', () => {
      expect(run({}, 'tools: Agent(worker)\n', AGENT, [{ allow: ['a'] }])).toEqual([])
    })
    it('stays silent for a plugin agent', () => {
      // The plugin is in a repository, so a rule that read the settings there would report.
      expect(run(PLUGIN, 'tools: Agent(worker)\n', 'plugins/p/agents/a.md')).toEqual([])
    })
    it('stays silent when a settings file cannot be seen', () => {
      expect(run({ '.claude/settings.json': '{' })).toEqual([])
    })
  })

  describe('in the agent that the agent setting runs as the main thread', () => {
    it('reports a type that no agent defines, on the entry', () => {
      expect(run(MAIN, 'tools: Agent(ghost), Read\n')).toMatchObject([
        { messageId: 'unknownType', line: 4, column: 8, endColumn: 20 },
      ])
      expect(run(MAIN, 'tools: Agent(ghost), Read\n')[0]?.message).toContain('ghost')
    })
    it('reports each unknown type of the entry once', () => {
      const messages = run(MAIN, 'tools: Agent(ghost, phantom, Explore), Read\n')
      expect(messages).toHaveLength(1)
      expect(messages[0]?.message).toContain('`ghost`, `phantom`')
      expect(messages[0]?.message).not.toContain('Explore')
    })
    it('stays silent for a built-in type, in any letter case', () => {
      expect(run(MAIN, 'tools: Agent(Explore, plan, general-purpose), Read\n')).toEqual([])
    })
    it('stays silent for an agent file of the project or of a folder above', () => {
      const files = {
        ...MAIN,
        '.claude/agents/worker.md': agent('', 'worker'),
      }
      expect(run(files, 'tools: Agent(worker)\n')).toEqual([])
      const above = {
        '.claude/settings.json': named('a'),
        '.claude/agents/worker.md': agent('', 'worker'),
      }
      expect(run(above, 'tools: Agent(worker)\n', 'pkg/.claude/agents/a.md')).toEqual([])
    })
    it('stays silent for a scoped type, a type in allow, and an empty type', () => {
      expect(run(MAIN, 'tools: Agent(my-plugin:reviewer)\n')).toEqual([])
      expect(run(MAIN, 'tools: Agent(user-agent)\n', AGENT, [{ allow: ['User-Agent'] }])).toEqual(
        [],
      )
      expect(run(MAIN, 'tools: Agent(,)\n')).toEqual([])
    })
    it('reports a type when a sibling file has no name or broken frontmatter', () => {
      const files = {
        ...MAIN,
        '.claude/agents/broken.md': '---\nname: [unclosed\n---\n',
        '.claude/agents/plain.md': 'Documentation.\n',
        '.claude/agents/numbered.md': agent('', '5'),
      }
      expect(run(files, 'tools: Agent(ghost)\n')).toHaveLength(1)
    })
    it('stays silent when the agents folder holds a link out of the repository', () => {
      const root = repo(MAIN)
      const outside = path.join(path.dirname(root), `${path.basename(root)}-outside`)
      mkdirSync(outside, { recursive: true })
      writeFileSync(path.join(outside, 'ghost.md'), agent('', 'ghost'))
      mkdirSync(path.join(root, '.claude/agents'), { recursive: true })
      symlinkSync(outside, path.join(root, '.claude/agents/team'))
      expect(
        lintAgent(
          'agent-tools-agent-type-list',
          agent('tools: Agent(ghost)\n'),
          path.join(root, AGENT),
        ),
      ).toEqual([])
    })
    unreadable('stays silent when an agent file cannot be read by the system', () => {
      const root = repo({ ...MAIN, '.claude/agents/w.md': agent('', 'w') })
      withoutAccess(path.join(root, '.claude/agents/w.md'), () => {
        expect(
          lintAgent(
            'agent-tools-agent-type-list',
            agent('tools: Agent(ghost)\n'),
            path.join(root, AGENT),
          ),
        ).toEqual([])
      })
    })
  })
})
