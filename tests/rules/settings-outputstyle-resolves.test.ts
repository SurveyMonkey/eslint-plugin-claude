// The rule reads `.claude/output-styles/`, so each case builds a tree on disk. The expected
// values come from the output styles page (https://code.claude.com/docs/en/output-styles). The
// page gives the built-in names with their letter case. The file name is the style name unless
// the frontmatter sets `name`. Project styles load from the directories between the working
// directory and the repository root. The files glob is in tests/configs.test.ts.
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

const RULE = 'settings-outputstyle-resolves'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const STYLES = '.claude/output-styles'
const style = (fields = '') => (fields === '' ? 'Be brief.\n' : `---\n${fields}\n---\nBe brief.\n`)
const settings = (value: unknown) => JSON.stringify({ outputStyle: value })

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
    it.each(['default', 'Proactive', 'Concise', 'Explanatory', 'Learning'])(
      'for the built-in style %s, with no styles directory',
      (value) => {
        const dir = tree({}, true)
        expect(lint(dir, settings(value))).toEqual([])
        expect(lint(dir, settings(value), LOCAL)).toEqual([])
      },
    )

    it('for a custom style by its file name, without the extension', () => {
      const dir = tree({ [`${STYLES}/review.md`]: style() })
      expect(lint(dir, settings('review'))).toEqual([])
      expect(lint(dir, settings('review'), LOCAL)).toEqual([])
    })

    it('for a custom style by its frontmatter name, and by its file name too', () => {
      const dir = tree({ [`${STYLES}/diagrams.md`]: style('name: Diagrams first') })
      expect(lint(dir, settings('Diagrams first'))).toEqual([])
      expect(lint(dir, settings('diagrams'))).toEqual([])
    })

    it('for a style in a folder below the styles directory', () => {
      const dir = tree({ [`${STYLES}/team/review.md`]: style() })
      expect(lint(dir, settings('review'))).toEqual([])
    })

    it('for a style whose frontmatter does not parse, which loads under its file name', () => {
      const dir = tree({ [`${STYLES}/broken.md`]: style('name: [unclosed') })
      expect(lint(dir, settings('broken'))).toEqual([])
    })

    it('for a style whose name field is not a string', () => {
      const dir = tree({ [`${STYLES}/numbered.md`]: style('name: 7') })
      expect(lint(dir, settings('numbered'))).toEqual([])
      expect(ids(dir, settings('Nope'))).toEqual(['unknown'])
    })

    it('for a style that the option allow lists', () => {
      const dir = tree({})
      expect(lint(dir, settings('my-user-style'), PROJECT, { allow: ['my-user-style'] })).toEqual(
        [],
      )
    })

    it('for a style in the styles directory of a directory above the project', () => {
      const dir = tree({
        [`${STYLES}/root.md`]: style(),
        'packages/app/.claude/settings.json': '{}',
      })
      expect(lint(dir, settings('root'), 'packages/app/.claude/settings.json')).toEqual([])
    })

    it('for a style when there is no .git, with the styles in the same .claude directory', () => {
      const dir = tree({ [`${STYLES}/review.md`]: style() }, false)
      expect(lint(dir, settings('review'))).toEqual([])
    })

    it.each([
      ['null', 'null'],
      ['a number', '3'],
      ['a Boolean', 'true'],
      ['an array', '["x"]'],
      ['an object', '{}'],
    ])('for a value that is %s, which settings-schema reports', (_title, value) => {
      const dir = tree({})
      expect(lint(dir, `{"outputStyle": ${value}}`)).toEqual([])
    })

    it('for a file with no outputStyle key, or a value that is not an object', () => {
      const dir = tree({})
      expect(lint(dir, '{"model": "opus"}')).toEqual([])
      expect(lint(dir, '[1]')).toEqual([])
    })

    it.skipIf(noLinks)('for a link out of the repository, which can hold the style', () => {
      const outside = tree({ 'x.md': style() }, false)
      const dir = tree({})
      link(dir, STYLES, outside)
      expect(lint(dir, settings('anything'))).toEqual([])
    })
  })

  describe('reports', () => {
    it('a style that no built-in or custom style has, on the value', () => {
      const dir = tree({ [`${STYLES}/review.md`]: style() })
      const messages = lint(dir, '{"outputStyle": "Nope"}')
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        ruleId: `claude/${RULE}`,
        messageId: 'unknown',
        line: 1,
        column: 17,
        endLine: 1,
        endColumn: 23,
      })
      expect(messages[0]?.message).toBe(
        '"Nope" is not a built-in output style, and no file in .claude/output-styles/ has that name. Claude Code uses the Default style.',
      )
    })

    it('in the local file too, and with no styles directory', () => {
      const dir = tree({})
      expect(ids(dir, settings('Nope'))).toEqual(['unknown'])
      expect(ids(dir, settings('Nope'), LOCAL)).toEqual(['unknown'])
    })

    it('a built-in style in the wrong letter case, with the name to write', () => {
      const dir = tree({})
      const messages = lint(dir, settings('explanatory'))
      expect(messages.map((m) => m.messageId)).toEqual(['caseMismatch'])
      expect(messages[0]?.message).toBe(
        'Claude Code compares "outputStyle" with case, and "explanatory" matches no style. It uses the Default style. Write "Explanatory".',
      )
    })

    it.each([
      ['Default', 'default'],
      ['PROACTIVE', 'Proactive'],
      ['learning', 'Learning'],
    ])('the built-in style %s, which should be %s', (value, match) => {
      const dir = tree({})
      const messages = lint(dir, settings(value))
      expect(messages.map((m) => m.messageId)).toEqual(['caseMismatch'])
      expect(messages[0]?.message).toContain(`Write "${match}".`)
    })

    it('a custom style in the wrong letter case, by file name and by frontmatter name', () => {
      const dir = tree({
        [`${STYLES}/review.md`]: style(),
        [`${STYLES}/diagrams.md`]: style('name: Diagrams first'),
      })
      expect(lint(dir, settings('Review')).map((m) => m.message)).toEqual([
        expect.stringContaining('Write "review".'),
      ])
      expect(lint(dir, settings('diagrams first')).map((m) => m.message)).toEqual([
        expect.stringContaining('Write "Diagrams first".'),
      ])
    })

    it('a style that the option allow lists in the wrong letter case', () => {
      const dir = tree({})
      const messages = lint(dir, settings('my-user-style'), PROJECT, { allow: ['My-User-Style'] })
      expect(messages.map((m) => m.messageId)).toEqual(['caseMismatch'])
      expect(messages[0]?.message).toContain('Write "My-User-Style".')
    })

    it('a file that is not Markdown, and a style of another project', () => {
      const dir = tree({
        [`${STYLES}/notes.txt`]: style(),
        'packages/other/.claude/output-styles/theirs.md': style(),
      })
      expect(ids(dir, settings('notes'))).toEqual(['unknown'])
      expect(ids(dir, settings('theirs'))).toEqual(['unknown'])
    })

    it('a style in a directory above the repository that holds the project', () => {
      const dir = tree({
        [`${STYLES}/outer.md`]: style(),
        'packages/inner/.git/HEAD': '',
        'packages/inner/.claude/settings.json': '{}',
      })
      expect(ids(dir, settings('outer'), 'packages/inner/.claude/settings.json')).toEqual([
        'unknown',
      ])
    })

    it('a style that sits next to .claude, and not in it', () => {
      const dir = tree({ 'output-styles/review.md': style() }, false)
      expect(ids(dir, settings('review'))).toEqual(['unknown'])
    })

    it('the last of two outputStyle keys', () => {
      const dir = tree({ [`${STYLES}/review.md`]: style() })
      expect(ids(dir, '{"outputStyle": "Nope", "outputStyle": "review"}')).toEqual([])
      expect(ids(dir, '{"outputStyle": "review", "outputStyle": "Nope"}')).toEqual(['unknown'])
    })

    it('with the option allow set to other names', () => {
      const dir = tree({})
      expect(ids(dir, settings('Nope'), PROJECT, { allow: ['other'] })).toEqual(['unknown'])
    })
  })

  // A read that fails with `EACCES` is not a file that is absent. The rule cannot see what it cannot
  // read, so it makes no report that rests on it.
  describe('the repository bound', () => {
    it('reads no path above the repository root, and uses no style from there', () => {
      const outer = tree({ [`${STYLES}/clash.md`]: style() }, false)
      const repo = path.join(outer, 'repo')
      mkdirSync(path.join(repo, '.git'), { recursive: true })
      const file = 'repo/.claude/settings.json'
      recorded.paths = []
      recorded.on = true
      try {
        expect(ids(outer, settings('clash'), file)).toEqual(['unknown'])
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

    it.skipIf(noLinks)('finds the root styles for a project that a link reaches', () => {
      const outside = tree({}, false)
      const dir = tree({ [`${STYLES}/root.md`]: style() })
      link(dir, 'linked', outside)
      expect(ids(dir, settings('root'), 'linked/.claude/settings.json')).toEqual([])
      expect(ids(dir, settings('Nope'), 'linked/.claude/settings.json')).toEqual(['unknown'])
    })

    it('stays silent for a dangling link in place of the styles directory', () => {
      const dir = tree({})
      link(dir, STYLES, 'missing-styles')
      expect(ids(dir, settings('Nope'))).toEqual([])
    })

    it.skipIf(noLinks)(
      'stays silent for a link out of the repository below a readable root',
      () => {
        const outside = tree({ 'out.md': style() })
        const dir = tree({ [`${STYLES}/root.md`]: style() })
        link(dir, 'packages/app/.claude/output-styles', outside)
        expect(ids(dir, settings('Nope'), 'packages/app/.claude/settings.json')).toEqual([])
      },
    )
  })

  describe.skipIf(chmodCannotBlock)('a path that the rule cannot read', () => {
    it('stays silent for a styles directory that it cannot read, and reports when it can', () => {
      const dir = tree({ [`${STYLES}/review.md`]: style() })
      expect(ids(dir, settings('Nope'))).toEqual(['unknown'])
      withoutAccess(path.join(dir, STYLES), () => {
        expect(ids(dir, settings('review'))).toEqual([])
        expect(ids(dir, settings('Nope'))).toEqual([])
      })
    })

    it('stays silent for a style file that it cannot read, next to a readable one', () => {
      const dir = tree({
        [`${STYLES}/a.md`]: style(),
        [`${STYLES}/b.md`]: style(),
      })
      withoutAccess(path.join(dir, STYLES, 'a.md'), () => {
        expect(ids(dir, settings('Nope'))).toEqual([])
      })
      expect(ids(dir, settings('Nope'))).toEqual(['unknown'])
    })
  })
})
