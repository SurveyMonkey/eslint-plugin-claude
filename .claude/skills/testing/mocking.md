# When to mock

Adapted from the `tdd` skill in [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).

Mock at a system boundary only. A rule in this plugin reads source text and, for a cross-file
rule, other files. It has almost no boundaries, so tests mock almost nothing.

Do not mock:

- ESLint, `RuleTester`, `Linter`, or a rule's `context`.
- `@eslint/markdown`, `@eslint/json` or `yaml`. The real parser gives the real node.
- The modules of this plugin.

## Real files for a cross-file rule

A rule that reads a second file (a plugin manifest, a hook script, a referenced skill file) gets a
real directory tree in a temporary directory. Do not mock `node:fs`.

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const scratch = mkdtempSync(path.join(tmpdir(), 'command-legacy-format-'))
const plugin = path.join(scratch, 'plugins', 'p')
mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true })
writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), '{}')

markdownTester.run('command-legacy-format', rule, {
  valid: [{ code: '# Doc\n', filename: path.join(scratch, 'docs', 'commands', 'a.md') }],
  invalid: [
    { code: '# A\n', filename: path.join(plugin, 'commands', 'a.md'), errors: [{ messageId: 'legacy' }] },
  ],
})
```

Build the tree so that removing the guard changes the result. Here the `valid` case sits in a
`commands/` directory that Claude Code does not read. A rule that reports every `commands/` file
fails on it.

## Inject through options and settings

When a rule depends on something outside the file, take it as a rule option or from ESLint
`settings`. Do not read `process.cwd()`, the environment or the home directory inside the rule. A
test then sets the value through the same interface that a user sets.

```ts
// Easy to test: the names come from an option.
{ code, filename, options: [{ personalNames: ['deploy'] }], errors: [{ messageId: 'shadowed' }] }

// Hard to test: the rule reads ~/.claude/skills itself.
```

If a true boundary appears (the network, the clock), pass it in as an argument with one function
for each operation, and mock that function. Never mock a module to reach it.
