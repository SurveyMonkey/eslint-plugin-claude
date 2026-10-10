// A `model` other than `inherit` in a skill or command can switch the model for the turn that
// runs it, and each model has its own prompt cache. The rule reads the field `model`, and does
// not know the model of the session. A forked skill sets the model of its subagent, so the
// rule skips it.

import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const withFields = (lines: string) => `---\n${lines}\n---\n\nDo the work.\n`

const override = (value: string, line = 2, endColumn = 8 + value.length) => ({
  messageId: 'override' as const,
  data: { value },
  line,
  column: 1,
  endLine: line,
  endColumn,
})

markdownTester.run('skill-model-override', ruleOf('skill-model-override'), {
  valid: [
    // `inherit` keeps the active model, and no `model` keeps it too.
    { code: withFields('model: inherit'), filename: skill },
    { code: withFields('description: d'), filename: skill },
    { code: withFields('model: inherit'), filename: command },
    { code: withFields('model: inherit'), filename: pluginSkill() },
    { code: withFields('model: inherit'), filename: pluginCommand() },
    { code: withFields('description: d'), filename: pluginSkill() },
    { code: withFields('description: d'), filename: pluginCommand() },
    // A `model` in `metadata` is not the field.
    { code: withFields('metadata:\n  model: opus'), filename: skill },
    // A value that is no string or is empty names no model. `skill-frontmatter-schema` owns types.
    { code: withFields('model: 3'), filename: skill },
    { code: withFields('model: [opus]'), filename: skill },
    { code: withFields('model: ""'), filename: skill },
    { code: withFields('model:'), filename: skill },
    // A forked skill sets the model of the subagent, so the conversation keeps its cache.
    { code: withFields('model: opus\ncontext: fork'), filename: skill },
    { code: withFields('context: fork\nmodel: claude-opus-5-5'), filename: command },
    { code: withFields('model: opus\ncontext: fork'), filename: pluginSkill() },
    // A key that is an alias has a value, and no field to report on.
    { code: '---\nx: &k model\n*k : opus\n---\n', filename: skill },
    // No frontmatter, and a block that does not parse.
    { code: 'Do the work.\n', filename: skill },
    { code: '---\nmodel: [opus\n---\n', filename: skill },
    // Not a skill or command file.
    { code: withFields('model: opus'), filename: 'docs/SKILL.md' },
    { code: withFields('model: opus'), filename: '.claude/agents/a.md' },
  ],
  invalid: [
    // A project skill, a command file, a plugin skill and a plugin command.
    { code: withFields('model: opus'), filename: skill, errors: [override('opus')] },
    { code: withFields('model: opus'), filename: command, errors: [override('opus')] },
    { code: withFields('model: opus'), filename: pluginSkill(), errors: [override('opus')] },
    { code: withFields('model: opus'), filename: pluginCommand(), errors: [override('opus')] },
    // Each form of a value: an alias, a full ID, the `[1m]` suffix, `default` and a provider ID.
    { code: withFields('model: sonnet'), filename: skill, errors: [override('sonnet')] },
    {
      code: withFields('model: claude-haiku-5-5'),
      filename: skill,
      errors: [override('claude-haiku-5-5')],
    },
    { code: withFields('model: opus[1m]'), filename: skill, errors: [override('opus[1m]')] },
    { code: withFields('model: default'), filename: skill, errors: [override('default')] },
    { code: withFields('model: Inherit'), filename: skill, errors: [override('Inherit')] },
    {
      code: withFields('model: us.anthropic.claude-opus-4-8'),
      filename: skill,
      errors: [override('us.anthropic.claude-opus-4-8')],
    },
    // Another field before it moves the line.
    {
      code: withFields('description: d\nmodel: haiku'),
      filename: skill,
      errors: [override('haiku', 3)],
    },
    // A `context` other than `fork` runs in the conversation.
    {
      code: withFields('model: opus\ncontext: inline'),
      filename: skill,
      errors: [override('opus')],
    },
    // A quoted value reports its text, and the report covers the quotes.
    { code: withFields('model: "opus"'), filename: skill, errors: [override('opus', 2, 14)] },
  ],
})
