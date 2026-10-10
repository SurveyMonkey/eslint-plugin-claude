// The rule reads `.claude/skills/` and `.claude/commands/`, so each case builds a tree on disk. The
// expected values come from the skills page
// (https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings) and the
// settings reference (https://code.claude.com/docs/en/settings-reference#skilloverrides): the key
// is the name of a skill, a bundled skill has aliases, and plugin skills are not affected. The
// commands reference marks the bundled skills (https://code.claude.com/docs/en/commands). The
// files glob is in tests/configs.test.ts.
import { mkdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it, vi } from 'vitest'
import plugin from '../../src/index.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

// ADR 001, Decision 14: no call reaches a path above the repository. The recorder keeps the first
// argument of each file system call that the rule can make, while `recorded.on` is true.
const recorded = vi.hoisted(() => ({ on: false, paths: [] as string[] }))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const names = [
    'realpathSync',
    'existsSync',
    'statSync',
    'lstatSync',
    'readdirSync',
    'readFileSync',
  ]
  const wrapped: Record<string, unknown> = {}
  for (const name of names) {
    const original = (actual as unknown as Record<string, (...args: unknown[]) => unknown>)[name]
    if (original === undefined) {
      continue
    }
    wrapped[name] = Object.assign(
      (file: unknown, ...rest: unknown[]) => {
        if (recorded.on) {
          recorded.paths.push(String(file))
        }
        return original(file, ...rest)
      },
      name === 'realpathSync' ? { native: actual.realpathSync.native } : {},
    )
  }
  return { ...actual, ...wrapped, default: { ...actual, ...wrapped } }
})

const RULE = 'settings-skilloverrides-unknown-skill'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const SKILLS = '.claude/skills'
const COMMANDS = '.claude/commands'
const skill = (fields = '') => (fields === '' ? 'Do it.\n' : `---\n${fields}\n---\nDo it.\n`)
const settings = (keys: Record<string, unknown>) => JSON.stringify({ skillOverrides: keys })

/** The messages of the rule for the settings text `code` at `file` in the tree `dir`. */
function lint(dir: string, code: string, file = PROJECT, options?: { allow: string[] }) {
  return new Linter({ cwd: path.parse(dir).root }).verify(
    code,
    [
      {
        files: ['**/.claude/settings.json', '**/.claude/settings.local.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${RULE}`]: options === undefined ? 'error' : ['error', options] },
      },
    ],
    { filename: path.join(dir, file) },
  )
}

const ids = (...args: Parameters<typeof lint>) => lint(...args).map((m) => m.messageId)

describe(RULE, () => {
  describe('stays silent', () => {
    it.each([
      'artifact-capabilities',
      'artifact-diagramming',
      'batch',
      'claude-api',
      'claude-in-chrome',
      'code-review',
      'dataviz',
      'debug',
      'design',
      'design-sync',
      'doctor',
      'fewer-permission-prompts',
      'loop',
      'run',
      'run-skill-generator',
      'simplify',
      'slides',
      'update-config',
      'verify',
      'workflow-authoring',
    ])('for the bundled skill %s, with no skills directory', (key) => {
      const dir = tree({})
      expect(lint(dir, settings({ [key]: 'off' }))).toEqual([])
      expect(lint(dir, settings({ [key]: 'off' }), LOCAL)).toEqual([])
    })

    it.each(['review', 'checkup', 'proactive'])(
      'for the alias %s of a bundled skill, which settings-skilloverrides-key owns',
      (key) => {
        expect(lint(tree({}), settings({ [key]: 'off' }))).toEqual([])
      },
    )

    it('for an alias of a bundled skill in other letter case', () => {
      expect(lint(tree({}), settings({ Review: 'off', CHECKUP: 'off' }))).toEqual([])
    })

    it('for a skill folder, by its folder name and by the name field of its SKILL.md', () => {
      const dir = tree({ [`${SKILLS}/deploy-staging/SKILL.md`]: skill('name: deploy') })
      expect(lint(dir, settings({ 'deploy-staging': 'off', deploy: 'name-only' }))).toEqual([])
      expect(lint(dir, settings({ Deploy: 'off' }), LOCAL)).toEqual([])
    })

    it('for a skill folder whose SKILL.md has no name field or no frontmatter', () => {
      const dir = tree({
        [`${SKILLS}/plain/SKILL.md`]: skill(),
        [`${SKILLS}/numbered/SKILL.md`]: skill('name: 7'),
      })
      expect(lint(dir, settings({ plain: 'off', numbered: 'off' }))).toEqual([])
    })

    it('for a command file, by its file name', () => {
      const dir = tree({ [`${COMMANDS}/ship.md`]: 'Ship it.\n' })
      expect(lint(dir, settings({ ship: 'off' }))).toEqual([])
    })

    it('for a key that the option allow lists', () => {
      const dir = tree({})
      expect(
        lint(dir, settings({ 'my-user-skill': 'off' }), PROJECT, { allow: ['my-user-skill'] }),
      ).toEqual([])
      expect(
        lint(dir, settings({ 'My-User-Skill': 'off' }), PROJECT, { allow: ['my-user-skill'] }),
      ).toEqual([])
    })

    it('for a key with a colon: a plugin skill, a nested skill or a command in a subfolder', () => {
      const dir = tree({})
      expect(
        lint(dir, settings({ 'my-plugin:review': 'off', 'apps/web:deploy': 'off', 'a:b': 'off' })),
      ).toEqual([])
    })

    it('for a skill in the skills directory of a directory above the project', () => {
      const dir = tree({
        [`${SKILLS}/root/SKILL.md`]: skill(),
        'packages/app/.claude/settings.json': '{}',
      })
      expect(lint(dir, settings({ root: 'off' }), 'packages/app/.claude/settings.json')).toEqual([])
    })

    it('for a skill when there is no .git, with the skills in the same .claude directory', () => {
      const dir = tree({ [`${SKILLS}/s/SKILL.md`]: skill() }, false)
      expect(lint(dir, settings({ s: 'off' }))).toEqual([])
    })

    it('for a key with a null value, which removes the entry', () => {
      expect(lint(tree({}), '{"skillOverrides": {"nothing": null}}')).toEqual([])
    })

    it.each([
      ['null', 'null'],
      ['a string', '"off"'],
      ['an array', '["x"]'],
    ])('for a skillOverrides value that is %s, which settings-schema reports', (_title, value) => {
      expect(lint(tree({}), `{"skillOverrides": ${value}}`)).toEqual([])
    })

    it('for a file with no skillOverrides key, or a value that is not an object', () => {
      const dir = tree({})
      expect(lint(dir, '{"model": "opus"}')).toEqual([])
      expect(lint(dir, '[1]')).toEqual([])
    })

    it('without a scan, when every key is a known name', () => {
      recorded.paths = []
      recorded.on = true
      try {
        expect(ids(tree({}), settings({ batch: 'off', 'p:q': 'off' }))).toEqual([])
      } finally {
        recorded.on = false
      }
      expect(recorded.paths.filter((entry) => entry.endsWith(`${path.sep}skills`))).toEqual([])
    })

    it.skipIf(noLinks)('for a link out of the repository, which can hold the skill', () => {
      const outside = tree({ 'x/SKILL.md': skill() }, false)
      const dir = tree({})
      link(dir, SKILLS, outside)
      expect(lint(dir, settings({ anything: 'off' }))).toEqual([])
    })
  })

  describe('reports', () => {
    it('a key that no bundled skill, skill folder or command has, on the key', () => {
      const dir = tree({ [`${SKILLS}/deploy/SKILL.md`]: skill() })
      const messages = lint(dir, '{"skillOverrides": {"nothing": "off"}}')
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        ruleId: `claude/${RULE}`,
        messageId: 'unknown',
        line: 1,
        column: 21,
        endLine: 1,
        endColumn: 30,
      })
      expect(messages[0]?.message).toBe(
        '"nothing" is not a bundled skill, and no skill or command in .claude/ has that name, so this entry has no effect. If the skill is a user skill, name it in the option "allow".',
      )
    })

    it('in the local file too, and with no skills directory', () => {
      const dir = tree({})
      expect(ids(dir, settings({ nothing: 'off' }))).toEqual(['unknown'])
      expect(ids(dir, settings({ nothing: 'off' }), LOCAL)).toEqual(['unknown'])
    })

    it('each unknown key, and none of the known ones', () => {
      const dir = tree({ [`${SKILLS}/deploy/SKILL.md`]: skill() })
      expect(ids(dir, settings({ a: 'off', deploy: 'off', b: 'off', batch: 'off' }))).toEqual([
        'unknown',
        'unknown',
      ])
    })

    it('a command in a subfolder, whose name has a colon, under its bare name', () => {
      const dir = tree({ [`${COMMANDS}/frontend/component.md`]: 'Go.\n' })
      expect(ids(dir, settings({ component: 'off' }))).toEqual(['unknown'])
    })

    it('a file in the skills directory that is not a folder with a SKILL.md, by name only', () => {
      const dir = tree({ [`${SKILLS}/notes.txt`]: 'x\n' })
      expect(ids(dir, settings({ other: 'off' }))).toEqual(['unknown'])
      expect(ids(dir, settings({ 'notes.txt': 'off' }))).toEqual([])
    })

    it('a skill of another project, and a skill below the project', () => {
      const dir = tree({
        'packages/other/.claude/skills/theirs/SKILL.md': skill(),
        'packages/app/.claude/skills/nested/SKILL.md': skill(),
      })
      expect(ids(dir, settings({ theirs: 'off', nested: 'off' }))).toEqual(['unknown', 'unknown'])
    })

    it('a skill in a directory above the repository that holds the project', () => {
      const dir = tree({
        [`${SKILLS}/outer/SKILL.md`]: skill(),
        'packages/inner/.git/HEAD': '',
        'packages/inner/.claude/settings.json': '{}',
      })
      expect(ids(dir, settings({ outer: 'off' }), 'packages/inner/.claude/settings.json')).toEqual([
        'unknown',
      ])
    })

    it('the last of two keys of one name', () => {
      const dir = tree({})
      expect(ids(dir, '{"skillOverrides": {"nothing": "off", "nothing": "on"}}')).toEqual([
        'unknown',
      ])
      expect(ids(dir, '{"skillOverrides": {"nothing": "off", "nothing": null}}')).toEqual([])
    })

    it('with the option allow set to other names', () => {
      const dir = tree({})
      expect(ids(dir, settings({ nothing: 'off' }), PROJECT, { allow: ['other'] })).toEqual([
        'unknown',
      ])
    })
  })

  // These cases show that the walk stays in the repository (ADR 001, Decision 14).
  describe('the repository bound', () => {
    it('reads no path above the repository root, and uses no skill from there', () => {
      const outer = tree(
        { [`${SKILLS}/clash/SKILL.md`]: skill(), [`${COMMANDS}/clash2.md`]: 'x\n' },
        false,
      )
      const repo = path.join(outer, 'repo')
      mkdirSync(path.join(repo, '.git'), { recursive: true })
      recorded.paths = []
      recorded.on = true
      try {
        expect(
          ids(outer, settings({ clash: 'off', clash2: 'off' }), 'repo/.claude/settings.json'),
        ).toEqual(['unknown', 'unknown'])
      } finally {
        recorded.on = false
      }
      const inside = (entry: string) =>
        [repo, realpathSync(repo)].some(
          (root) => entry === root || entry.startsWith(root + path.sep),
        )
      expect(recorded.paths.length).toBeGreaterThan(0)
      expect(recorded.paths.filter((entry) => !inside(entry))).toEqual([])
    })

    it.skipIf(noLinks)(
      'stays silent for a project that a link out of the repository reaches',
      () => {
        const outside = tree({ [`${SKILLS}/x/SKILL.md`]: skill() }, false)
        const dir = tree({ [`${SKILLS}/root/SKILL.md`]: skill() })
        link(dir, 'linked', outside)
        for (const key of ['x', 'root', 'nothing']) {
          expect(ids(dir, settings({ [key]: 'off' }), 'linked/.claude/settings.json')).toEqual([])
        }
      },
    )

    it.skipIf(noLinks)(
      'stays silent for a dangling .claude link in a directory above the project',
      () => {
        const dir = tree({ 'packages/app/.claude/settings.json': '{}' })
        link(dir, 'packages/.claude', 'missing-claude')
        expect(
          ids(dir, settings({ nothing: 'off' }), 'packages/app/.claude/settings.json'),
        ).toEqual([])
      },
    )

    it.skipIf(noLinks)('stays silent for a dangling link in place of the skills directory', () => {
      const dir = tree({})
      link(dir, SKILLS, 'missing-skills')
      expect(ids(dir, settings({ nothing: 'off' }))).toEqual([])
    })

    it.skipIf(noLinks)(
      'stays silent for a dangling link in place of the commands directory',
      () => {
        const dir = tree({})
        link(dir, COMMANDS, 'missing-commands')
        expect(ids(dir, settings({ nothing: 'off' }))).toEqual([])
      },
    )

    it.skipIf(noLinks)(
      'stays silent for a skill folder that is a link out of the repository',
      () => {
        const outside = tree({ 'SKILL.md': skill('name: far') }, false)
        const dir = tree({ [`${SKILLS}/near/SKILL.md`]: skill() })
        link(dir, `${SKILLS}/far`, outside)
        expect(ids(dir, settings({ nothing: 'off' }))).toEqual([])
      },
    )

    it.skipIf(noLinks)('stays silent for a SKILL.md that is a link out of the repository', () => {
      const outside = tree({ 'SKILL.md': skill('name: far') }, false)
      const dir = tree({ [`${SKILLS}/near/placeholder.txt`]: 'x\n' })
      link(dir, `${SKILLS}/near/SKILL.md`, path.join(outside, 'SKILL.md'))
      expect(ids(dir, settings({ other: 'off' }))).toEqual([])
    })

    it.skipIf(noLinks)('reads the name of a SKILL.md that is a link inside the repository', () => {
      const dir = tree({
        [`${SKILLS}/near/placeholder.txt`]: 'x\n',
        'shared/SKILL.md': skill('name: far'),
      })
      link(dir, `${SKILLS}/near/SKILL.md`, path.join(dir, 'shared/SKILL.md'))
      expect(ids(dir, settings({ far: 'off' }))).toEqual([])
      expect(ids(dir, settings({ nothing: 'off' }))).toEqual(['unknown'])
    })

    it.skipIf(noLinks)('stays silent for a SKILL.md that is a dangling link', () => {
      const dir = tree({ [`${SKILLS}/near/placeholder.txt`]: 'x\n' })
      link(dir, `${SKILLS}/near/SKILL.md`, 'missing-file')
      expect(ids(dir, settings({ other: 'off' }))).toEqual([])
    })

    it.skipIf(noLinks)('stays silent for a skill folder that is a dangling link', () => {
      const dir = tree({ [`${SKILLS}/near/SKILL.md`]: skill() })
      link(dir, `${SKILLS}/gone`, 'missing-folder')
      expect(ids(dir, settings({ nothing: 'off' }))).toEqual([])
    })

    it.skipIf(noLinks)(
      'stays silent for a link out of the repository inside the commands directory',
      () => {
        const outside = tree({ 'out.md': 'x\n' }, false)
        const dir = tree({ [`${COMMANDS}/root.md`]: 'x\n' })
        link(dir, `${COMMANDS}/shared`, outside)
        expect(ids(dir, settings({ nothing: 'off' }))).toEqual([])
      },
    )
  })

  // A read that fails with `EACCES` is not a file that is absent. The rule cannot see what it cannot
  // read, so it makes no report that rests on it.
  describe.skipIf(chmodCannotBlock)('a path that the rule cannot read', () => {
    it('stays silent for a skills directory that it cannot read, and reports when it can', () => {
      const dir = tree({ [`${SKILLS}/deploy/SKILL.md`]: skill() })
      expect(ids(dir, settings({ nothing: 'off' }))).toEqual(['unknown'])
      withoutAccess(path.join(dir, SKILLS), () => {
        expect(ids(dir, settings({ nothing: 'off' }))).toEqual([])
      })
    })

    it('stays silent for a SKILL.md that it cannot read, next to a readable one', () => {
      const dir = tree({
        [`${SKILLS}/a/SKILL.md`]: skill('name: a'),
        [`${SKILLS}/b/SKILL.md`]: skill('name: b'),
      })
      withoutAccess(path.join(dir, SKILLS, 'a', 'SKILL.md'), () => {
        expect(ids(dir, settings({ nothing: 'off' }))).toEqual([])
      })
      expect(ids(dir, settings({ nothing: 'off' }))).toEqual(['unknown'])
    })

    it('stays silent for a project directory that it cannot read, which hides its .claude', () => {
      const dir = tree({ 'packages/x/.claude/skills/hidden/SKILL.md': skill() })
      const file = 'packages/x/.claude/settings.json'
      expect(ids(dir, settings({ nothing: 'off' }), file)).toEqual(['unknown'])
      withoutAccess(path.join(dir, 'packages/x'), () => {
        expect(ids(dir, settings({ nothing: 'off' }), file)).toEqual([])
      })
    })
  })
})
