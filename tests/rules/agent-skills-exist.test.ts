// The sub-agents page, "Preload skills into subagents": "If a listed skill is missing or
// disabled, Claude Code skips it and logs a warning to the debug log." The skills page, "Choose where
// skills load", names the project, nested and plugin locations, and says a `.claude/commands/`
// file creates the same command as a skill. The skills on disk are the subject, so the trees are
// built at run time. `agent-skills-preloadable` owns a skill that sets `disable-model-invocation`.
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { agent, repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const unreadable = chmodCannotBlock ? it.skip : it
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
    it('an entry that no skill, command or bundled skill matches, on the item', () => {
      expect(run({})).toMatchObject([
        { messageId: 'missing', line: 5, column: 5, endLine: 5, endColumn: 10 },
      ])
      expect(run({})[0]?.message).toContain('ghost')
    })
    it('each missing entry, and not the entry that exists', () => {
      const files = { '.claude/skills/real/SKILL.md': skill() }
      expect(run(files, list('real', 'ghost', 'phantom'))).toHaveLength(2)
    })
    it('a folder with no SKILL.md, and a skill whose name is another word', () => {
      expect(run({ '.claude/skills/ghost/notes.md': 'x' })).toHaveLength(1)
      expect(run({ '.claude/skills/other/SKILL.md': skill('another') })).toHaveLength(1)
      expect(run({ '.claude/commands/ghost.txt': 'x' })).toHaveLength(1)
    })
    it('a name in a skills folder of a nested project, from the root', () => {
      const files = { 'pkg/.claude/skills/ghost/SKILL.md': skill() }
      expect(run(files, list('ghost'), AGENT)).toHaveLength(1)
    })
    it('a plugin agent, with the skills folder of the plugin', () => {
      const files = { ...MANIFEST, 'plugins/p/skills/other/SKILL.md': skill() }
      expect(run(files, list('ghost'), PLUGIN_AGENT)).toHaveLength(1)
      expect(run(MANIFEST, list('ghost'), PLUGIN_AGENT)).toHaveLength(1)
    })
    it('a skill of the project for a plugin agent', () => {
      const files = { ...MANIFEST, '.claude/skills/ghost/SKILL.md': skill() }
      expect(run(files, list('ghost'), PLUGIN_AGENT)).toHaveLength(1)
    })

    it('a skill whose frontmatter does not parse, because it has no name', () => {
      expect(run({ '.claude/skills/x/SKILL.md': '---\nname: [\n---\n' })).toHaveLength(1)
    })
  })

  describe('stays silent', () => {
    it('for a skill that sets disable-model-invocation, which preloadable reports', () => {
      const files = {
        '.claude/skills/ghost/SKILL.md': skill(undefined, 'disable-model-invocation: true\n'),
      }
      expect(run(files)).toEqual([])
    })
    it('for a skill folder, a skill name, and a letter case', () => {
      expect(run({ '.claude/skills/ghost/SKILL.md': skill() })).toEqual([])
      expect(run({ '.claude/skills/x/SKILL.md': skill('ghost') })).toEqual([])
      expect(run({ '.claude/skills/Ghost/SKILL.md': skill() })).toEqual([])
    })
    it('for a command file', () => {
      expect(run({ '.claude/commands/ghost.md': skill() })).toEqual([])
    })
    it('for a skill in a folder above the project', () => {
      const files = { '.claude/skills/ghost/SKILL.md': skill() }
      expect(run(files, list('ghost'), 'pkg/.claude/agents/a.md')).toEqual([])
    })
    it('for a bundled skill, and for the option allow', () => {
      expect(run({}, list('verify', 'code-review', 'Simplify'))).toEqual([])
      expect(run({}, list('user-skill'), AGENT, [{ allow: ['USER-skill'] }])).toEqual([])
    })
    it('for a skill of the plugin', () => {
      const files = { ...MANIFEST, 'plugins/p/skills/ghost/SKILL.md': skill() }
      expect(run(files, list('ghost'), PLUGIN_AGENT)).toEqual([])
    })
    it('for a plugin that sets skills, or whose manifest cannot be read', () => {
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
    it('for a plugin form entry, an empty entry and an entry that is not a string', () => {
      expect(run({}, 'skills:\n  - other:ghost\n  - ""\n  - 5\n  - [a]\n')).toEqual([])
    })
    it('for a skills value that is no list, no skills and an empty list', () => {
      expect(run({}, 'skills: ghost\n')).toEqual([])
      expect(run({}, 'skills:\n')).toEqual([])
      expect(run({}, 'skills: []\n')).toEqual([])
      expect(run({}, '')).toEqual([])
    })
    it('for a file outside the agents folders, and a file with no frontmatter', () => {
      expect(run({}, list('ghost'), 'docs/a.md')).toEqual([])
      expect(run({}, 'Body only.\n')).toEqual([])
    })
    it('when a skills folder holds a link out of the repository', () => {
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
    it('when a skills or commands folder leads out of the repository', () => {
      const root = repo({})
      const outside = path.join(path.dirname(root), `${path.basename(root)}-folders`)
      mkdirSync(path.join(outside, 'commands'), { recursive: true })
      mkdirSync(path.join(outside, 'skills'), { recursive: true })
      writeFileSync(path.join(outside, 'commands', 'other.md'), skill())
      mkdirSync(path.join(root, '.claude'), { recursive: true })
      const code = agent(list('ghost'))
      const lint = () => lintAgent('agent-skills-exist', code, path.join(root, AGENT))
      symlinkSync(path.join(outside, 'commands'), path.join(root, '.claude/commands'))
      expect(lint()).toEqual([])
      symlinkSync(path.join(outside, 'skills'), path.join(root, '.claude/skills'))
      rmSync(path.join(root, '.claude/commands'))
      expect(lint()).toEqual([])
    })
    it('when a skills folder, a commands folder or a SKILL.md is a dangling link', () => {
      const dangling = (name: string, at: string) => {
        const root = repo({})
        mkdirSync(path.join(root, path.dirname(at)), { recursive: true })
        symlinkSync(path.join(root, name), path.join(root, at))
        return lintAgent('agent-skills-exist', agent(list('ghost')), path.join(root, AGENT))
      }
      expect(dangling('gone', '.claude/skills')).toEqual([])
      expect(dangling('gone', '.claude/commands')).toEqual([])
      expect(dangling('gone', '.claude/skills/ghost')).toEqual([])
      expect(dangling('gone', '.claude/skills/other/SKILL.md')).toEqual([])
    })
    it('for a plugin whose manifest sets commands', () => {
      const files = { 'plugins/p/.claude-plugin/plugin.json': '{"name":"p","commands":"./cmds"}' }
      expect(run(files, list('ghost'), PLUGIN_AGENT)).toEqual([])
    })
    unreadable('when a skills folder or a SKILL.md cannot be read', () => {
      const root = repo({
        '.claude/skills/x/SKILL.md': skill('other'),
        '.claude/commands/c.md': skill(),
      })
      const code = agent(list('ghost'))
      withoutAccess(path.join(root, '.claude/skills/x/SKILL.md'), () => {
        expect(lintAgent('agent-skills-exist', code, path.join(root, AGENT))).toEqual([])
      })
      withoutAccess(path.join(root, '.claude/skills/x'), () => {
        expect(lintAgent('agent-skills-exist', code, path.join(root, AGENT))).toEqual([])
      })
      withoutAccess(path.join(root, '.claude/commands'), () => {
        expect(lintAgent('agent-skills-exist', code, path.join(root, AGENT))).toEqual([])
      })
      withoutAccess(path.join(root, '.claude/skills'), () => {
        expect(lintAgent('agent-skills-exist', code, path.join(root, AGENT))).toEqual([])
      })
    })
  })
})
