// Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the Markdown body
// of a plugin skill. The Bash tool does not have the variables in its environment. So an unbraced
// `$CLAUDE_PLUGIN_ROOT` stays text and gives an empty path in a shell. A `${CLAUDE_SKILL_DIR}/..`
// path depends on the plugin layout. The braced form in a non-plugin skill is the business of
// `skill-plugin-vars-outside-plugin`.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

// The variables, escaped so that the template literal keeps them as text.
const root = `\${CLAUDE_PLUGIN_ROOT}`
const data = `\${CLAUDE_PLUGIN_DATA}`
const skillDir = `\${CLAUDE_SKILL_DIR}`
const projectDir = `\${CLAUDE_PROJECT_DIR}`

const error = (
  messageId: 'unbraced' | 'climb',
  found: string,
  line: number,
  column: number,
  extra: object = {},
) => ({
  messageId,
  data: { found, ...extra },
  line,
  column,
  endLine: line,
  endColumn: column + found.length,
})
const unbraced = (found: string, line: number, column: number) =>
  error('unbraced', found, line, column, { braced: `\${${found.slice(1)}}` })
const climb = (found: string, line: number, column: number) =>
  error('climb', found, line, column, { root })

const plain = '.claude/skills/s/SKILL.md'

markdownTester.run('skill-plugin-path-vars', ruleOf('skill-plugin-path-vars'), {
  valid: [
    // The braced form, which Claude Code substitutes.
    { code: `Run ${root}/run.sh\n`, filename: pluginSkill() },
    { code: `Write to ${data}/cache\n`, filename: pluginSkill() },
    { code: `Run "${root}"/run.sh\n`, filename: pluginSkill() },
    // The other variables are right for a path in the skill or the project.
    { code: `Run ${skillDir}/scripts/run.sh\n`, filename: pluginSkill() },
    { code: `Run ${projectDir}/scripts/run.sh\n`, filename: pluginSkill() },
    // A name that only starts like a plugin variable.
    { code: 'Set $CLAUDE_PLUGIN_ROOT_X and $CLAUDE_PLUGIN_DATAS here\n', filename: pluginSkill() },
    { code: 'Set $CLAUDE_PLUGIN_OPTION_KEY here\n', filename: pluginSkill() },
    // A name inside the skill directory that begins with two dots.
    { code: `Read ${skillDir}/..hidden/notes.md\n`, filename: pluginSkill() },
    { code: `Read ${skillDir}/.../notes.md\n`, filename: pluginSkill() },
    { code: `Read ${skillDir}/..-x\n`, filename: pluginSkill() },
    { code: `Read ${skillDir}/.hidden/notes.md\n`, filename: pluginSkill() },
    // The frontmatter is not the body.
    { code: '---\ndescription: Use $CLAUDE_PLUGIN_ROOT\n---\n\nBody.\n', filename: pluginSkill() },
    // A skill that is not in a plugin, a command file, and a file that is no skill file.
    { code: 'Run $CLAUDE_PLUGIN_ROOT/run.sh\n', filename: plain },
    { code: `Run ${skillDir}/../run.sh\n`, filename: plain },
    { code: 'Run $CLAUDE_PLUGIN_ROOT/run.sh\n', filename: pluginCommand() },
    { code: 'Run $CLAUDE_PLUGIN_ROOT/run.sh\n', filename: '.claude/commands/c.md' },
    { code: 'Run $CLAUDE_PLUGIN_ROOT/run.sh\n', filename: 'README.md' },
  ],
  invalid: [
    {
      code: 'Run $CLAUDE_PLUGIN_ROOT/run.sh\n',
      filename: pluginSkill(),
      errors: [unbraced('$CLAUDE_PLUGIN_ROOT', 1, 5)],
    },
    {
      code: 'Write to $CLAUDE_PLUGIN_DATA/cache\n',
      filename: pluginSkill(),
      errors: [unbraced('$CLAUDE_PLUGIN_DATA', 1, 10)],
    },
    // In a command of the shell, in fenced code, and at the end of the file.
    {
      code: 'Run:\n\n```bash\nbash "$CLAUDE_PLUGIN_ROOT/run.sh"\n```\n',
      filename: pluginSkill(),
      errors: [unbraced('$CLAUDE_PLUGIN_ROOT', 4, 7)],
    },
    {
      code: 'Path: $CLAUDE_PLUGIN_ROOT',
      filename: pluginSkill(),
      errors: [unbraced('$CLAUDE_PLUGIN_ROOT', 1, 7)],
    },
    // One report for each use.
    {
      code: 'Run $CLAUDE_PLUGIN_ROOT/a.sh then $CLAUDE_PLUGIN_DATA/b\n',
      filename: pluginSkill(),
      errors: [unbraced('$CLAUDE_PLUGIN_ROOT', 1, 5), unbraced('$CLAUDE_PLUGIN_DATA', 1, 35)],
    },
    // The braced form in the same file does not hide the unbraced one.
    {
      code: `Run ${root}/a.sh and $CLAUDE_PLUGIN_ROOT/b.sh\n`,
      filename: pluginSkill(),
      errors: [unbraced('$CLAUDE_PLUGIN_ROOT', 1, 36)],
    },
    // A path that climbs out of the skill directory.
    {
      code: `Run ${skillDir}/../shared/run.sh\n`,
      filename: pluginSkill(),
      errors: [climb(`${skillDir}/..`, 1, 5)],
    },
    {
      code: `Run ${skillDir}/../../run.sh\n`,
      filename: pluginSkill(),
      errors: [climb(`${skillDir}/..`, 1, 5)],
    },
    {
      code: `Run "${skillDir}/.."\n`,
      filename: pluginSkill(),
      errors: [climb(`${skillDir}/..`, 1, 6)],
    },
    {
      code: `Run ${skillDir}/..`,
      filename: pluginSkill(),
      errors: [climb(`${skillDir}/..`, 1, 5)],
    },
    // The body of a skill with a bad block still reports.
    {
      code: '---\nname: [unclosed\n---\n\nRun $CLAUDE_PLUGIN_ROOT/run.sh\n',
      filename: pluginSkill(),
      errors: [unbraced('$CLAUDE_PLUGIN_ROOT', 5, 5)],
    },
    {
      code: '---\ndescription: d\n---\n\nRun $CLAUDE_PLUGIN_ROOT/run.sh\n',
      filename: pluginSkill(),
      errors: [unbraced('$CLAUDE_PLUGIN_ROOT', 5, 5)],
    },
    // Both faults in one file report in the order of the file.
    {
      code: `Run ${skillDir}/../a.sh\nRun $CLAUDE_PLUGIN_ROOT/b.sh\n`,
      filename: pluginSkill(),
      errors: [climb(`${skillDir}/..`, 1, 5), unbraced('$CLAUDE_PLUGIN_ROOT', 2, 5)],
    },
  ],
})

describe('the messages', () => {
  const messages = (code: string) =>
    lintMarkdown('skill-plugin-path-vars', code, pluginSkill()).map((m) => m.message)

  it('names the unbraced variable and the braced form', () => {
    expect(messages('Run $CLAUDE_PLUGIN_ROOT/run.sh\n')).toEqual([
      `\`$CLAUDE_PLUGIN_ROOT\` is not substituted, and the Bash tool does not have it in its environment. Write \`${root}\` in the Markdown body.`,
    ])
  })

  it('names the climb and the plugin root', () => {
    expect(messages(`Run ${skillDir}/../run.sh\n`)).toEqual([
      `A path that climbs out of the skill directory with \`${skillDir}/..\` depends on the plugin layout. Write \`${root}/<path>\` for a file elsewhere in the plugin.`,
    ])
  })
})

// A plugin root that is a link out of the repository gives no report.
describe.skipIf(process.platform === 'win32')('a plugin root that the rule cannot see', () => {
  it('makes no report for a link out of the repository, and reports for a real root', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'skill-plugin-path-vars-'))
    try {
      mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
      mkdirSync(path.join(scratch, 'repo', 'real', '.claude-plugin'), { recursive: true })
      mkdirSync(path.join(scratch, 'outside', '.claude-plugin'), { recursive: true })
      writeFileSync(path.join(scratch, 'repo', 'real', '.claude-plugin', 'plugin.json'), '{}')
      writeFileSync(path.join(scratch, 'outside', '.claude-plugin', 'plugin.json'), '{}')
      symlinkSync('../outside', path.join(scratch, 'repo', 'plug'))
      const lint = (dir: string) =>
        lintMarkdown(
          'skill-plugin-path-vars',
          'Run $CLAUDE_PLUGIN_ROOT/run.sh\n',
          path.join(scratch, 'repo', dir, 'SKILL.md'),
        )
      expect(lint('plug')).toEqual([])
      expect(lint('real')).toHaveLength(1)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
