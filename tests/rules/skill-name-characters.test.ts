// Characters that Claude Code refuses in a skill or command name: in a skill
// folder, a command file or folder, and a frontmatter `name`. A folder in a
// plugin `skills/` directory is out of scope. The plugin cases need a real
// manifest on disk.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-name-characters-'))
const plugin = path.join(scratch, 'plugins', 'p')
mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true })
writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), '{}')

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const skillIn = (folder: string) => `.claude/skills/${folder}/SKILL.md`
const commandAt = (file: string) => `.claude/commands/${file}`
// A YAML double-quoted value. Each character outside printable ASCII gets an escape, so that each
// character can be in a `name`.
const quoted = (value: string) =>
  `"${[...value]
    .map((char) => {
      const point = char.codePointAt(0) as number
      if (point >= 0x20 && point < 0x7f) {
        return char === '"' || char === '\\' ? `\\${char}` : char
      }
      const hex = point.toString(16).toUpperCase()
      return point > 0xffff ? `\\U${hex.padStart(8, '0')}` : `\\u${hex.padStart(4, '0')}`
    })
    .join('')}"`
const named = (value: string, filename = skillIn('s')) => ({
  code: `---\nname: ${quoted(value)}\n---\n\n# S\n`,
  filename,
})

// Names for each class of the docs, the code point that the message gives, and the class
// text. The code points come from the Unicode tables, not from the rule.
const ZERO_WIDTH = 'a zero-width space'
const CONTROL = 'a control character'
const PRIVATE_USE = 'a private-use character'
const UNASSIGNED = 'an unassigned character'
const DIRECTION = 'a character that changes the text direction'
const BLANK = 'a blank that is not a plain space'
const SPACE = 'a space at the start or end, or next to another space'
const ANGLE = 'an angle bracket'
const BAD: [name: string, code: string, kind: string][] = [
  ['a​b', 'U+200B', ZERO_WIDTH],
  ['a﻿b', 'U+FEFF', ZERO_WIDTH],
  ['a\u0007b', 'U+0007', CONTROL],
  ['a\tb', 'U+0009', CONTROL],
  ['a\u007Fb', 'U+007F', CONTROL],
  // A C1 control character.
  ['a\u0085b', 'U+0085', CONTROL],
  ['ab', 'U+E000', PRIVATE_USE],
  // An icon font glyph in plane 15. The rule reads the name by code point, not by UTF-16 unit.
  ['a\u{F0000}b', 'U+F0000', PRIVATE_USE],
  ['a\u{100000}b', 'U+100000', PRIVATE_USE],
  // A noncharacter stays unassigned in each Unicode version.
  ['a﷐b', 'U+FDD0', UNASSIGNED],
  ['a\u{10FFFF}b', 'U+10FFFF', UNASSIGNED],
  // Plane 5 has no assigned character, and the code point is not a noncharacter.
  ['a\u{50000}b', 'U+50000', UNASSIGNED],
  ['a‮b', 'U+202E', DIRECTION],
  ['a‏b', 'U+200F', DIRECTION],
  ['a⁦b', 'U+2066', DIRECTION],
  ['a\u2069b', 'U+2069', DIRECTION],
  ['a\u061Cb', 'U+061C', DIRECTION],
  ['a b', 'U+00A0', BLANK],
  ['a　b', 'U+3000', BLANK],
  ['a b', 'U+2028', BLANK],
  ['a\u2029b', 'U+2029', BLANK],
  // A plain space before another blank is not the fault. The blank is.
  ['a \u00A0b', 'U+00A0', BLANK],
  ['a  b', 'U+0020', SPACE],
  [' a', 'U+0020', SPACE],
  ['a ', 'U+0020', SPACE],
  ['a<b', 'U+003C', ANGLE],
  ['a>b', 'U+003E', ANGLE],
]

// Names with no character of the classes of the rule. They hold one plain space between words, or
// letters of other scripts. Two hold a zero-width joiner in an emoji, or a zero-width non-joiner.
// The rule reports only the classes that the docs name.
const GOOD = [
  'deploy',
  'deploy app',
  'a b c',
  'café',
  '日本語',
  'a:b',
  'family-\u{1F468}\u200D\u{1F469}\u200D\u{1F467}',
  'a\u200Cb',
]

// Names at and over the limit of 256 characters. A file or folder name over 255 bytes cannot be
// on disk, so these cases use a `filename` only.
const LIMIT = 256
const long = (length: number) => 'a'.repeat(length)
const tooLong = (length: number) => ({ length: String(length), limit: String(LIMIT) })

const at = (code: string, kind: string) => ({ code, kind })

markdownTester.run('skill-name-characters', ruleOf('skill-name-characters'), {
  valid: [
    ...GOOD.map((name) => ({ code: '# S\n', filename: skillIn(name) })),
    ...GOOD.map((name) => ({ code: '# C\n', filename: commandAt(`${name}.md`) })),
    ...GOOD.map((name) => ({ code: '# C\n', filename: commandAt(`${name}/x.md`) })),
    ...GOOD.map((name) => named(name)),
    // Claude Code turns the characters into hyphens in a plugin `skills/` folder name.
    ...BAD.map(([name]) => ({
      code: '# S\n',
      filename: path.join(plugin, 'skills', name, 'SKILL.md'),
    })),
    // A command gets its name from its path, so the rule reads no `name` in a command file.
    named('a<b', commandAt('c.md')),
    named('a<b', path.join(plugin, 'commands', 'c.md')),
    // The frontmatter `name` is not a string, or the YAML does not parse.
    { code: '---\nname: [a<b]\n---\n', filename: skillIn('s') },
    { code: '---\nname: 3\n---\n', filename: skillIn('s') },
    { code: '---\nname: "a<b\n---\n', filename: skillIn('s') },
    { code: '---\ndescription: d\n---\n', filename: skillIn('s') },
    // A key that is an alias has a value but no location, as in `skill-reserved-name`.
    { code: '---\nk: &k name\n*k : a<b\n---\n', filename: skillIn('s') },
    // A name of 256 characters is at the limit. The joined command name counts the `:` too.
    named(long(LIMIT)),
    { code: '# C\n', filename: commandAt(`${long(LIMIT)}.md`) },
    { code: '# C\n', filename: commandAt(`${long(126)}/${long(129)}.md`) },
    // A code point outside the BMP is one character, so 256 of them are at the limit.
    named('\u{1F600}'.repeat(LIMIT)),
    // Claude Code changes a plugin skill folder name, so its length is not a fault. The `name` is.
    { code: '# S\n', filename: path.join(plugin, 'skills', long(LIMIT + 1), 'SKILL.md') },
    // A command file has no `name` that counts.
    named(long(LIMIT + 1), commandAt('c.md')),
    // Not a skill or command file.
    { code: '# S\n', filename: 'docs/a​b/SKILL.md' },
    { code: '# S\n', filename: 'docs/a<b.md' },
  ],
  invalid: [
    ...BAD.map(([name, code, kind]) => ({
      code: '# S\n',
      filename: skillIn(name),
      errors: [
        { messageId: 'folder' as const, data: { name, ...at(code, kind) }, line: 1, column: 1 },
      ],
    })),
    ...BAD.map(([name, code, kind]) => ({
      code: '# C\n',
      filename: commandAt(`${name}.md`),
      errors: [
        { messageId: 'command' as const, data: { name, ...at(code, kind) }, line: 1, column: 1 },
      ],
    })),
    ...BAD.map(([name, code, kind]) => ({
      code: '# C\n',
      filename: commandAt(`ops/${name}/x.md`),
      errors: [{ messageId: 'command' as const, data: { name, ...at(code, kind) } }],
    })),
    ...BAD.map(([name, code, kind]) => ({
      ...named(name),
      errors: [{ messageId: 'name' as const, data: { name, ...at(code, kind) }, line: 2 }],
    })),
    // The report on a `name` is on its value.
    {
      code: '---\nname: a<b\n---\n',
      filename: skillIn('s'),
      errors: [{ messageId: 'name', line: 2, column: 7, endLine: 2, endColumn: 10 }],
    },
    // The message gives the first character that Claude Code refuses.
    {
      code: '# S\n',
      filename: skillIn('a<​b'),
      errors: [{ messageId: 'folder', data: { name: 'a<​b', ...at('U+003C', ANGLE) } }],
    },
    // The folder and the `name` each get a report.
    {
      ...named('x>y', skillIn('a​b')),
      errors: [{ messageId: 'folder' }, { messageId: 'name' }],
    },
    // Each folder of a command path gets a report.
    {
      code: '# C\n',
      filename: commandAt('a<b/c​d.md'),
      errors: [
        { messageId: 'command', data: { name: 'a<b', ...at('U+003C', ANGLE) } },
        { messageId: 'command', data: { name: 'c​d', ...at('U+200B', ZERO_WIDTH) } },
      ],
    },
    // A name of 257 characters is over the limit.
    {
      ...named(long(LIMIT + 1)),
      errors: [{ messageId: 'nameLength', data: tooLong(LIMIT + 1), line: 2, column: 7 }],
    },
    {
      code: '# C\n',
      filename: commandAt(`${long(LIMIT + 1)}.md`),
      errors: [{ messageId: 'commandLength', data: tooLong(LIMIT + 1), line: 1, column: 1 }],
    },
    // The joined name `a:b` counts, not each part: both parts fit, the joined name does not.
    {
      code: '# C\n',
      filename: commandAt(`${long(128)}/${long(128)}.md`),
      errors: [{ messageId: 'commandLength', data: tooLong(257) }],
    },
    {
      code: '# C\n',
      filename: commandAt(`${long(100)}/${long(100)}/${long(55)}.md`),
      errors: [{ messageId: 'commandLength', data: tooLong(257) }],
    },
    // A name over the limit that is counted by code point, not by UTF-16 unit.
    {
      ...named('\u{1F600}'.repeat(LIMIT + 1)),
      errors: [{ messageId: 'nameLength', data: tooLong(LIMIT + 1) }],
    },
    // A plugin command and a plugin skill `name` are not exempt.
    {
      code: '# C\n',
      filename: path.join(plugin, 'commands', `${long(LIMIT + 1)}.md`),
      errors: [{ messageId: 'commandLength', data: tooLong(LIMIT + 1) }],
    },
    {
      ...named(long(LIMIT + 1), path.join(plugin, 'skills', 's', 'SKILL.md')),
      errors: [{ messageId: 'nameLength', data: tooLong(LIMIT + 1) }],
    },
    // A name with a refused character and over the limit gets two reports.
    {
      ...named(`<${long(LIMIT)}`),
      errors: [
        { messageId: 'name', data: { name: `<${long(LIMIT)}`, ...at('U+003C', ANGLE) } },
        { messageId: 'nameLength', data: tooLong(LIMIT + 1) },
      ],
    },
    // A plugin command file and a plugin skill `name` are not exempt.
    {
      code: '# C\n',
      filename: path.join(plugin, 'commands', 'a  b.md'),
      errors: [{ messageId: 'command', data: { name: 'a  b', ...at('U+0020', SPACE) } }],
    },
    {
      ...named('a<b', path.join(plugin, 'skills', 's', 'SKILL.md')),
      errors: [{ messageId: 'name', data: { name: 'a<b', ...at('U+003C', ANGLE) } }],
    },
    // The plugin-root skill has no folder name, but its `name` counts.
    {
      ...named('a​b', path.join(plugin, 'SKILL.md')),
      errors: [{ messageId: 'name', data: { name: 'a​b', ...at('U+200B', ZERO_WIDTH) } }],
    },
  ],
})
