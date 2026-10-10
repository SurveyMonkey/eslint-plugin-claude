// The rule reads `.claude/agents/`, so each case builds a tree on disk. The expected values come
// from two pages. The settings reference says that `agent` is "the name of a built-in or custom
// agent" (https://code.claude.com/docs/en/settings-reference#agent). The sub-agents page lists the
// built-in agents and says that a project agent is a file in `.claude/agents/` with a `name`
// (https://code.claude.com/docs/en/sub-agents#built-in-subagents). The files glob is in
// tests/configs.test.ts.
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

const RULE = 'settings-agent-exists'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const AGENTS = '.claude/agents'
const agent = (fields = 'name: reviewer') => `---\n${fields}\n---\nReview the code.\n`
const settings = (value: unknown) => JSON.stringify({ agent: value })

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
      'Explore',
      'Plan',
      'general-purpose',
      'claude',
      'statusline-setup',
      'claude-code-guide',
    ])('for the built-in agent %s, with no agents directory', (value) => {
      const dir = tree({}, true)
      expect(lint(dir, settings(value))).toEqual([])
      expect(lint(dir, settings(value), LOCAL)).toEqual([])
    })

    it('for a built-in agent in another letter case', () => {
      expect(lint(tree({}), settings('explore'))).toEqual([])
    })

    it('for a project agent, by the name field of its frontmatter', () => {
      const dir = tree({ [`${AGENTS}/code-reviewer.md`]: agent('name: code-reviewer') })
      expect(lint(dir, settings('code-reviewer'))).toEqual([])
      expect(lint(dir, settings('code-reviewer'), LOCAL)).toEqual([])
      expect(lint(dir, settings('Code-Reviewer'))).toEqual([])
    })

    it('for an agent in a folder below the agents directory', () => {
      const dir = tree({ [`${AGENTS}/team/reviewer.md`]: agent() })
      expect(lint(dir, settings('reviewer'))).toEqual([])
    })

    it('for a name that the option allow lists', () => {
      const dir = tree({})
      expect(lint(dir, settings('my-user-agent'), PROJECT, { allow: ['my-user-agent'] })).toEqual(
        [],
      )
      expect(lint(dir, settings('My-User-Agent'), PROJECT, { allow: ['my-user-agent'] })).toEqual(
        [],
      )
    })

    it('for a plugin agent, whose name has a colon', () => {
      expect(lint(tree({}), settings('my-plugin:reviewer'))).toEqual([])
    })

    it('for an agent in the agents directory of a directory above the project', () => {
      const dir = tree({
        [`${AGENTS}/root.md`]: agent('name: root'),
        'packages/app/.claude/settings.json': '{}',
      })
      expect(lint(dir, settings('root'), 'packages/app/.claude/settings.json')).toEqual([])
    })

    it('for an agent when there is no .git, with the agents in the same .claude directory', () => {
      const dir = tree({ [`${AGENTS}/reviewer.md`]: agent() }, false)
      expect(lint(dir, settings('reviewer'))).toEqual([])
    })

    it.each([
      ['null', 'null'],
      ['a number', '3'],
      ['a Boolean', 'true'],
      ['an array', '["x"]'],
      ['an object', '{}'],
      ['an empty string', '""'],
    ])('for a value that is %s, which settings-schema reports', (_title, value) => {
      expect(lint(tree({}), `{"agent": ${value}}`)).toEqual([])
    })

    it('for a file with no agent key, or a value that is not an object', () => {
      const dir = tree({})
      expect(lint(dir, '{"model": "opus"}')).toEqual([])
      expect(lint(dir, '[1]')).toEqual([])
    })

    it.skipIf(noLinks)('for a link out of the repository, which can hold the agent', () => {
      const outside = tree({ 'x.md': agent('name: x') }, false)
      const dir = tree({})
      link(dir, AGENTS, outside)
      expect(lint(dir, settings('anything'))).toEqual([])
    })
  })

  describe('reports', () => {
    it('a name that no built-in or project agent has, on the value', () => {
      const dir = tree({ [`${AGENTS}/reviewer.md`]: agent() })
      const messages = lint(dir, '{"agent": "nobody"}')
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        ruleId: `claude/${RULE}`,
        messageId: 'unknown',
        line: 1,
        column: 11,
        endLine: 1,
        endColumn: 19,
      })
      expect(messages[0]?.message).toBe(
        '"nobody" is not a built-in agent, and no file in .claude/agents/ defines it. If the agent is a user or plugin agent, name it in the option "allow".',
      )
    })

    it('an agent file whose name is not a string, or that has no frontmatter', () => {
      const dir = tree({
        [`${AGENTS}/numbered.md`]: agent('name: 7'),
        [`${AGENTS}/bare.md`]: 'Hi\n',
      })
      expect(ids(dir, settings('numbered'))).toEqual(['unknown'])
      expect(ids(dir, settings('bare'))).toEqual(['unknown'])
    })

    it('in the local file too, and with no agents directory', () => {
      const dir = tree({})
      expect(ids(dir, settings('nobody'))).toEqual(['unknown'])
      expect(ids(dir, settings('nobody'), LOCAL)).toEqual(['unknown'])
    })

    it('an agent whose file name differs from its name field, by the file name', () => {
      const dir = tree({ [`${AGENTS}/file-name.md`]: agent('name: frontmatter-name') })
      expect(ids(dir, settings('file-name'))).toEqual(['unknown'])
    })

    it('a file that is not Markdown, and an agent of another project', () => {
      const dir = tree({
        [`${AGENTS}/notes.txt`]: agent('name: notes'),
        'packages/other/.claude/agents/theirs.md': agent('name: theirs'),
      })
      expect(ids(dir, settings('notes'))).toEqual(['unknown'])
      expect(ids(dir, settings('theirs'))).toEqual(['unknown'])
    })

    it('an agent in a directory above the repository that holds the project', () => {
      const dir = tree({
        [`${AGENTS}/outer.md`]: agent('name: outer'),
        'packages/inner/.git/HEAD': '',
        'packages/inner/.claude/settings.json': '{}',
      })
      expect(ids(dir, settings('outer'), 'packages/inner/.claude/settings.json')).toEqual([
        'unknown',
      ])
    })

    it('the last of two agent keys', () => {
      const dir = tree({ [`${AGENTS}/reviewer.md`]: agent() })
      expect(ids(dir, '{"agent": "nobody", "agent": "reviewer"}')).toEqual([])
      expect(ids(dir, '{"agent": "reviewer", "agent": "nobody"}')).toEqual(['unknown'])
    })

    it('with the option allow set to other names', () => {
      const dir = tree({})
      expect(ids(dir, settings('nobody'), PROJECT, { allow: ['other'] })).toEqual(['unknown'])
    })
  })

  // These cases show that the walk stays in the repository (ADR 001, Decision 14).
  describe('the repository bound', () => {
    it('reads no path above the repository root, and uses no agent from there', () => {
      const outer = tree({ [`${AGENTS}/clash.md`]: agent('name: clash') }, false)
      const repo = path.join(outer, 'repo')
      mkdirSync(path.join(repo, '.git'), { recursive: true })
      recorded.paths = []
      recorded.on = true
      try {
        expect(ids(outer, settings('clash'), 'repo/.claude/settings.json')).toEqual(['unknown'])
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
        const outside = tree({ [`${AGENTS}/x.md`]: agent('name: x') }, false)
        const dir = tree({ [`${AGENTS}/root.md`]: agent('name: root') })
        link(dir, 'linked', outside)
        for (const value of ['x', 'root', 'nobody']) {
          expect(ids(dir, settings(value), 'linked/.claude/settings.json')).toEqual([])
        }
      },
    )

    it.skipIf(noLinks)(
      'stays silent for a dangling .claude link in a directory above the project',
      () => {
        const dir = tree({ 'packages/app/.claude/settings.json': '{}' })
        link(dir, 'packages/.claude', 'missing-claude')
        expect(ids(dir, settings('nobody'), 'packages/app/.claude/settings.json')).toEqual([])
      },
    )

    it.skipIf(noLinks)('stays silent for a dangling link in place of the agents directory', () => {
      const dir = tree({})
      link(dir, AGENTS, 'missing-agents')
      expect(ids(dir, settings('nobody'))).toEqual([])
    })

    it.skipIf(noLinks)(
      'stays silent for a link out of the repository below a readable root',
      () => {
        const outside = tree({ 'out.md': agent('name: out') })
        const dir = tree({ [`${AGENTS}/root.md`]: agent('name: root') })
        link(dir, 'packages/app/.claude/agents', outside)
        expect(ids(dir, settings('nobody'), 'packages/app/.claude/settings.json')).toEqual([])
      },
    )

    it.skipIf(noLinks)(
      'stays silent for a link out of the repository inside the agents directory',
      () => {
        const outside = tree({ 'out.md': agent('name: out') })
        const dir = tree({ [`${AGENTS}/root.md`]: agent('name: root') })
        link(dir, `${AGENTS}/shared`, outside)
        expect(ids(dir, settings('nobody'))).toEqual([])
      },
    )
  })

  // A read that fails with `EACCES` is not a file that is absent. The rule cannot see what it cannot
  // read, so it makes no report that rests on it.
  describe.skipIf(chmodCannotBlock)('a path that the rule cannot read', () => {
    it('stays silent for an agents directory that it cannot read, and reports when it can', () => {
      const dir = tree({ [`${AGENTS}/reviewer.md`]: agent() })
      expect(ids(dir, settings('nobody'))).toEqual(['unknown'])
      withoutAccess(path.join(dir, AGENTS), () => {
        expect(ids(dir, settings('reviewer'))).toEqual([])
        expect(ids(dir, settings('nobody'))).toEqual([])
      })
    })

    it('stays silent for an agent file that it cannot read, next to a readable one', () => {
      const dir = tree({
        [`${AGENTS}/a.md`]: agent('name: a'),
        [`${AGENTS}/b.md`]: agent('name: b'),
      })
      withoutAccess(path.join(dir, AGENTS, 'a.md'), () => {
        expect(ids(dir, settings('nobody'))).toEqual([])
      })
      expect(ids(dir, settings('nobody'))).toEqual(['unknown'])
    })

    it('stays silent for a project directory that it cannot read, which hides its .claude', () => {
      const dir = tree({ 'packages/x/.claude/agents/hidden.md': agent('name: hidden') })
      const file = 'packages/x/.claude/settings.json'
      expect(ids(dir, settings('nobody'), file)).toEqual(['unknown'])
      withoutAccess(path.join(dir, 'packages/x'), () => {
        expect(ids(dir, settings('nobody'), file)).toEqual([])
      })
    })
  })
})
