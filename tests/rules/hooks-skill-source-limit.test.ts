// The expected values are written by hand from the hooks reference, "Limits on skill hooks"
// (https://code.claude.com/docs/en/hooks#limits-on-skill-hooks). Each source of skills has its own
// limit. The skills of one source can register at most 1,024 hooks. Their matchers can total at
// most 16,384 characters. A matcher with several hooks under it counts once for each hook. A skill
// past a limit registers none of its frontmatter hooks. The trees are built in a temporary
// directory, one tree for each case.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'hooks-skill-source-limit-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

/** Write `text` to `file` below the scratch directory. Returns the path. */
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}
const at = (file: string) => path.join(scratch, file)

/** A skill file with one `PreToolUse` group: `count` hooks under a matcher of `chars`
 *  characters. A `chars` of -1 gives a group with no matcher. */
const skill = (count: number, chars = -1) => {
  const matcher = chars < 0 ? '' : `matcher: "${'x'.repeat(chars)}", `
  const hooks = Array.from({ length: count }, () => '{type: command, command: "true"}').join(', ')
  return `---\nhooks: {PreToolUse: [{${matcher}hooks: [${hooks}]}]}\n---\n`
}

// 1,000 and 25 hooks: 1,025 in the source.
put('over/.claude/skills/a/SKILL.md', skill(1000))
put('over/.claude/skills/b/SKILL.md', skill(25))

const hooksError = (total: number, own: number) => ({
  messageId: 'hooks',
  data: { total: String(total), own: String(own) },
  line: 2,
  column: 1,
  endLine: 2,
  endColumn: 6,
})

markdownTester.run('hooks-skill-source-limit', ruleOf('hooks-skill-source-limit'), {
  valid: [],
  invalid: [
    // 1,025 hooks: one over the limit. Each skill of the source reports.
    {
      code: skill(25),
      filename: at('over/.claude/skills/b/SKILL.md'),
      errors: [hooksError(1025, 25)],
    },
  ],
})
