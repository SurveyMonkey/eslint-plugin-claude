// A skill or command file that starts with a byte order mark. ESLint removes the mark
// before the rule sees the text, so the rule reads the file on disk. Each case writes its
// file to a temporary directory. The `code` of a case has no mark, as ESLint gives it.
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

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-no-bom-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string | Buffer) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}

const BOM = '\u{feff}'
const body = '---\nname: s\ndescription: d\n---\n\n# S\n'
const code = body
const NO_LINKS = process.platform === 'win32'

const withBom = put('bom/.claude/skills/s/SKILL.md', BOM + body)
const without = put('plain/.claude/skills/s/SKILL.md', body)
const command = put('bom/.claude/commands/c.md', `${BOM}# C\n`)
const commandPlain = put('plain/.claude/commands/c.md', '# C\n')
const decoy = put('bom/docs/SKILL.md', BOM + body)
// A plugin skill and a plugin-root skill.
put('plug/.claude-plugin/plugin.json', '{}')
const pluginSkill = put('plug/skills/s/SKILL.md', BOM + body)
const pluginRoot = put('plug/SKILL.md', BOM + body)
// Files that are too short to hold a mark, and one that holds only the mark.
const empty = put('short/.claude/skills/empty/SKILL.md', '')
const oneByte = put('short/.claude/skills/one/SKILL.md', 'a')
const twoBytes = put('short/.claude/skills/two/SKILL.md', Buffer.from([0xef, 0xbb]))
const onlyBom = put('short/.claude/skills/only/SKILL.md', BOM)
// A mark that is not the first character.
const later = put('later/.claude/skills/s/SKILL.md', `# S\n${BOM}\n`)
const notMark = put('latin/.claude/skills/s/SKILL.md', Buffer.from([0xef, 0xbb, 0xbe, 0x0a]))

const error = (extra: object = {}) => ({
  messageId: 'bom' as const,
  line: 1,
  column: 1,
  ...extra,
})

markdownTester.run('skill-no-bom', ruleOf('skill-no-bom'), {
  valid: [
    { code, filename: without },
    { code: '# C\n', filename: commandPlain },
    // A file that Claude Code reads without the mark is the target of the option.
    { code, filename: withBom, options: [{ minVersion: '2.1.239' }] },
    { code, filename: withBom, options: [{ minVersion: '2.2.0' }] },
    { code, filename: withBom, options: [{ minVersion: '3.0.0' }] },
    // Not a skill or command file.
    { code, filename: decoy },
    // A file that is not on disk, as in a lint of text from an editor.
    { code, filename: path.join(scratch, 'absent/.claude/skills/s/SKILL.md') },
    { code, filename: empty },
    { code, filename: oneByte },
    { code, filename: twoBytes },
    // Three bytes that are not the mark.
    { code, filename: notMark },
    { code, filename: later },
  ],
  invalid: [
    { code, filename: withBom, errors: [error({ endLine: 1, endColumn: 1 })] },
    { code: '# C\n', filename: command, errors: [error()] },
    { code, filename: pluginSkill, errors: [error()] },
    { code, filename: pluginRoot, errors: [error()] },
    { code: '', filename: onlyBom, errors: [error()] },
    // A repository that supports a version before the fix.
    { code, filename: withBom, options: [{ minVersion: '2.1.238' }], errors: [error()] },
    { code, filename: withBom, options: [{ minVersion: '2.0.0' }], errors: [error()] },
    { code, filename: withBom, options: [{}], errors: [error()] },
  ],
})

describe('a file that the rule must not read', () => {
  const ids = (file: string) =>
    lintMarkdown('skill-no-bom', code, file).map((m) => m.messageId ?? m.message)

  it('reads a file with the mark, as the control for the cases below', () => {
    expect(ids(withBom)).toEqual(['bom'])
  })

  it.skipIf(NO_LINKS)('skips a link to a file out of the repository', () => {
    const outside = put('outside/SKILL.md', BOM + body)
    const link = path.join(scratch, 'link/.claude/skills/s/SKILL.md')
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(outside, link)
    expect(ids(link)).toEqual([])
  })

  it.skipIf(NO_LINKS)('follows a link inside the repository', () => {
    const inside = put('inner/.claude/skills/real/SKILL.md', BOM + body)
    const link = path.join(scratch, 'inner/.claude/skills/s/SKILL.md')
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(inside, link)
    expect(ids(link)).toEqual(['bom'])
  })

  it.skipIf(NO_LINKS)('skips a dangling link', () => {
    const link = path.join(scratch, 'dead/.claude/skills/s/SKILL.md')
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync('missing.md', link)
    expect(ids(link)).toEqual([])
  })

  it.skipIf(NO_LINKS)('skips a link that points to itself', () => {
    const link = path.join(scratch, 'loop/.claude/skills/s/SKILL.md')
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync('SKILL.md', link)
    expect(ids(link)).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('skips a file with no read access', () => {
    const file = put('locked/.claude/skills/s/SKILL.md', BOM + body)
    withoutAccess(file, () => expect(ids(file)).toEqual([]))
  })
})
