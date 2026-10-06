// A subagent cannot preload a skill that sets `disable-model-invocation: true`.
// The skills are on disk, because the rule reads them.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import rule from '../../src/rules/agent-skills-preloadable.ts'
import { agent, lintWith, repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const skill = (fields: string) => `---\nname: s\ndescription: d\n${fields}---\n\nBody.\n`
const OFF = skill('disable-model-invocation: true\n')
const list = (...entries: string[]) => `skills:\n${entries.map((e) => `  - ${e}\n`).join('')}`
const LOCAL = '.claude/agents/a.md'
const PLUGIN = { '.claude-plugin/plugin.json': '{}' }
const run = (files: Record<string, string>, fields = list('deploy'), at = LOCAL) => {
  const root = repo(files)
  return lintWith(rule, agent(fields), path.join(root, at))
}

describe('agent-skills-preloadable', () => {
  it('reports an entry that is a disabled local skill', () => {
    const messages = run({ '.claude/skills/deploy/SKILL.md': OFF })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'disabled', line: 5 })
    expect(messages[0]?.message).toContain('`deploy`')
  })

  it('reports each disabled entry, and only that entry', () => {
    const messages = run(
      {
        '.claude/skills/deploy/SKILL.md': OFF,
        '.claude/skills/ship/SKILL.md': OFF,
        '.claude/skills/lint/SKILL.md': skill(''),
      },
      list('deploy', 'lint', 'ship'),
    )
    expect(messages.map((m) => m.messageId)).toEqual(['disabled', 'disabled'])
    expect(messages[0]?.message).toContain('`deploy`')
    expect(messages[1]?.message).toContain('`ship`')
  })

  it('reports from an agent in a subfolder', () => {
    const files = { '.claude/skills/deploy/SKILL.md': OFF }
    expect(run(files, list('deploy'), '.claude/agents/x/a.md')).toHaveLength(1)
  })

  it('reports an entry that is a disabled plugin skill', () => {
    const files = { ...PLUGIN, 'skills/deploy/SKILL.md': OFF }
    const messages = run(files, list('deploy'), 'agents/a.md')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'disabled' })
  })

  it('reports a plugin skill when the manifest sets other keys', () => {
    const files = {
      '.claude-plugin/plugin.json': '{"name":"p","commands":"./c"}',
      'skills/deploy/SKILL.md': OFF,
    }
    expect(run(files, list('deploy'), 'agents/a.md')).toHaveLength(1)
  })

  it('stays silent for the bundled verify skill, which a skill that the rule cannot see replaces', () => {
    expect(run({}, list('verify'))).toEqual([])
  })

  it('reports a disabled skill that is named verify as a disabled skill', () => {
    const messages = run({ '.claude/skills/verify/SKILL.md': OFF }, list('verify'))
    expect(messages.map((m) => m.messageId)).toEqual(['disabled'])
  })

  it('stays silent for a skill that a model can invoke', () => {
    expect(run({ '.claude/skills/deploy/SKILL.md': skill('') })).toEqual([])
  })

  // The skills page accepts these forms as true, in any letter case.
  for (const value of ['yes', 'on', '1', 'YES', '"true"']) {
    it(`reports when disable-model-invocation is ${value}`, () => {
      const files = {
        '.claude/skills/deploy/SKILL.md': skill(`disable-model-invocation: ${value}\n`),
      }
      const messages = run(files)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({ messageId: 'disabled' })
    })
  }

  // YAML reads `True` as the Boolean true, so the rule already reports it.
  it('reports when disable-model-invocation is True', () => {
    const files = { '.claude/skills/deploy/SKILL.md': skill('disable-model-invocation: True\n') }
    expect(run(files)).toHaveLength(1)
  })

  // `false`, `no`, `off` and `0` are Boolean false. `maybe` and `[true]` are no Boolean.
  for (const value of ['false', 'no', 'off', '0', 'maybe', '[true]']) {
    it(`stays silent when disable-model-invocation is ${value}`, () => {
      const files = {
        '.claude/skills/deploy/SKILL.md': skill(`disable-model-invocation: ${value}\n`),
      }
      expect(run(files)).toEqual([])
    })
  }

  it('stays silent for an entry with no skill file', () => {
    expect(run({ '.claude/skills/other/SKILL.md': OFF })).toEqual([])
  })

  it('stays silent for a skill that only its name field gives', () => {
    const files = { '.claude/skills/x/SKILL.md': skill('disable-model-invocation: true\n') }
    expect(run(files, list('s'))).toEqual([])
  })

  it('stays silent for a plugin form entry that has no skill file', () => {
    const files = { ...PLUGIN, 'skills/deploy/SKILL.md': OFF }
    expect(run(files, list('p:deploy'), 'agents/a.md')).toEqual([])
  })

  it('does not look in the skills of a plugin for a local agent', () => {
    const files = { ...PLUGIN, 'skills/deploy/SKILL.md': OFF }
    expect(run(files, list('deploy'))).toEqual([])
  })

  it('does not look in the skills of another .claude directory', () => {
    expect(run({ 'pkg/.claude/skills/deploy/SKILL.md': OFF })).toEqual([])
  })

  it('does not look in the .claude skills for a plugin agent', () => {
    const files = { ...PLUGIN, '.claude/skills/deploy/SKILL.md': OFF }
    expect(run(files, list('deploy'), 'agents/a.md')).toEqual([])
  })

  it('stays silent when the plugin manifest sets skills', () => {
    const files = {
      '.claude-plugin/plugin.json': '{"skills":["./extra"]}',
      'skills/deploy/SKILL.md': OFF,
    }
    expect(run(files, list('deploy', 'verify'), 'agents/a.md')).toEqual([])
  })

  it('stays silent when the plugin manifest is a link out of the repository', () => {
    const out = repo({ 'plugin.json': '{}' })
    const root = repo({ 'skills/deploy/SKILL.md': OFF, 'agents/a.md': 'x' })
    // The manifest directory is a link whose real path is out of the repository.
    const link = path.join(root, '.claude-plugin')
    symlinkSync(out, link)
    expect(lintWith(rule, agent(list('deploy')), path.join(root, 'agents/a.md'))).toEqual([])
  })

  // A manifest that is not a JSON object gives no key, so the rule cannot see the `skills` key.
  it.each([
    ['a syntax error', '{'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a scalar', '3'],
  ])('stays silent when the plugin manifest is %s', (_name, text) => {
    const files = { '.claude-plugin/plugin.json': text, 'skills/deploy/SKILL.md': OFF }
    expect(run(files, list('deploy'), 'agents/a.md')).toEqual([])
  })

  for (const value of ['skills: deploy\n', 'skills: 3\n', 'skills:\n  a: b\n', 'skills: []\n']) {
    it(`stays silent for the skills value ${JSON.stringify(value)}`, () => {
      expect(run({ '.claude/skills/deploy/SKILL.md': OFF }, value)).toEqual([])
    })
  }

  it('ignores an entry that is not a string', () => {
    const files = { '.claude/skills/deploy/SKILL.md': OFF }
    expect(run(files, 'skills:\n  - 3\n  - [deploy]\n  - null\n')).toEqual([])
  })

  it('stays silent for an agent with no skills field', () => {
    expect(run({ '.claude/skills/deploy/SKILL.md': OFF }, '')).toEqual([])
  })

  it('stays silent for a file with no frontmatter or frontmatter that does not parse', () => {
    const root = repo({ '.claude/skills/deploy/SKILL.md': OFF })
    const at = path.join(root, LOCAL)
    expect(lintWith(rule, 'Body.\n', at)).toEqual([])
    expect(lintWith(rule, '---\nskills: [deploy\n---\n', at)).toEqual([])
  })

  it('stays silent for a file that is no agent file', () => {
    expect(run({ '.claude/skills/deploy/SKILL.md': OFF }, list('deploy'), 'docs/a.md')).toEqual([])
  })

  describe('a file that the rule cannot read', () => {
    it('gives no report for a skill file that it cannot read', () => {
      if (chmodCannotBlock) {
        return
      }
      const root = repo({ '.claude/skills/deploy/SKILL.md': OFF })
      withoutAccess(path.join(root, '.claude/skills/deploy/SKILL.md'), () => {
        expect(lintWith(rule, agent(list('deploy')), path.join(root, LOCAL))).toEqual([])
      })
    })

    it('gives no report for a plugin manifest that it cannot read', () => {
      if (chmodCannotBlock) {
        return
      }
      const root = repo({ ...PLUGIN, 'skills/deploy/SKILL.md': OFF })
      withoutAccess(path.join(root, '.claude-plugin/plugin.json'), () => {
        expect(lintWith(rule, agent(list('deploy')), path.join(root, 'agents/a.md'))).toEqual([])
      })
    })
  })
})
