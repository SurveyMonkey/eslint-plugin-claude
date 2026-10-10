// A skill whose `allowed-tools` or injected commands have a side effect, such as `git push`, sets
// `disable-model-invocation: true`. The rule reads the Bash rules of `allowed-tools` and the
// injected commands in the inline form and in a fence with the info string `!`. It reads the
// commands as text, and it skips the commands that only print or read.
import { describe, expect, it } from 'vitest'
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const tick = '`'

/** The inline form of a command. */
const inline = (text: string) => `!${tick}${text}${tick}`
/** The block form of a command. */
const block = (text: string) => `${tick.repeat(3)}!\n${text}\n${tick.repeat(3)}`
/** A file with the frontmatter lines `lines` and the body `body`. */
const withFields = (lines: string, body = 'Do the work.') => `---\n${lines}\n---\n\n${body}\n`

const found = (text: string, line?: number, column?: number) => ({
  messageId: 'sideEffect' as const,
  data: { found: text },
  ...(line === undefined ? {} : { line }),
  ...(column === undefined ? {} : { column }),
})

markdownTester.run('skill-side-effects-manual-only', ruleOf('skill-side-effects-manual-only'), {
  valid: [
    // A skill that only the user can invoke may have side effects.
    {
      code: withFields('disable-model-invocation: true\nallowed-tools: Bash(git push *)'),
      filename: skill,
    },
    {
      code: withFields('disable-model-invocation: true', inline('git push origin main')),
      filename: skill,
    },
    { code: withFields('disable-model-invocation: yes', inline('git push')), filename: skill },
    { code: withFields('disable-model-invocation: true', inline('git push')), filename: command },
    // Adding `disable-model-invocation` to a skill that only Claude can invoke would make it
    // unreachable, so the rule skips it.
    { code: withFields('user-invocable: false', inline('git push')), filename: skill },
    // A rule of `allowed-tools` that is no side effect, or that names no command.
    { code: withFields('allowed-tools: Bash(git *)'), filename: skill },
    { code: withFields('allowed-tools: Bash(git status) Bash(git diff *)'), filename: skill },
    { code: withFields('allowed-tools: Bash'), filename: skill },
    { code: withFields('allowed-tools: Bash(*)'), filename: skill },
    { code: withFields('allowed-tools: Bash(npm test)'), filename: skill },
    { code: withFields('allowed-tools: Read Edit'), filename: skill },
    // The words must be next to each other, in order.
    { code: withFields('allowed-tools: Bash(git status push)'), filename: skill },
    { code: withFields('allowed-tools: Bash(push git)'), filename: skill },
    // The pattern is a word. A longer word does not hold it.
    { code: withFields('allowed-tools: Bash(deploy-status)'), filename: skill },
    { code: withFields('allowed-tools: Bash(deployment *)'), filename: skill },
    // A rule that is no `allow` rule, and a tool other than Bash.
    { code: withFields('disallowed-tools: Bash(git push *)'), filename: skill },
    { code: withFields('allowed-tools: Read(git push)'), filename: skill },
    // A rule that does not parse is for `permissions-rule-syntax`.
    { code: withFields('allowed-tools: Bash(git push'), filename: skill },
    // Injected commands that have no side effect.
    { code: withFields('description: d', inline('git status --short')), filename: skill },
    { code: withFields('description: d', inline('git log --grep commit')), filename: skill },
    { code: withFields('description: d', inline('npm test')), filename: skill },
    // A command that only prints or reads has the words but no effect.
    { code: withFields('description: d', inline('echo git push')), filename: skill },
    { code: withFields('description: d', inline('grep deploy notes.md')), filename: skill },
    { code: withFields('description: d', inline('cat deploy.sh')), filename: skill },
    { code: withFields('description: d', inline('ls deploy')), filename: skill },
    // A quoted string is text.
    {
      code: withFields('description: d', inline('gh issue comment 1 -b "please deploy"')),
      filename: skill,
    },
    { code: withFields('description: d', inline("echo 'git push' | wc -l")), filename: skill },
    // A comment line of a block is not a command.
    { code: withFields('description: d', block('# git push\nnpm test')), filename: skill },
    // Prose and a code span that follow no `!` are not injected commands.
    { code: withFields('description: d', 'Run git push when done.'), filename: skill },
    {
      code: withFields('description: d', `Run ${tick}git push${tick} when done.`),
      filename: skill,
    },
    {
      code: withFields('description: d', `Run !${tick}echo hi${tick} and ${tick}git push${tick}.`),
      filename: skill,
    },
    {
      code: withFields('description: d', `${tick.repeat(3)}sh\ngit push\n${tick.repeat(3)}`),
      filename: skill,
    },
    // No frontmatter, and nothing to find.
    { code: 'Run the tests.\n', filename: skill },
    // A block that does not parse hides the fields, so the rule reports nothing.
    { code: '---\nallowed-tools: [Bash(git push *)\n---\n', filename: skill },
    // A pattern that the option adds does not apply until the option sets it.
    { code: withFields('allowed-tools: Bash(terraform apply *)'), filename: skill },
    // Not a skill or command file.
    { code: withFields('allowed-tools: Bash(git push *)'), filename: 'docs/SKILL.md' },
    { code: withFields('allowed-tools: Bash(git push *)'), filename: '.claude/agents/a.md' },
    // The option adds to the patterns. It does not replace them.
    {
      code: withFields('allowed-tools: Bash(git status)'),
      filename: skill,
      options: [{ patterns: ['terraform apply'] }],
    },
    // A plugin skill and a plugin command, with no side effect.
    { code: withFields('allowed-tools: Bash(npm test)'), filename: pluginSkill() },
    { code: withFields('allowed-tools: Bash(npm test)'), filename: pluginCommand() },
  ],
  invalid: [
    // A project skill, a command file, a plugin skill and a plugin command.
    {
      code: withFields('allowed-tools: Bash(git push *)'),
      filename: skill,
      errors: [found('git push', 2, 16)],
    },
    {
      code: withFields('allowed-tools: Bash(git push *)'),
      filename: command,
      errors: [found('git push')],
    },
    {
      code: withFields('allowed-tools: Bash(git push *)'),
      filename: pluginSkill(),
      errors: [found('git push')],
    },
    {
      code: withFields('allowed-tools: Bash(git push *)'),
      filename: pluginCommand(),
      errors: [found('git push')],
    },
    // The forms of a rule: a list, a comma, the legacy `:*` and the bare command.
    {
      code: withFields('allowed-tools:\n  - Read\n  - Bash(git push *)'),
      filename: skill,
      errors: [found('git push', 4, 5)],
    },
    {
      code: withFields('allowed-tools: Read, Bash(git push:*)'),
      filename: skill,
      errors: [found('git push')],
    },
    {
      code: withFields('allowed-tools: Bash(git push)'),
      filename: skill,
      errors: [found('git push')],
    },
    // Each default pattern.
    {
      code: withFields('allowed-tools: Bash(git commit -m *)'),
      filename: skill,
      errors: [found('git commit')],
    },
    {
      code: withFields('allowed-tools: Bash(npm run deploy)'),
      filename: skill,
      errors: [found('deploy')],
    },
    {
      code: withFields('allowed-tools: Bash(./scripts/deploy.sh *)'),
      filename: skill,
      errors: [found('deploy')],
    },
    {
      code: withFields('allowed-tools: Bash(slack send_message *)'),
      filename: skill,
      errors: [found('send message')],
    },
    // The match ignores letter case.
    {
      code: withFields('allowed-tools: Bash(GIT PUSH *)'),
      filename: skill,
      errors: [found('git push')],
    },
    // The injected commands, in the inline form and in a block.
    {
      code: withFields('description: d', inline('git push origin main')),
      filename: skill,
      errors: [found('git push', 5, 2)],
    },
    {
      code: withFields('description: d', block('npm test\ngit commit -am wip')),
      filename: skill,
      errors: [found('git commit', 5, 1)],
    },
    {
      code: inline('make deploy'),
      filename: command,
      errors: [found('deploy', 1, 2)],
    },
    // A compound command, a wrapper and a variable at the start.
    {
      code: withFields('description: d', inline('npm test && git push')),
      filename: skill,
      errors: [found('git push')],
    },
    {
      code: withFields('description: d', inline('timeout 5 git push')),
      filename: skill,
      errors: [found('git push')],
    },
    {
      code: withFields('description: d', inline('GIT_SSH=ssh git push')),
      filename: skill,
      errors: [found('git push')],
    },
    {
      code: withFields('description: d', block('if [ -f x ]; then git push; fi')),
      filename: skill,
      errors: [found('git push')],
    },
    // A skill that sets the fields but not to the exempt value.
    {
      code: withFields('disable-model-invocation: false', inline('git push')),
      filename: skill,
      errors: [found('git push')],
    },
    {
      code: withFields('user-invocable: true', inline('git push')),
      filename: skill,
      errors: [found('git push')],
    },
    // One report for a file. The first evidence in file order is `allowed-tools`.
    {
      code: withFields('allowed-tools: Bash(git push *) Bash(deploy *)', inline('git commit')),
      filename: skill,
      errors: [found('git push', 2, 16)],
    },
    {
      code: withFields(
        'allowed-tools: Bash(git status)',
        `${inline('git push')}\n${inline('deploy')}`,
      ),
      filename: skill,
      errors: [found('git push', 5, 2)],
    },
    // The option adds a pattern. The defaults stay.
    {
      code: withFields('allowed-tools: Bash(terraform apply *)'),
      filename: skill,
      options: [{ patterns: ['terraform apply'] }],
      errors: [found('terraform apply')],
    },
    {
      code: withFields('allowed-tools: Bash(git push *)'),
      filename: skill,
      options: [{ patterns: ['terraform apply'] }],
      errors: [found('git push')],
    },
    {
      code: withFields('description: d', inline('helm upgrade chart')),
      filename: skill,
      options: [{ patterns: ['Helm Upgrade'] }],
      errors: [found('Helm Upgrade')],
    },
  ],
})

describe('the option patterns', () => {
  const lint = (patterns: unknown[]) =>
    lintMarkdown('skill-side-effects-manual-only', withFields('description: d'), skill, [
      { patterns },
    ])

  it('refuses an empty pattern and a pattern with no letter or digit', () => {
    expect(() => lint([''])).toThrow(/should match pattern/)
    expect(() => lint(['..'])).toThrow(/should match pattern/)
  })

  it('refuses a pattern that is listed twice', () => {
    expect(() => lint(['x', 'x'])).toThrow(/duplicate items/)
  })

  it('accepts a list with a pattern', () => {
    expect(lint(['x'])).toEqual([])
  })
})
