// The sub-agents page, "Preload skills into subagents": "If a listed skill is missing or
// disabled, Claude Code skips it and logs a warning to the debug log." The skills page, "Where
// skills live", names the project, nested and plugin locations, and says a `.claude/commands/`
// file creates the same command as a skill. The skills on disk are the subject, so the trees are
// built at run time. `agent-skills-preloadable` owns a skill that sets `disable-model-invocation`.
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { agent, repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const unreadable = chmodCannotBlock ? it.skip : it.fails
const AGENT = '.claude/agents/a.md'
const PLUGIN_AGENT = 'plugins/p/agents/a.md'
const MANIFEST = { 'plugins/p/.claude-plugin/plugin.json': '{"name":"p"}' }
const skill = (name?: string, extra = '') =>
  `---\n${name === undefined ? '' : `name: ${name}\n`}description: d\n${extra}---\n\nBody\n`
const list = (...names: string[]) => `skills:\n${names.map((n) => `  - ${n}\n`).join('')}`
const run = (
  files: Record<string, string>,
  fields = list('ghost'),
  at = AGENT,
  options: unknown[] = [],
) => lintAgent('agent-skills-exist', agent(fields), path.join(repo(files), at), options)

describe('agent-skills-exist', () => {
  describe('reports', () => {
    it.fails('an entry that no skill, command or bundled skill matches, on the item', () => {
      expect(run({})).toMatchObject([
        { messageId: 'missing', line: 5, column: 5, endLine: 5, endColumn: 10 },
      ])
      expect(run({})[0]?.message).toContain('ghost')
    })
    it.fails('each missing entry, and not the entry that exists', () => {
      const files = { '.claude/skills/real/SKILL.md': skill() }
      expect(run(files, list('real', 'ghost', 'phantom'))).toHaveLength(2)
    })
    it.fails('a folder with no SKILL.md, and a skill whose name is another word', () => {
      expect(run({ '.claude/skills/ghost/notes.md': 'x' })).toHaveLength(1)
      expect(run({ '.claude/skills/other/SKILL.md': skill('another') })).toHaveLength(1)
    })
    it.fails('a name in a skills folder of a nested project, from the root', () => {
      const files = { 'pkg/.claude/skills/ghost/SKILL.md': skill() }
      expect(run(files, list('ghost'), AGENT)).toHaveLength(1)
    })
    it.fails('a plugin agent, with the skills folder of the plugin', () => {
      const files = { ...MANIFEST, 'plugins/p/skills/other/SKILL.md': skill() }
      expect(run(files, list('ghost'), PLUGIN_AGENT)).toHaveLength(1)
      expect(run(MANIFEST, list('ghost'), PLUGIN_AGENT)).toHaveLength(1)
    })
    it.fails('a skill of the project for a plugin agent', () => {
      const files = { ...MANIFEST, '.claude/skills/ghost/SKILL.md': skill() }
      expect(run(files, list('ghost'), PLUGIN_AGENT)).toHaveLength(1)
    })
    it.fails('a skill that sets disable-model-invocation is not missing', () => {
      const files = {
        '.claude/skills/ghost/SKILL.md': skill(undefined, 'disable-model-invocation: true\n'),
      }
      expect(run(files)).toEqual([])
    })
  })

  describe('stays silent', () => {
    it.fails('for a skill folder, a skill name, and a letter case', () => {
      expect(run({ '.claude/skills/ghost/SKILL.md': skill() })).toEqual([])
      expect(run({ '.claude/skills/x/SKILL.md': skill('ghost') })).toEqual([])
      expect(run({ '.claude/skills/Ghost/SKILL.md': skill() })).toEqual([])
    })
    it.fails('for a command file', () => {
      expect(run({ '.claude/commands/ghost.md': skill() })).toEqual([])
    })
    it.fails('for a skill in a folder above the project', () => {
      const files = { '.claude/skills/ghost/SKILL.md': skill() }
      expect(run(files, list('ghost'), 'pkg/.claude/agents/a.md')).toEqual([])
    })
    it.fails('for a bundled skill, and for the option allow', () => {
      expect(run({}, list('verify', 'code-review', 'Simplify'))).toEqual([])
      expect(run({}, list('user-skill'), AGENT, [{ allow: ['USER-skill'] }])).toEqual([])
    })
    it.fails('for a skill of the plugin', () => {
      const files = { ...MANIFEST, 'plugins/p/skills/ghost/SKILL.md': skill() }
      expect(run(files, list('ghost'), PLUGIN_AGENT)).toEqual([])
    })
    it.fails('for a plugin that sets skills, or whose manifest cannot be read', () => {
      expect(
        run(
          { 'plugins/p/.claude-plugin/plugin.json': '{"skills":"./x"}' },
          list('g'),
          PLUGIN_AGENT,
        ),
      ).toEqual([])
      expect(run({ 'plugins/p/.claude-plugin/plugin.json': '{' }, list('g'), PLUGIN_AGENT)).toEqual(
        [],
      )
    })
    it.fails('for a plugin form entry, an empty entry and an entry that is not a string', () => {
      expect(run({}, 'skills:\n  - other:ghost\n  - ""\n  - 5\n  - [a]\n')).toEqual([])
    })
    it.fails('for a skills value that is no list, no skills and an empty list', () => {
      expect(run({}, 'skills: ghost\n')).toEqual([])
      expect(run({}, 'skills:\n')).toEqual([])
      expect(run({}, 'skills: []\n')).toEqual([])
      expect(run({}, '')).toEqual([])
    })
    it.fails('for a file outside the agents folders, and a file with no frontmatter', () => {
      expect(run({}, list('ghost'), 'docs/a.md')).toEqual([])
      expect(run({}, 'Body only.\n')).toEqual([])
    })
    it.fails('when a skills folder holds a link out of the repository', () => {
      const root = repo({})
      const outside = path.join(path.dirname(root), `${path.basename(root)}-skills`)
      mkdirSync(path.join(outside, 'ghost'), { recursive: true })
      writeFileSync(path.join(outside, 'ghost', 'SKILL.md'), skill())
      mkdirSync(path.join(root, '.claude/skills'), { recursive: true })
      symlinkSync(path.join(outside, 'ghost'), path.join(root, '.claude/skills/linked'))
      expect(lintAgent('agent-skills-exist', agent(list('ghost')), path.join(root, AGENT))).toEqual(
        [],
      )
    })
    it.fails('when a SKILL.md does not parse as a file, it only has no name', () => {
      expect(run({ '.claude/skills/x/SKILL.md': '---\nname: [\n---\n' })).toHaveLength(1)
    })
    unreadable('when a skills folder or a SKILL.md cannot be read', () => {
      const root = repo({ '.claude/skills/x/SKILL.md': skill('other') })
      const code = agent(list('ghost'))
      withoutAccess(path.join(root, '.claude/skills/x/SKILL.md'), () => {
        expect(lintAgent('agent-skills-exist', code, path.join(root, AGENT))).toEqual([])
      })
      withoutAccess(path.join(root, '.claude/skills'), () => {
        expect(lintAgent('agent-skills-exist', code, path.join(root, AGENT))).toEqual([])
      })
    })
  })
})
