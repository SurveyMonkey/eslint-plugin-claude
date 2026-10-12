// Claude Code discovers all `.md` files in `.claude/rules/`, at any depth, and ignores the others
// (https://code.claude.com/docs/en/memory#set-up-rules). The files glob is in
// tests/configs.test.ts.
import { jsonTester, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('rules-md-extension')

const code = '# Rule\n'
const extension = { messageId: 'extension' as const, line: 1, column: 1 }

markdownTester.run('rules-md-extension', rule, {
  valid: [
    // The examples of the docs.
    { code, filename: '.claude/rules/code-style.md' },
    { code, filename: '.claude/rules/testing.md' },
    { code, filename: '.claude/rules/frontend/react.md' },
    { code, filename: '.claude/rules/a/b/c/deep.md' },
    { code, filename: 'packages/web/.claude/rules/security.md' },
    { code, filename: '/home/user/.claude/rules/preferences.md' },
    // The extension without case: the docs do not say that Claude Code tells `.MD` from `.md`.
    { code, filename: '.claude/rules/style.MD' },
    // A hidden file, such as the file that keeps an empty directory in git.
    { code, filename: '.claude/rules/.gitkeep' },
    { code, filename: '.claude/rules/.hidden.txt' },
    { code, filename: '.claude/rules/frontend/.DS_Store' },
    // A file outside `.claude/rules/`, with the same names.
    { code, filename: 'docs/rules/style.txt' },
    { code, filename: '.claude/rules.txt' },
    { code, filename: '.claude/skills/rules/style.txt' },
    { code, filename: 'rules/style.txt' },
    { code, filename: '.claude/agents/style.txt' },
    { code, filename: 'docs/CLAUDE-notes.md' },
  ],
  invalid: [
    { code, filename: '.claude/rules/style.txt', errors: [extension] },
    { code, filename: '.claude/rules/style.markdown', errors: [extension] },
    { code, filename: '.claude/rules/style.mdc', errors: [extension] },
    { code, filename: '.claude/rules/style.md.bak', errors: [extension] },
    { code, filename: '.claude/rules/style', errors: [extension] },
    { code, filename: '.claude/rules/style.yaml', errors: [extension] },
    { code, filename: '.claude/rules/frontend/react.txt', errors: [extension] },
    { code, filename: 'packages/web/.claude/rules/a.txt', errors: [extension] },
    { code, filename: '/home/user/.claude/rules/prefs.txt', errors: [extension] },
    // A file named like a rule file, with the extension of another type.
    { code, filename: '.claude/rules/CLAUDE.txt', errors: [extension] },
  ],
})

markdownTester.run('rules-md-extension (message text)', rule, {
  valid: [],
  invalid: [
    {
      code,
      filename: '.claude/rules/style.txt',
      errors: [
        {
          message:
            'Claude Code discovers only `.md` files in `.claude/rules/`. It ignores this file. Rename it to end in `.md`, or move it out of the directory.',
        },
      ],
    },
  ],
})

// A JSON file below `.claude/rules/` has the JSON language, with a `Document` node and no `root` node.
const json = '{"a": 1}\n'

jsonTester.run('rules-md-extension (json)', rule, {
  valid: [
    // A hidden file, and a file outside `.claude/rules/`, with the same extension.
    { code: json, filename: '.claude/rules/.hidden.json' },
    { code: json, filename: '.claude/rules/x/.hidden.json' },
    { code: json, filename: '.claude/settings.json' },
    { code: json, filename: 'docs/rules/settings.json' },
    { code: json, filename: '.claude/skills/rules/package.json' },
  ],
  invalid: [
    { code: json, filename: '.claude/rules/settings.json', errors: [extension] },
    { code: json, filename: '.claude/rules/x/package.json', errors: [extension] },
    { code: json, filename: 'packages/web/.claude/rules/a/b/c/data.JSON', errors: [extension] },
    { code: '[]\n', filename: '/home/user/.claude/rules/list.json', errors: [extension] },
  ],
})
