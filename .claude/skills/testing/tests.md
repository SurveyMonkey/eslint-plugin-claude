# Good and bad tests

Paired examples for rules and configs. Adapted from the `tdd` skill in
[mattpocock/skills](https://github.com/mattpocock/skills) (MIT), in ESLint terms.

## Setup: one RuleTester for each language

`RuleTester` looks for global `describe` and `it`. Vitest globals are off here, so give them to
the tester once, in a support file beside the tests:

```ts
// tests/rule-tester.test-support.ts
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'

Object.assign(RuleTester, { describe, it, itOnly: it.only })

export const markdownTester = new RuleTester({
  plugins: { markdown },
  language: 'markdown/gfm',
  languageOptions: { frontmatter: 'yaml' },
})

export const jsonTester = new RuleTester({
  plugins: { json },
  language: 'json/json',
})
```

## Good: test through the rule's public interface

```ts
// GOOD: RuleTester runs the rule the way ESLint does, on a real file name.
markdownTester.run('skill-description-max-length', rule, {
  valid: [
    // The near miss: exactly at the 1,536 limit (Claude Code skill listing) stays silent.
    { code: `---\ndescription: ${'a'.repeat(1536)}\n---\n`, filename: '.claude/skills/s/SKILL.md' },
  ],
  invalid: [
    {
      code: `---\ndescription: ${'a'.repeat(1537)}\n---\n`,
      filename: '.claude/skills/s/SKILL.md',
      errors: [{ messageId: 'listingTruncated', data: { length: '1537', max: '1536' }, line: 1 }],
    },
  ],
})
```

- It checks the report that a user sees: the `messageId`, its `data` and the location.
- The `valid` case is the near miss, so a rule that reports on everything fails.
- It survives a refactor of the rule's internals.

## Bad: test the implementation

```ts
// BAD: calls the rule with a hand-made context and counts the calls.
test('reports a long description', () => {
  const report = vi.fn()
  rule.create({ report, sourceCode: fakeSourceCode } as never).yaml?.(fakeNode)
  expect(report).toHaveBeenCalledTimes(1)
})
```

Red flags:

- A fake `context` or `sourceCode`. It fails when ESLint changes the context, and it passes when
  the real language plugin gives a different node.
- An assertion on a call count or call order.
- The title says what the code does ("calls report"), not what the user sees.

## Bad: verify around the interface

```ts
// BAD: tests the helper, not the rule. The rule can stop calling the helper and this passes.
test('detects frontmatter', () => {
  expect(parseFrontmatter('---\ndescription: x\n---\n')).toEqual({ description: 'x' })
})

// GOOD: the rule's report proves that it read the frontmatter.
markdownTester.run('skill-description-max-length', rule, {
  valid: [{ code: '---\ndescription: x\n---\n', filename: '.claude/skills/s/SKILL.md' }],
  invalid: [/* ... */],
})
```

A shared helper gets its own tests only when more than one rule uses it.

## Bad: a tautological expected value

```ts
// BAD: the expected message uses the rule's own formatting, so it cannot disagree with it.
errors: [{ message: formatTruncated(listing.length, MAX) }]

// GOOD: an independent literal. The 1,536 limit comes from the Claude Code docs, not from the code.
errors: [{ messageId: 'listingTruncated', data: { length: '1537', max: '1536' } }]
```

## Bad: an invented shape

```ts
// BAD: a hooks.json shape written from memory. Claude Code never reads this shape.
{ code: '{"hooks":{"onStart":"./run.sh"}}', filename: 'hooks/hooks.json' }

// GOOD: a real shape, trimmed. It keeps the event, the matcher and the handler layout.
{
  code: '{"hooks":{"SessionStart":[{"matcher":"startup","hooks":[{"type":"command","command":"${CLAUDE_PLUGIN_ROOT}/hooks/start.sh"}]}]}}',
  filename: 'hooks/hooks.json',
}
```

## Good: a config loads the way a user loads it

```ts
// GOOD: by name through extends, and as the object from plugin.configs.
const linter = new Linter()
const config = defineConfig([{ files: ['**/*.js'], plugins: { claude: plugin }, extends: ['claude/recommended'] }])
expect(linter.verify('const a = 1\n', config, 'a.js')).toEqual([])
```
