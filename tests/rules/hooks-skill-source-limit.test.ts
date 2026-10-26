// The expected values are written by hand from the hooks reference, "Limits on skill hooks"
// (https://code.claude.com/docs/en/hooks#limits-on-skill-hooks). Each source of skills has its own
// limit. The skills of one source can register at most 1,024 hooks. Their matchers can total at
// most 16,384 characters. A matcher with several hooks under it counts once for each hook. A skill
// past a limit registers none of its frontmatter hooks. The trees are built in a temporary
// directory, one tree for each case.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, expect, it } from 'vitest'
import {
  chmodCannotBlock,
  lintMarkdown,
  markdownTester,
  ruleOf,
  withoutAccess,
} from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'hooks-skill-source-limit-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

/** Write `text` to `file` below the scratch directory. Returns the path. */
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}
const at = (file: string) => path.join(scratch, file)

/** A flow list of `count` command hooks. */
const handlers = (count: number) =>
  Array.from({ length: count }, () => '{type: command, command: "true"}').join(', ')

/** A skill file with one `PreToolUse` group: `count` hooks under a matcher of `chars`
 *  characters. A `chars` of -1 gives a group with no matcher. */
const skill = (count: number, chars = -1) => {
  const matcher = chars < 0 ? '' : `matcher: "${'x'.repeat(chars)}", `
  return `---\nhooks: {PreToolUse: [{${matcher}hooks: [${handlers(count)}]}]}\n---\n`
}

// 1,000 and 25 hooks: 1,025 in the source. A third skill declares no hooks.
put('over/.claude/skills/a/SKILL.md', skill(1000))
put('over/.claude/skills/b/SKILL.md', skill(25))
put('over/.claude/skills/c/SKILL.md', '---\nname: c\n---\n')
// 1,000 and 24 hooks: 1,024, at the limit.
put('at/.claude/skills/a/SKILL.md', skill(1000))
put('at/.claude/skills/b/SKILL.md', skill(24))
// One hook each, under matchers of 8,192 and 8,193 characters: 16,385 characters.
put('chars/.claude/skills/a/SKILL.md', skill(1, 8192))
put('chars/.claude/skills/b/SKILL.md', skill(1, 8193))
// The same, at 16,384 characters.
put('chars-at/.claude/skills/a/SKILL.md', skill(1, 8192))
put('chars-at/.claude/skills/b/SKILL.md', skill(1, 8192))
// One skill: five hooks under one matcher of 3,277 characters count 16,385 characters.
put('per-hook/.claude/skills/a/SKILL.md', skill(5, 3277))
// Each source is under the limit, and the sum is over it: the project `.claude/`, a nested
// `.claude/` and a plugin.
put('split/.claude/skills/a/SKILL.md', skill(1000))
put('split/packages/web/.claude/skills/b/SKILL.md', skill(25))
put('split/plugin/.claude-plugin/plugin.json', '{"name":"p"}')
put('split/plugin/skills/c/SKILL.md', skill(25))
// A plugin source: 1,000 and 25 hooks.
put('plugin/.claude-plugin/plugin.json', '{"name":"p"}')
put('plugin/skills/a/SKILL.md', skill(1000))
put('plugin/skills/b/SKILL.md', skill(25))
// A plugin-root skill. It loads only when the plugin has no `skills/` directory.
put('root/.claude-plugin/plugin.json', '{"name":"p"}')
put('root/SKILL.md', skill(1025))
// A skill on disk whose frontmatter does not parse registers no hooks.
put('bad/.claude/skills/a/SKILL.md', skill(1000))
put('bad/.claude/skills/b/SKILL.md', `---\nhooks: [unclosed\n${skill(25).slice(4)}`)
// A skill that the rule cannot read adds no hooks: 1,000 and 25 of the 1,050.
put('locked/.claude/skills/a/SKILL.md', skill(1000))
put('locked/.claude/skills/b/SKILL.md', skill(25))
put('locked/.claude/skills/c/SKILL.md', skill(25))
// Hooks of the wrong shape: a handler that is no object, and a group with no `hooks` array.
put(
  'shape/.claude/skills/a/SKILL.md',
  `---\nhooks: {Stop: [{hooks: [1, "x"]}, {matcher: "${'x'.repeat(20000)}"}]}\n---\n`,
)
put('shape/.claude/skills/b/SKILL.md', skill(1024))

/** The location of the `hooks` key on line 2. */
const key = { line: 2, column: 1, endLine: 2, endColumn: 6 }
const hooksError = (total: number, own: number) => ({
  messageId: 'hooks',
  data: { total: String(total), own: String(own) },
  ...key,
})
const matchersError = (total: number, own: number) => ({
  messageId: 'matchers',
  data: { total: String(total), own: String(own) },
  ...key,
})

markdownTester.run('hooks-skill-source-limit', ruleOf('hooks-skill-source-limit'), {
  valid: [
    // 1,024 hooks, at the limit.
    { code: skill(1000), filename: at('at/.claude/skills/a/SKILL.md') },
    { code: skill(24), filename: at('at/.claude/skills/b/SKILL.md') },
    // 16,384 matcher characters, at the limit.
    { code: skill(1, 8192), filename: at('chars-at/.claude/skills/a/SKILL.md') },
    // Four hooks under one matcher of 4,096 characters: 16,384.
    { code: skill(4, 4096), filename: at('per-hook/.claude/skills/a/SKILL.md') },
    // A skill with no hooks in a source past the limit loses no hooks.
    { code: '---\nname: c\n---\n', filename: at('over/.claude/skills/c/SKILL.md') },
    { code: '# No frontmatter\n', filename: at('over/.claude/skills/c/SKILL.md') },
    // Frontmatter that does not parse gives a skill with no hooks.
    { code: '---\nhooks: [unclosed\n---\n', filename: at('over/.claude/skills/b/SKILL.md') },
    // Each source is under the limit. Their sum is over it.
    { code: skill(1000), filename: at('split/.claude/skills/a/SKILL.md') },
    { code: skill(25), filename: at('split/packages/web/.claude/skills/b/SKILL.md') },
    { code: skill(25), filename: at('split/plugin/skills/c/SKILL.md') },
    // A skill on disk with frontmatter that does not parse adds no hooks.
    { code: skill(1000), filename: at('bad/.claude/skills/a/SKILL.md') },
    // Hooks of the wrong shape count no hook and no matcher characters.
    { code: skill(1024), filename: at('shape/.claude/skills/b/SKILL.md') },
    // The plugin-root skill, and files that are no skill.
    { code: skill(1025), filename: at('root/SKILL.md') },
    { code: skill(1025), filename: 'README.md' },
    { code: skill(1025), filename: 'docs/SKILL.md' },
    { code: skill(1025), filename: at('over/.claude/commands/c.md') },
    // The text of this file is the text in the editor: 24 hooks in the editor, 25 on disk.
    { code: skill(24), filename: at('over/.claude/skills/b/SKILL.md') },
  ],
  invalid: [
    // 1,025 hooks: one over the limit. Each skill of the source with a hook reports.
    {
      code: skill(25),
      filename: at('over/.claude/skills/b/SKILL.md'),
      errors: [hooksError(1025, 25)],
    },
    {
      code: skill(1000),
      filename: at('over/.claude/skills/a/SKILL.md'),
      errors: [hooksError(1025, 1000)],
    },
    // 16,385 matcher characters: one over the limit.
    {
      code: skill(1, 8193),
      filename: at('chars/.claude/skills/b/SKILL.md'),
      errors: [matchersError(16385, 8193)],
    },
    {
      code: skill(1, 8192),
      filename: at('chars/.claude/skills/a/SKILL.md'),
      errors: [matchersError(16385, 8192)],
    },
    // One matcher counts once for each of its five hooks.
    {
      code: skill(5, 3277),
      filename: at('per-hook/.claude/skills/a/SKILL.md'),
      errors: [matchersError(16385, 16385)],
    },
    // A plugin is one source.
    {
      code: skill(25),
      filename: at('plugin/skills/b/SKILL.md'),
      errors: [hooksError(1025, 25)],
    },
    // Past both limits: 1,025 hooks under a matcher of 16 characters make 16,400.
    {
      code: skill(1025, 16),
      filename: at('per-hook/.claude/skills/a/SKILL.md'),
      errors: [hooksError(1025, 1025), matchersError(16400, 16400)],
    },
    // The text of this file is the text in the editor: 25 hooks in the editor, 24 on disk.
    {
      code: skill(25),
      filename: at('at/.claude/skills/b/SKILL.md'),
      errors: [hooksError(1025, 25)],
    },
    // The groups of two events add up: 24 hooks and one under the matcher `Bash`.
    {
      code: `---\nhooks:\n  Stop: [{hooks: [${handlers(24)}]}]\n  PreToolUse: [{matcher: Bash, hooks: [{type: command, command: "true"}]}]\n---\n`,
      filename: at('at/.claude/skills/b/SKILL.md'),
      errors: [hooksError(1025, 25)],
    },
    // A `hooks` key that is an alias reports on the frontmatter block.
    {
      code: `---\nname: &k hooks\n*k : ${skill(25).slice(11)}`,
      filename: at('over/.claude/skills/b/SKILL.md'),
      errors: [{ messageId: 'hooks', line: 1, column: 1, endLine: 4, endColumn: 4 }],
    },
  ],
})

it.skipIf(chmodCannotBlock)('adds no hooks for a skill that it cannot read', () => {
  const file = at('locked/.claude/skills/a/SKILL.md')
  const messages = withoutAccess(at('locked/.claude/skills/b/SKILL.md'), () =>
    lintMarkdown('hooks-skill-source-limit', skill(1000), file),
  )
  expect(messages.map(({ message }) => message)).toEqual([
    'The skills of this source declare 1025 hooks, and this skill declares 1000. A source can register at most 1,024. A skill past the limit registers none of its hooks, and Claude Code shows no error.',
  ])
})
