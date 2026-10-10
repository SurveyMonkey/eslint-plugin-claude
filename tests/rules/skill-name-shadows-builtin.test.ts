// A skill or command named like a built-in command or a bundled skill. The effective name is
// the `name` field, else the folder of the skill, else the path of the command file. A plugin
// file has a namespace, so the rule skips it.
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const inFolder = (folder: string) => `.claude/skills/${folder}/SKILL.md`
const named = (value: string) => `---\nname: ${value}\ndescription: d\n---\n\n# S\n`
const bare = '---\ndescription: d\n---\n\n# S\n'

markdownTester.run('skill-name-shadows-builtin', ruleOf('skill-name-shadows-builtin'), {
  valid: [
    { code: named('deploy'), filename: inFolder('deploy') },
    { code: bare, filename: inFolder('deploy') },
    // The `name` field wins over the folder.
    { code: named('deploy'), filename: inFolder('clear') },
    // An alias keeps its command. The skills page says a skill replaces the name, not its aliases.
    { code: bare, filename: inFolder('review') },
    { code: bare, filename: inFolder('cost') },
    { code: bare, filename: inFolder('stats') },
    // The docs describe a project skill named `verify` or `simplify` as a supported setup.
    { code: bare, filename: inFolder('verify') },
    { code: named('simplify'), filename: inFolder('s') },
    // A workflow is neither a built-in command nor a bundled skill.
    { code: bare, filename: inFolder('deep-research') },
    // The match is exact.
    { code: named('Clear'), filename: inFolder('s') },
    { code: bare, filename: inFolder('clear-all') },
    // A command in a subfolder has a name with `:`.
    { code: '# C\n', filename: '.claude/commands/ns/clear.md' },
    { code: '# C\n', filename: '.claude/commands/deploy.md' },
    // The option `allow` lists names that the repository means to replace.
    { code: bare, filename: inFolder('clear'), options: [{ allow: ['clear'] }] },
    { code: named('batch'), filename: inFolder('s'), options: [{ allow: ['batch', 'x'] }] },
    { code: '# C\n', filename: '.claude/commands/compact.md', options: [{ allow: ['compact'] }] },
    // A plugin skill and a plugin command have the namespace `plugin:name`.
    { code: named('clear'), filename: pluginSkill('clear') },
    { code: bare, filename: pluginSkill('batch') },
    { code: '# C\n', filename: pluginCommand('clear') },
    // Not a skill or command file.
    { code: named('clear'), filename: 'docs/SKILL.md' },
    // The `name` field is not a name.
    { code: '---\nname: 5\n---\n', filename: inFolder('deploy') },
    { code: '---\nname: [clear]\n---\n', filename: inFolder('deploy') },
  ],
  invalid: [
    {
      code: named('clear'),
      filename: inFolder('s'),
      errors: [
        {
          // The message says no more than the docs.
          message:
            '`clear` is the name of a built-in command. In a local terminal session, a skill with this name replaces the command, but not its aliases. Rename the skill, or add the name to the option `allow`.',
          line: 2,
          column: 7,
          endLine: 2,
          endColumn: 12,
        },
      ],
    },
    {
      code: named('batch'),
      filename: inFolder('s'),
      errors: [
        {
          message:
            '`batch` is the name of a bundled skill. A skill with this name replaces the bundled skill, but not its aliases. Rename the skill, or add the name to the option `allow`.',
          line: 2,
          column: 7,
        },
      ],
    },
    // With no `name`, the folder gives the name.
    {
      code: bare,
      filename: inFolder('compact'),
      errors: [{ messageId: 'builtIn', data: { name: 'compact' }, line: 1, column: 1 }],
    },
    {
      code: bare,
      filename: inFolder('code-review'),
      errors: [{ messageId: 'bundled', data: { name: 'code-review' } }],
    },
    // An empty `name` falls back to the folder.
    {
      code: '---\nname: ""\n---\n',
      filename: inFolder('help'),
      errors: [{ messageId: 'builtIn', data: { name: 'help' } }],
    },
    // No frontmatter, and frontmatter that does not parse.
    {
      code: '# S\n',
      filename: inFolder('login'),
      errors: [{ messageId: 'builtIn', data: { name: 'login' } }],
    },
    {
      code: '---\nname: [unclosed\n---\n',
      filename: inFolder('loop'),
      errors: [{ messageId: 'bundled', data: { name: 'loop' } }],
    },
    // A command file takes its name from its path.
    {
      code: '# C\n',
      filename: '.claude/commands/model.md',
      errors: [{ messageId: 'builtIn', data: { name: 'model' } }],
    },
    {
      code: '# C\n',
      filename: '.claude/commands/debug.md',
      errors: [{ messageId: 'bundled', data: { name: 'debug' } }],
    },
    // The `name` field of a command file is not read.
    {
      code: named('deploy'),
      filename: '.claude/commands/usage.md',
      errors: [{ messageId: 'builtIn', data: { name: 'usage' } }],
    },
    // `allow` does not cover another name.
    {
      code: bare,
      filename: inFolder('clear'),
      options: [{ allow: ['compact'] }],
      errors: [{ messageId: 'builtIn' }],
    },
    { code: bare, filename: inFolder('clear'), options: [{}], errors: [{ messageId: 'builtIn' }] },
  ],
})
