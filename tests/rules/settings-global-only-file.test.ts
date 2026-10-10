// The expected values come from two pages. The file reference of the .claude directory page
// (https://code.claude.com/docs/en/claude-directory#file-reference) marks `keybindings.json`,
// `themes/*.json` and `~/.claude.json` as "Global only". The debug page says that `permissions`,
// `hooks` and `env` belong in a settings file. The files globs are in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-global-only-file')

// The shape of the example in the file reference.
const KEYBINDINGS = JSON.stringify({
  $schema: 'https://www.schemastore.org/claude-code-keybindings.json',
  bindings: [{ context: 'Chat', bindings: { 'ctrl+e': 'chat:externalEditor', 'ctrl+s': null } }],
})
const THEME = JSON.stringify({ name: 'Dracula', base: 'dark', overrides: { claude: '#bd93f9' } })

jsonTester.run('settings-global-only-file (valid)', rule, {
  valid: [
    // A `.claude.json` with none of the three keys. It holds app state, and Claude Code reads
    // the one in the home directory only.
    ...['.claude.json', 'packages/x/.claude.json'].map((filename) => ({
      code: '{"theme": "dark", "mcpServers": {}, "projects": {}}',
      filename,
    })),
    // The three keys at a deeper level are no top-level key.
    {
      code: '{"projects": {"/a": {"permissions": {}, "hooks": {}, "env": {}}}}',
      filename: '.claude.json',
    },
    // Keys that only look like the three.
    { code: '{"Permissions": 1, "hook": 1, "environment": 1}', filename: '.claude.json' },
    // An empty object and a value that is not an object have no key.
    ...['{}', '[1]', '"x"', 'null', '1'].map((code) => ({ code, filename: '.claude.json' })),
  ],
  invalid: [],
})

jsonTester.run('settings-global-only-file (invalid)', rule, {
  valid: [],
  invalid: [
    // A keybindings file or a theme file: one report, at the first character of the file.
    ...['.claude/keybindings.json', 'packages/x/.claude/keybindings.json'].map((filename) => ({
      code: KEYBINDINGS,
      filename,
      errors: [{ messageId: 'keybindings' as const, line: 1, column: 1, endLine: 1, endColumn: 2 }],
    })),
    ...['.claude/themes/dracula.json', 'packages/x/.claude/themes/dracula.json'].map(
      (filename) => ({
        code: THEME,
        filename,
        errors: [{ messageId: 'theme' as const, line: 1, column: 1, endLine: 1, endColumn: 2 }],
      }),
    ),
    // The content does not matter: an empty object, an array, and a file with leading blank lines.
    {
      code: '{}',
      filename: '.claude/keybindings.json',
      errors: [{ messageId: 'keybindings' as const }],
    },
    {
      code: '[]',
      filename: '.claude/themes/x.json',
      errors: [{ messageId: 'theme' as const }],
    },
    {
      code: '\n\n  {"bindings": []}',
      filename: '.claude/keybindings.json',
      errors: [{ messageId: 'keybindings' as const, line: 3, column: 3, endLine: 3, endColumn: 4 }],
    },
    // A theme named like the keybindings file is still a theme.
    {
      code: THEME,
      filename: '.claude/themes/keybindings.json',
      errors: [{ messageId: 'theme' as const }],
    },
    // Each of the three keys of a `.claude.json`, on the key.
    ...['permissions', 'hooks', 'env'].map((key) => ({
      code: `{"theme": "dark", "${key}": {}}`,
      filename: '.claude.json',
      errors: [
        {
          messageId: 'settingsKey' as const,
          data: { key },
          line: 1,
          column: 19,
          endColumn: 19 + key.length + 2,
        },
      ],
    })),
    // The three keys together: one report for each, in the order of the file. A nested copy too.
    {
      code: '{"env": {}, "hooks": {}, "permissions": {}}',
      filename: 'packages/x/.claude.json',
      errors: [
        { messageId: 'settingsKey' as const, data: { key: 'env' } },
        { messageId: 'settingsKey' as const, data: { key: 'hooks' } },
        { messageId: 'settingsKey' as const, data: { key: 'permissions' } },
      ],
    },
    // The message names the key.
    {
      code: '{"hooks": {}}',
      filename: '.claude.json',
      errors: [
        {
          message:
            'Claude Code does not read "hooks" from a .claude.json in a repository, and ~/.claude.json holds app state. Set "hooks" in .claude/settings.json.',
        },
      ],
    },
    // Two keys of one name give one report, for the last.
    {
      code: '{"env": {}, "theme": "x", "env": {}}',
      filename: '.claude.json',
      errors: [{ messageId: 'settingsKey' as const, line: 1, column: 27 }],
    },
  ],
})
