// Claude Code puts the name and description of each skill in a listing with a character budget.
// The documented fallback is 8,000 characters, and two settings move it, so the option `max` has no
// schema maximum. The text of one entry is cut at 1,536 characters (`listingMax`). The rule sums the
// entries of one scope, a `.claude/` directory or a plugin root. The trees are built in a
// temporary directory, one tree for each case.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  chmodCannotBlock,
  lintMarkdown,
  markdownTester,
  ruleOf,
  withoutAccess,
} from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-listing-budget-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

/** Write `text` to `file` below the scratch directory. Returns the path. */
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}
const at = (file: string) => path.join(scratch, file)
const x = (count: number) => 'x'.repeat(count)
/** A skill file with a `description` of `count` characters, and more frontmatter lines. */
const described = (count: number, extra = '') => `---\ndescription: ${x(count)}\n${extra}---\n`

/** The entries of one tree: each skill folder is one letter, with a description of 99
 *  characters, so that the entry is 100 characters. */
const hundred = described(99)
function hundreds(tree: string, folders: string[]) {
  for (const folder of folders) {
    put(`${tree}/.claude/skills/${folder}/SKILL.md`, hundred)
  }
}
const skillIn = (tree: string, folder: string) => at(`${tree}/.claude/skills/${folder}/SKILL.md`)

const error = (
  messageId: 'overFallbackBudget' | 'overConfiguredLimit',
  data: Record<string, string>,
) => ({
  messageId,
  data,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
})
const fallback = (total: number, own: number) =>
  error('overFallbackBudget', { total: String(total), own: String(own), max: '8000' })
const configured = (total: number, own: number, max: number) =>
  error('overConfiguredLimit', { total: String(total), own: String(own), max: String(max) })

// Two skills of 100 characters each: 200 characters.
hundreds('two', ['a', 'b'])
// Six skills of 1,501 characters each (a name of 1 and a description of 1,500): 9,006 characters.
for (const folder of ['a', 'b', 'c', 'd', 'e', 'f']) {
  put(`six/.claude/skills/${folder}/SKILL.md`, described(1500))
}
// The same, with five skills: 7,505 characters.
for (const folder of ['a', 'b', 'c', 'd', 'e']) {
  put(`five/.claude/skills/${folder}/SKILL.md`, described(1500))
}
// The `name` field replaces the folder name, and `when_to_use` adds to the description.
put('named/.claude/skills/a/SKILL.md', `---\nname: longname\ndescription: ${x(42)}\n---\n`)
put('named/.claude/skills/b/SKILL.md', `---\ndescription: ${x(49)}\nwhen_to_use: ${x(50)}\n---\n`)
// A field that is not text adds nothing, and a name that is empty gives way to the folder.
put('fields/.claude/skills/a/SKILL.md', '---\nname: 7\ndescription: [1, 2]\nwhen_to_use: 5\n---\n')
put('fields/.claude/skills/b/SKILL.md', `---\nname: ""\ndescription: ${x(98)}\n---\n`)
// A description over the cut counts as the cut.
put('cut/.claude/skills/a/SKILL.md', described(5000))
put('cut/.claude/skills/b/SKILL.md', described(5000))
// A skill that only the user invokes is not in the listing.
put('manual/.claude/skills/a/SKILL.md', described(99))
put('manual/.claude/skills/b/SKILL.md', described(5000, 'disable-model-invocation: true\n'))
put('manual/.claude/skills/c/SKILL.md', described(5000, 'disable-model-invocation: "true"\n'))
put('manual/.claude/skills/d/SKILL.md', described(5000, 'disable-model-invocation: false\n'))
put('manual/.claude/skills/e/SKILL.md', described(5000, 'user-invocable: false\n'))
// A skill with no frontmatter, or with frontmatter that does not parse, has its folder name.
put('bare/.claude/skills/a/SKILL.md', '# Bare\n')
put('bare/.claude/skills/b/SKILL.md', '---\nname: [unclosed\n---\n')
put('bare/.claude/skills/c/SKILL.md', '---\n- a\n- b\n---\n')
// Commands: the name is the path, and a `name` field is not read.
put('commands/.claude/skills/a/SKILL.md', hundred)
put('commands/.claude/commands/c.md', `---\nname: ignored\ndescription: ${x(99)}\n---\n`)
put('commands/.claude/commands/ns/d.md', `---\ndescription: ${x(96)}\n---\n`)
put('commands/.claude/commands/manual.md', described(5000, 'disable-model-invocation: true\n'))
// Another scope does not count: a nested `.claude/` and a plugin.
hundreds('scopes', ['a'])
hundreds('scopes/packages/web', ['b', 'c'])
put('scopes/plugin/.claude-plugin/plugin.json', '{"name":"p"}')
put('scopes/plugin/skills/d/SKILL.md', hundred)
put('scopes/plugin/commands/e.md', described(99))
// Files that are not skills or commands.
hundreds('other', ['a'])
put('other/.claude/skills/a/notes.md', described(5000))
put('other/.claude/skills/loose.md', described(5000))
put('other/.claude/agents/g.md', described(5000))
put('other/.claude/commands/readme.txt', 'x'.repeat(5000))
// A plugin: skills and commands share the scope.
put('plugin/.claude-plugin/plugin.json', '{"name":"p"}')
put('plugin/skills/a/SKILL.md', hundred)
put('plugin/skills/b/SKILL.md', hundred)
put('plugin/commands/c.md', described(99))
// A plugin that sets `commands` does not load `commands/`.
put('plugin-commands/.claude-plugin/plugin.json', '{"name":"p","commands":"./cmds"}')
put('plugin-commands/skills/a/SKILL.md', hundred)
put('plugin-commands/skills/b/SKILL.md', hundred)
put('plugin-commands/commands/c.md', described(99))
// A plugin that sets `skills` loads other folders, so the rule reads no `skills/`.
put('plugin-skills/.claude-plugin/plugin.json', '{"name":"p","skills":"./custom"}')
put('plugin-skills/skills/a/SKILL.md', hundred)
put('plugin-skills/skills/b/SKILL.md', hundred)
// A plugin whose manifest does not parse to an object cannot be read.
put('plugin-bad/.claude-plugin/plugin.json', '[]')
put('plugin-bad/skills/a/SKILL.md', hundred)
put('plugin-bad/skills/b/SKILL.md', hundred)
// A plugin-root skill has no folder, and the plugin may not load `skills/`.
put('plugin-root/.claude-plugin/plugin.json', '{"name":"p"}')
put('plugin-root/SKILL.md', described(99))
put('plugin-root/skills/a/SKILL.md', hundred)

markdownTester.run('skill-listing-budget', ruleOf('skill-listing-budget'), {
  valid: [
    // Within the fallback budget.
    { code: described(1500), filename: skillIn('five', 'a') },
    { code: hundred, filename: skillIn('two', 'a') },
    // The total at the limit is within it, and the total over the limit is not.
    { code: hundred, filename: skillIn('two', 'a'), options: [{ max: 200 }] },
    { code: hundred, filename: skillIn('two', 'b'), options: [{ max: 200 }] },
    { code: hundred, filename: skillIn('two', 'a'), options: [{ max: 8000 }] },
    // The `name` field and `when_to_use` count: 8 + 42 and 1 + 49 + 50 make 150 characters.
    {
      code: `---\nname: longname\ndescription: ${x(42)}\n---\n`,
      filename: skillIn('named', 'a'),
      options: [{ max: 150 }],
    },
    // A description cut at 1,536 characters: two entries of 1,537.
    { code: described(5000), filename: skillIn('cut', 'a'), options: [{ max: 3074 }] },
    // `listingMax` sets the cut: two entries of 101.
    {
      code: described(5000),
      filename: skillIn('cut', 'a'),
      options: [{ max: 202, listingMax: 100 }],
    },
    // A skill that only the user invokes is not counted. The other four skills count: 100 +
    // 1,537 for the string and for the `false`, and 1,537 for the skill that Claude cannot call.
    {
      code: described(99),
      filename: skillIn('manual', 'a'),
      options: [{ max: 4711 }],
    },
    // A skill with no frontmatter, or a block that does not parse, adds its folder name.
    { code: '# Bare\n', filename: skillIn('bare', 'a'), options: [{ max: 3 }] },
    // A command file adds its path name and its description. A `name` field is not read.
    { code: hundred, filename: skillIn('commands', 'a'), options: [{ max: 300 }] },
    // The scope is one `.claude/` directory: the nested one and the plugin do not add to it.
    { code: hundred, filename: skillIn('scopes', 'a'), options: [{ max: 100 }] },
    {
      code: hundred,
      filename: at('scopes/packages/web/.claude/skills/b/SKILL.md'),
      options: [{ max: 200 }],
    },
    { code: hundred, filename: at('scopes/plugin/skills/d/SKILL.md'), options: [{ max: 200 }] },
    // A file that is no skill or command does not add.
    { code: hundred, filename: skillIn('other', 'a'), options: [{ max: 100 }] },
    // A plugin that sets `commands` has no commands. A plugin that sets `skills`, a manifest that
    // the rule cannot read, and a plugin-root skill give no report.
    { code: hundred, filename: at('plugin-commands/skills/a/SKILL.md'), options: [{ max: 200 }] },
    { code: hundred, filename: at('plugin-skills/skills/a/SKILL.md'), options: [{ max: 1 }] },
    { code: hundred, filename: at('plugin-bad/skills/a/SKILL.md'), options: [{ max: 1 }] },
    { code: described(99), filename: at('plugin-root/SKILL.md'), options: [{ max: 1 }] },
    // A file that is no skill or command file.
    { code: described(9000), filename: 'README.md' },
    { code: described(9000), filename: 'docs/SKILL.md' },
    // The text of this file is the text in the editor: a short file in the editor.
    { code: '# Short\n', filename: skillIn('five', 'a'), options: [{ max: 6005 }] },
  ],
  invalid: [
    // Six entries of 1,501 characters are over 8,000. Each file reports, with its own share.
    { code: described(1500), filename: skillIn('six', 'a'), errors: [fallback(9006, 1501)] },
    { code: described(1500), filename: skillIn('six', 'f'), errors: [fallback(9006, 1501)] },
    // A value that equals the fallback gives the fallback message.
    {
      code: described(1500),
      filename: skillIn('six', 'a'),
      options: [{ max: 8000 }],
      errors: [fallback(9006, 1501)],
    },
    // One character over the limit.
    {
      code: hundred,
      filename: skillIn('two', 'a'),
      options: [{ max: 199 }],
      errors: [configured(200, 100, 199)],
    },
    {
      code: hundred,
      filename: skillIn('two', 'b'),
      options: [{ max: 199 }],
      errors: [configured(200, 100, 199)],
    },
    {
      code: hundred,
      filename: skillIn('two', 'a'),
      options: [{ max: 1 }],
      errors: [configured(200, 100, 1)],
    },
    // The text of this file is the text in the editor: a long file in the editor.
    {
      code: described(1500),
      filename: skillIn('five', 'a'),
      options: [{ max: 7505 - 1 }],
      errors: [configured(7505, 1501, 7504)],
    },
    {
      code: described(5000),
      filename: skillIn('six', 'a'),
      errors: [fallback(9042, 1537)],
    },
    {
      code: '# Short\n',
      filename: skillIn('five', 'a'),
      options: [{ max: 6004 }],
      errors: [configured(6005, 1, 6004)],
    },
    // The `name` field and `when_to_use` count.
    {
      code: `---\nname: longname\ndescription: ${x(42)}\n---\n`,
      filename: skillIn('named', 'a'),
      options: [{ max: 149 }],
      errors: [configured(150, 50, 149)],
    },
    {
      code: `---\ndescription: ${x(49)}\nwhen_to_use: ${x(50)}\n---\n`,
      filename: skillIn('named', 'b'),
      options: [{ max: 149 }],
      errors: [configured(150, 100, 149)],
    },
    // A field that is not text adds nothing. A name that is empty gives way to the folder.
    {
      code: '---\nname: 7\ndescription: [1, 2]\nwhen_to_use: 5\n---\n',
      filename: skillIn('fields', 'a'),
      options: [{ max: 99 }],
      errors: [configured(100, 1, 99)],
    },
    // The text of one entry is cut at 1,536: two entries of 1,537.
    {
      code: described(5000),
      filename: skillIn('cut', 'a'),
      options: [{ max: 3073 }],
      errors: [configured(3074, 1537, 3073)],
    },
    // `listingMax` sets the cut: two entries of 101.
    {
      code: described(5000),
      filename: skillIn('cut', 'a'),
      options: [{ max: 201, listingMax: 100 }],
      errors: [configured(202, 101, 201)],
    },
    // A skill that only the user invokes is not counted. The string `"true"` and `false` are not
    // the Boolean `true`, so they count.
    {
      code: described(99),
      filename: skillIn('manual', 'a'),
      options: [{ max: 4710 }],
      errors: [configured(4711, 100, 4710)],
    },
    {
      code: described(5000, 'disable-model-invocation: true\n'),
      filename: skillIn('manual', 'b'),
      options: [{ max: 4710 }],
      errors: [configured(4711, 0, 4710)],
    },
    // A file with no frontmatter or a bad block adds its folder name: 1 + 1 + 1.
    {
      code: '# Bare\n',
      filename: skillIn('bare', 'a'),
      options: [{ max: 2 }],
      errors: [configured(3, 1, 2)],
    },
    {
      code: '---\nname: [unclosed\n---\n',
      filename: skillIn('bare', 'b'),
      options: [{ max: 2 }],
      errors: [configured(3, 1, 2)],
    },
    // Commands: a skill of 100, `c` and `ns:d` of 100 each, and the skill that only the user calls.
    {
      code: hundred,
      filename: skillIn('commands', 'a'),
      options: [{ max: 299 }],
      errors: [configured(300, 100, 299)],
    },
    {
      code: `---\nname: ignored\ndescription: ${x(99)}\n---\n`,
      filename: at('commands/.claude/commands/c.md'),
      options: [{ max: 299 }],
      errors: [configured(300, 100, 299)],
    },
    {
      code: `---\ndescription: ${x(96)}\n---\n`,
      filename: at('commands/.claude/commands/ns/d.md'),
      options: [{ max: 299 }],
      errors: [configured(300, 100, 299)],
    },
    // The scope of a plugin: two skills and a command.
    {
      code: hundred,
      filename: at('plugin/skills/a/SKILL.md'),
      options: [{ max: 299 }],
      errors: [configured(300, 100, 299)],
    },
    {
      code: described(99),
      filename: at('plugin/commands/c.md'),
      options: [{ max: 299 }],
      errors: [configured(300, 100, 299)],
    },
    // A plugin that sets `commands` has its two skills only.
    {
      code: hundred,
      filename: at('plugin-commands/skills/a/SKILL.md'),
      options: [{ max: 199 }],
      errors: [configured(200, 100, 199)],
    },
    // The nested `.claude/` is a scope of its own.
    {
      code: hundred,
      filename: at('scopes/packages/web/.claude/skills/b/SKILL.md'),
      options: [{ max: 199 }],
      errors: [configured(200, 100, 199)],
    },
    // A file that is not on disk is counted once.
    {
      code: hundred,
      filename: at('two/.claude/skills/new/SKILL.md'),
      options: [{ max: 299 }],
      errors: [configured(302, 102, 299)],
    },
  ],
})

describe('the messages', () => {
  const messages = (file: string, code: string, options: unknown[] = []) =>
    lintMarkdown('skill-listing-budget', code, file, options).map((m) => m.message)

  it('names the fallback budget at the default', () => {
    expect(messages(skillIn('six', 'a'), described(1500))).toEqual([
      'The skills and commands of this scope list 9006 characters of names and descriptions, and this file adds 1501. The documented fallback budget is 8000 characters. Claude Code drops descriptions past the budget. The skills that you invoke least lose theirs first.',
    ])
  })

  it('names the configured limit at another value, and claims no fallback budget', () => {
    expect(messages(skillIn('two', 'a'), hundred, [{ max: 150 }])).toEqual([
      'The skills and commands of this scope list 200 characters of names and descriptions, and this file adds 100. The configured limit is 150 characters.',
    ])
  })
})

describe('the options', () => {
  const lint = (option: unknown) =>
    lintMarkdown('skill-listing-budget', hundred, skillIn('two', 'a'), [option])

  it.each([
    { budget: 5 },
    { Max: 5 },
    { max: '5' },
    { max: 0 },
    { max: 1.5 },
    { max: -1 },
    { listingMax: '5' },
    { listingMax: 0 },
    { listingMax: 1.5 },
  ])('refuses %j', (option) => {
    expect(() => lint(option)).toThrow('Key "claude/skill-listing-budget"')
  })

  it('sets no schema maximum, because two settings move the budget', () => {
    expect(() => lint({ max: 1_000_000, listingMax: 1_000_000 })).not.toThrow()
  })
})

// A read that fails is not a file that is not there. The rule makes no report that rests on a file
// that it cannot read.
describe.skipIf(chmodCannotBlock)('a path that the rule cannot read', () => {
  const lint = (file: string, code: string, options: unknown[] = [{ max: 150 }]) =>
    lintMarkdown('skill-listing-budget', code, file, options)

  it('makes no report when it cannot read a skill file of the scope', () => {
    hundreds('deny-skill', ['a', 'b'])
    const file = skillIn('deny-skill', 'a')
    // The first read of a file is the locked one. A file that was read once is cached.
    withoutAccess(skillIn('deny-skill', 'b'), () => expect(lint(file, hundred)).toEqual([]))
    expect(lint(file, hundred)).toHaveLength(1)
  })

  it('makes no report when it cannot read the commands directory', () => {
    hundreds('deny-commands', ['a'])
    put('deny-commands/.claude/commands/c.md', described(99))
    const file = skillIn('deny-commands', 'a')
    expect(lint(file, hundred)).toHaveLength(1)
    withoutAccess(at('deny-commands/.claude/commands'), () =>
      expect(lint(file, hundred)).toEqual([]),
    )
  })

  it('makes no report when it cannot read the manifest of a plugin', () => {
    const manifest = put('deny-manifest/.claude-plugin/plugin.json', '{"name":"p"}')
    put('deny-manifest/skills/a/SKILL.md', hundred)
    put('deny-manifest/skills/b/SKILL.md', hundred)
    const file = at('deny-manifest/skills/a/SKILL.md')
    expect(lint(file, hundred)).toHaveLength(1)
    withoutAccess(manifest, () => expect(lint(file, hundred)).toEqual([]))
    withoutAccess(path.dirname(manifest), () => expect(lint(file, hundred)).toEqual([]))
  })
})

describe.skipIf(process.platform === 'win32')('a link out of the repository', () => {
  it('makes no report when a command link leaves the repository, and reports when it does not', () => {
    mkdirSync(at('linked/repo/.git'), { recursive: true })
    put('linked/outside/c.md', described(99))
    put('linked/repo/real/c.md', described(99))
    hundreds('linked/repo', ['a', 'b'])
    const file = skillIn('linked/repo', 'a')
    const lint = () => lintMarkdown('skill-listing-budget', hundred, file, [{ max: 250 }])
    mkdirSync(at('linked/repo/.claude/commands'), { recursive: true })
    symlinkSync('../../real/c.md', at('linked/repo/.claude/commands/in.md'))
    expect(lint()).toHaveLength(1)
    symlinkSync('../../../outside/c.md', at('linked/repo/.claude/commands/out.md'))
    expect(lint()).toEqual([])
  })
})
