// The configs choose files by glob. RuleTester cannot see a glob that
// matches nothing, so this test runs ESLint itself over a tree built in a
// temporary directory. The tree is not committed, so neither the lint of
// this repository nor Claude Code reads it as configuration.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ESLint, type Linter } from 'eslint'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'
import { isolateGitConfig, stage } from './git-tree.test-support.ts'

const long = 'a'.repeat(1537)
// The plugin variables, escaped so that the template literal keeps them as text.
const pluginRoot = `\${CLAUDE_PLUGIN_ROOT}`
const pluginData = `\${CLAUDE_PLUGIN_DATA}`
const projectDir = `\${CLAUDE_PROJECT_DIR}`
const userConfigRef = `./run.sh \${user_config.token}`
const tokenRef = `Use \${user_config.token}\n`
const badHooks = JSON.stringify({ hooks: { preToolUse: [] } })
/** A hooks object with one command hook. */
const hookOf = (command: string) => ({
  hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command }] }] },
})
// One bad permission rule for each grammar rule, in the order of GRAMMAR_RULES.
const badSettings = JSON.stringify({
  hooks: { preToolUse: [] },
  permissions: {
    allow: [
      'Bash(',
      'bogus',
      'B*',
      'WebSearch(x)',
      'Write(docs/**)',
      'mcp__a(x)',
      'Skill(anthropic *)',
    ],
    deny: ['Bash(command:x)'],
  },
})

// The hooks rules of #10, layer 1. One config with a fault for each rule that reads it: a matcher
// array (`hooks-config-schema`), `async` on an http hook (`hooks-handler-field-ignored`), a prompt hook
// on `SessionEnd` (`hooks-handler-type-event-support`), and a removed flag
// (`hooks-command-removed-cli-flag`). `disableAllHooks` adds the fifth, in a settings file.
const hookGroups = [{ matcher: ['a'], hooks: [{ type: 'http', url: 'u', async: true }] }]
const hooksFaults = {
  Stop: [...hookGroups, { hooks: [{ type: 'command', command: 'claude --enable-auto-mode' }] }],
  SessionEnd: [
    { hooks: [{ type: 'prompt', prompt: 'p' }] },
    // A matcher value that Claude Code removed (`hooks-matcher-deprecated-value`).
    {
      matcher: 'bypass_permissions_disabled',
      hooks: [{ type: 'command', command: './x.sh' }],
    },
  ],
  // A WorktreeCreate hook with no WorktreeRemove hook (`hooks-worktree-create-without-remove`).
  WorktreeCreate: [{ hooks: [{ type: 'command', command: './x.sh' }] }],
  // An agent hook (`hooks-agent-type-experimental`).
  PostToolBatch: [{ hooks: [{ type: 'agent', prompt: 'p' }] }],
  // A deprecated flag (`hooks-command-deprecated-cli-flag`).
  TaskCompleted: [{ hooks: [{ type: 'command', command: 'claude --remote x' }] }],
  // A field that the docs do not list for the type (`hooks-handler-field-unknown`).
  Setup: [{ hooks: [{ type: 'command', command: './x.sh', bogus: true }] }],
  // A prompt hook, which cannot deny (`hooks-prompt-on-permission-request`).
  PermissionRequest: [
    { hooks: [{ type: 'prompt', prompt: 'p' }] },
    // An allow decision under no matcher (`hooks-broad-auto-approve`).
    {
      hooks: [
        {
          type: 'command',
          command: `echo '{"hookSpecificOutput":{"decision":{"behavior":"allow"}}}'`,
        },
      ],
    },
  ],
  // A pipe in the args of an exec-form hook (`hooks-exec-form-shell-syntax`).
  SessionStart: [{ hooks: [{ type: 'command', command: 'tool', args: ['a', '|', 'b'] }] }],
  // A literal credential in a header (`hooks-http-literal-secret`).
  PostToolUseFailure: [
    { hooks: [{ type: 'http', url: 'u', headers: { Authorization: 'Bearer abc123' } }] },
  ],
  // A script with no shebang line (`hooks-script-shebang`), in exec form.
  ElicitationResult: [
    {
      hooks: [{ type: 'command', command: `${projectDir}/scripts/plain.sh`, args: [] }],
    },
  ],
  // A bare executable name with whitespace, in exec form (`hooks-exec-form-command-spaces`).
  SubagentStop: [
    { hooks: [{ type: 'command', command: 'my tool', args: ['x'] }] },
    // A plugin-scoped name with no anchors (`hooks-matcher-subagent-anchor`).
    { matcher: 'p:a', hooks: [{ type: 'command', command: './x.sh' }] },
  ],
  // An http hook with a header variable that `allowedEnvVars` does not list (`hooks-http-env-allowlist`).
  Elicitation: [{ hooks: [{ type: 'http', url: 'u', headers: { A: '$X' } }] }],
  // `$CLAUDE_MODEL` does not exist (`hooks-env-var-unavailable`).
  PreModelSwitch: [{ hooks: [{ type: 'command', command: 'echo $CLAUDE_MODEL' }] }],
  // A bare `$CLAUDE_PROJECT_DIR` in a PowerShell command (`hooks-powershell-placeholder`).
  PostCompact: [
    { hooks: [{ type: 'command', shell: 'powershell', command: '& $CLAUDE_PROJECT_DIR\\x.ps1' }] },
  ],
  // A matcher on an event without matcher support (`hooks-matcher-unsupported-event`).
  // A matcher that names an MCP server and no tool (`hooks-matcher-mcp-name`).
  // The `Bash` matcher below also lacks PowerShell (`hooks-matcher-bash-without-powershell`).
  PreToolUse: [
    { matcher: 'mcp__memory', hooks: [{ type: 'command', command: './x.sh' }] },
    // An `if` that holds two rules (`hooks-if-condition`).
    {
      matcher: 'Bash',
      hooks: [{ type: 'command', command: './x.sh', if: 'Bash(a) && Bash(b)' }],
    },
    // A matcher that no tool name can match (`hooks-matcher-never-matches`).
    { matcher: 'bash', hooks: [{ type: 'command', command: './x.sh' }] },
    // A matcher in the form `Tool(specifier)` (`hooks-matcher-syntax`).
    { matcher: 'Bash(rm *)', hooks: [{ type: 'command', command: './x.sh' }] },
    // A regular expression that also matches `NotebookEdit` (`hooks-matcher-unanchored-regex`).
    { matcher: 'Edit.*', hooks: [{ type: 'command', command: './x.sh' }] },
    // A matcher value that is no tool name (`hooks-matcher-name-unresolved`).
    { matcher: 'Edt', hooks: [{ type: 'command', command: './x.sh' }] },
  ],
  // A `*` matcher on FileChanged (`hooks-filechanged-star-matcher`).
  FileChanged: [{ matcher: '*', hooks: [{ type: 'command', command: './x.sh' }] }],
  // An unquoted placeholder (`hooks-placeholder-quoted`) in shell form (`hooks-prefer-exec-form`).
  ConfigChange: [{ hooks: [{ type: 'command', command: `bash ${projectDir}/x.sh` }] }],
  // A quoted placeholder in shell form (`hooks-prefer-exec-form`).
  InstructionsLoaded: [{ hooks: [{ type: 'command', command: `"${projectDir}"/x.sh` }] }],
  // A matcher value that the event never sends (`hooks-matcher-enum`).
  Notification: [{ matcher: 'nope', hooks: [{ type: 'command', command: './x.sh' }] }],
  UserPromptSubmit: [
    { matcher: 'Bash', hooks: [{ type: 'command', command: './x.sh' }] },
    {
      hooks: [
        // A background hook on an event that can block (`hooks-async-on-blocking-event`).
        { type: 'command', command: './x.sh', async: true },
        // A timeout in milliseconds (`hooks-timeout-units`).
        { type: 'command', command: './x.sh', timeout: 5000 },
      ],
    },
  ],
}
const dupHooks = JSON.stringify({
  hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: './fmt.sh' }] }] },
})
const dupManifest = JSON.stringify({ name: 'dup', ...JSON.parse(dupHooks) })
// The hooks output rules of layer H9, one fault for each. A handler prints JSON with `echo`, or runs a script of
// the folder. `hooks-output-size` has a tree of its own, so no large file is in the shared tree.
const printJson = (value: unknown) => `echo '${JSON.stringify(value)}'`
const rewriteInput = (input: string) =>
  printJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { command: input },
    },
  })
const outputHooks = {
  PreToolUse: [
    { matcher: 'Edit', hooks: [{ type: 'command', command: rewriteInput('ls') }] },
    // A second rewrite for the same tool (`hooks-multiple-updatedinput`).
    { matcher: 'Edit', hooks: [{ type: 'command', command: rewriteInput('pwd') }] },
    // The old top-level decision (`hooks-output-deprecated-fields`).
    { matcher: 'Read', hooks: [{ type: 'command', command: printJson({ decision: 'approve' }) }] },
    // A script that exits 1 after a message to stderr (`hooks-output-blocking-exit-code`).
    {
      matcher: 'Write',
      hooks: [{ type: 'command', command: `${projectDir}/scripts/deny.sh`, args: [] }],
    },
  ],
  // A field with no effect (`hooks-output-schema`).
  PostToolUse: [
    { matcher: 'Read', hooks: [{ type: 'command', command: printJson({ suppressOutput: true }) }] },
  ],
  // A script that blocks and never reads `stop_hook_active` (`hooks-stop-loop-guard`).
  Stop: [{ hooks: [{ type: 'command', command: `${projectDir}/scripts/stop.sh`, args: [] }] }],
  // Text that never changes (`hooks-sessionstart-static-context`).
  SessionStart: [{ hooks: [{ type: 'command', command: 'echo "Use bun test"' }] }],
}
// `hooks-output-size`: a literal over a small limit that the test sets.
const OUTPUT_SIZE_LIMIT = 50
const OUTPUT_SIZE_TREE: Record<string, string> = {
  'packages/osz/.claude/settings.json': JSON.stringify({
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    hooks: {
      SessionStart: [
        { hooks: [{ type: 'command', command: printJson({ systemMessage: 'x'.repeat(60) }) }] },
      ],
    },
  }),
}
const hooksSettings = JSON.stringify({ disableAllHooks: true, hooks: hooksFaults })
const hooksDropIn = JSON.stringify({ hooks: hooksFaults })
const hooksYaml = `---
name: hk
hooks:
  Stop:
    - matcher: [a]
      hooks:
        - type: http
          url: u
          async: true
        - type: command
          command: claude --enable-auto-mode
  SessionEnd:
    - hooks:
        - type: prompt
          prompt: p
    - matcher: bypass_permissions_disabled
      hooks:
        - type: command
          command: ./x.sh
  WorktreeCreate:
    - hooks:
        - type: command
          command: ./x.sh
  PostToolBatch:
    - hooks:
        - type: agent
          prompt: p
  TaskCompleted:
    - hooks:
        - type: command
          command: claude --remote x
  Setup:
    - hooks:
        - type: command
          command: ./x.sh
          bogus: true
  PermissionRequest:
    - hooks:
        - type: prompt
          prompt: p
  SubagentStop:
    - hooks:
        - type: command
          command: my tool
          args: [x]
    - matcher: 'p:a'
      hooks:
        - type: command
          command: ./x.sh
  Elicitation:
    - hooks:
        - type: http
          url: u
          headers:
            A: $X
  PreModelSwitch:
    - hooks:
        - type: command
          command: echo $CLAUDE_MODEL
  PostCompact:
    - hooks:
        - type: command
          shell: powershell
          command: '& $CLAUDE_PROJECT_DIR\\x.ps1'
  PreToolUse:
    - matcher: mcp__memory
      hooks:
        - type: command
          command: ./x.sh
    - matcher: Bash
      hooks:
        - type: command
          command: ./x.sh
          if: Bash(a) && Bash(b)
    - matcher: bash
      hooks:
        - type: command
          command: ./x.sh
    - matcher: Bash(rm *)
      hooks:
        - type: command
          command: ./x.sh
    - matcher: Edit.*
      hooks:
        - type: command
          command: ./x.sh
    - matcher: Edt
      hooks:
        - type: command
          command: ./x.sh
  FileChanged:
    - matcher: '*'
      hooks:
        - type: command
          command: ./x.sh
  ConfigChange:
    - hooks:
        - type: command
          command: bash ${projectDir}/x.sh
  InstructionsLoaded:
    - hooks:
        - type: command
          command: '"${projectDir}"/x.sh'
  Notification:
    - matcher: nope
      hooks:
        - type: command
          command: ./x.sh
  UserPromptSubmit:
    - matcher: Bash
      hooks:
        - type: command
          command: ./x.sh
    - hooks:
        - type: command
          command: ./x.sh
          async: true
        - type: command
          command: ./x.sh
          timeout: 5000
---
`

// A skill and a subagent with a hook event name that Claude Code does not know (`hooks-event-name-known`).
const unknownEventYaml = `---
name: ev
hooks:
  preToolUse:
    - hooks:
        - type: command
          command: ./x.sh
---
`

// One entry with a `command` source and a `version`, a `headersHelper` that starts with a
// relative path, and `hooks` as a path, under a reserved name with no `owner`. A second entry has
// a `github` source with a bad `repo`, and a third has a relative `source` with no `./`. A fourth
// entry is named `renamed`, and its source `plugins/p` has a `plugin.json` that is named `p`. A
// fifth entry has a relative `source` to a directory that is not there. A sixth entry sets a
// `version` that `plugins/m/.claude-plugin/plugin.json` sets too, and an `mcpServers`. A seventh
// entry sets `strict` to `false` and `skills`, and its source has a `plugin.json`. An eighth entry
// sets `hooks` for `Stop`, and its `plugin.json` does too. A ninth entry has the marketplace root as
// its `source`, and lists one of the two skills under `skills/`. A tenth entry
// sets a `commands` path with `..`. The command source of the first entry sets `mode` to `link`.
// An eleventh entry has an `archive` source with no `sha256`, and a twelfth has a relative `source`
// with a backslash.
const badMarketplace = JSON.stringify({
  name: 'claude-code-plugins',
  plugins: [
    {
      name: 'a',
      source: { source: 'command', command: 'my-tool claude-plugin-path', mode: 'link' },
      version: '1.0.0',
      headersHelper: './mint-token',
      hooks: './hooks.json',
    },
    { name: 'b', source: { source: 'github', repo: 'formatter' } },
    { name: 'c', source: 'plugins/c' },
    { name: 'renamed', source: './plugins/p' },
    { name: 'gone', source: './plugins/gone' },
    { name: 'm', source: './plugins/m', version: '2.0.0', mcpServers: {} },
    { name: 'k', source: './plugins/k', strict: false, skills: './' },
    { name: 'h', source: './plugins/h', hooks: { Stop: [] } },
    { name: 'root', source: '.', skills: ['./skills/listed'] },
    { name: 'p', source: './plugins/p', commands: '../c.md' },
    { name: 'd', source: { source: 'archive', url: 'https://x.test/d.zip' } },
    { name: 'e', source: './plugins\\e' },
  ],
})

// A project settings file with one fault for each settings rule of #12. The sync rule reads the
// file name, so the two files below differ only in what that rule reports.
const badMarketSettings = JSON.stringify({
  // `missing` is no entry of the marketplace that `team` points at.
  enabledPlugins: { formatter: true, 'missing@team': true, 'fmt@team': true },
  additionalMarketplaces: {},
  syncClaudeAiPlugins: true,
  extraKnownMarketplaces: {
    // The marketplace at `packages/mk/.claude/market` has the name `acme-market`, not `team`.
    // The tree has no `.git`, so the bound is `.claude/` and the marketplace sits in it.
    team: { source: { source: 'directory', path: '.claude/market' } },
    acme: { source: { source: 'npm', package: 'acme' } },
    docs: {
      source: { source: 'url', url: 'http://x.test/m.json', headersHelper: '/opt/bin/mint' },
    },
  },
})

// The two `off` marketplace rules of #12 read these trees. Four files report in `strict` only.
// Decoy files report nowhere. This is a settings file that registers the marketplace `hosted`
// as a `url` source.
const hostedSettings = JSON.stringify({
  extraKnownMarketplaces: {
    hosted: { source: { source: 'url', url: 'https://plugins.example.com/marketplace.json' } },
  },
})
// A settings file whose `url` source holds a literal header credential, and a marketplace whose
// archive entry does the same.
const credentialSettings = JSON.stringify({
  extraKnownMarketplaces: {
    creds: {
      source: {
        source: 'url',
        url: 'https://plugins.example.com/marketplace.json',
        headers: { Authorization: 'Bearer abc123' },
      },
    },
  },
})
const credentialMarketplace = JSON.stringify({
  name: 'creds',
  owner: { name: 'hc' },
  plugins: [
    {
      name: 'p',
      source: { source: 'archive', url: 'https://x.test/p.zip', sha256: 'a'.repeat(64) },
      headers: { Authorization: 'Bearer abc123' },
    },
  ],
})

// One string value of 2 MiB makes a file over the limit of the size rule.
const big = JSON.stringify({ language: 'x'.repeat(2097152) })

// The marketplace settings rules of K3 (#12). A marketplace for `settings-enabled-plugins-external-source`
// has one entry with an external source, and is valid for the marketplace rules.
const externalMarketplace = JSON.stringify({
  name: 'acme',
  owner: { name: 'ex' },
  plugins: [{ name: 'p', source: { source: 'github', repo: 'acme/p' } }],
})
const externalSettings = JSON.stringify({
  extraKnownMarketplaces: { acme: { source: { source: 'directory', path: '.claude/market' } } },
  enabledPlugins: { 'p@acme': true },
})
const undeclaredSettings = JSON.stringify({ enabledPlugins: { 'p@acme': true } })
const directorySettings = JSON.stringify({
  extraKnownMarketplaces: {
    acme: { source: { source: 'directory', path: '/opt/acme-marketplace' } },
  },
})
const skipLfsSettings = JSON.stringify({
  extraKnownMarketplaces: {
    acme: { source: { source: 'github', repo: 'acme/p', skipLfs: true } },
  },
})
const skillsDir = { source: 'skills-dir' }
const noSkillsDir = JSON.stringify({
  strictKnownMarketplaces: [{ source: 'github', repo: 'acme/*' }],
})
const withSkillsDir = JSON.stringify({ strictKnownMarketplaces: [skillsDir] })
// A rule file that sets a scope.
const SCOPED_RULE = '---\npaths:\n  - "src/**/*.ts"\n---\n# Rule\n'
// A file of 201 lines, one over the limit of the line rules.
const LONG = 'x\n'.repeat(201)

// `claude-md-max-bytes`: a CLAUDE.md file over the limit in each place that Claude Code reads one.
// The same text where it reads none: a Markdown file with a near name, `AGENTS.md`, and a rule
// file (a size rule for rules is not this one). The files are small, and the test sets a small
// `max`. The rule test holds the case of the default limit of 4 MiB.
const MAX_BYTES_LIMIT = 100
const smallMarkdown = `# Notes\n\n${'x'.repeat(300)}\n`
const MAX_BYTES_TREE: Record<string, string> = {
  'CLAUDE.md': smallMarkdown,
  '.claude/CLAUDE.md': smallMarkdown,
  'CLAUDE.local.md': smallMarkdown,
  'docs/CLAUDE-notes.md': smallMarkdown,
  'AGENTS.md': smallMarkdown,
  '.claude/rules/CLAUDE.md': smallMarkdown,
}
// The reports over `MAX_BYTES_TREE`: the files that `claude-md-max-bytes` reads, and the AGENTS.md
// that `claude-md-agents-md-shadowed` reads.
const MAX_BYTES_REPORTS = [
  '.claude/CLAUDE.md: claude/claude-md-max-bytes@2',
  'AGENTS.md: claude/claude-md-agents-md-shadowed@2',
  'CLAUDE.local.md: claude/claude-md-max-bytes@2',
  'CLAUDE.md: claude/claude-md-max-bytes@2',
]

// `mcp-json-file-size`: a `.mcp.json` over a small `max` that the test sets. It has an `mcpServers`
// object, so only the size rule reports it. The tree is separate from `TREE`, so no large file is
// in the shared tree. The rule test holds the case of the default limit of 2 MiB.
const MCP_SIZE_LIMIT = 100
const MCP_SIZE_TREE: Record<string, string> = {
  'packages/mbig/.mcp.json': JSON.stringify({ mcpServers: {}, a: 'x'.repeat(300) }),
}

// A server list with one fault for each content rule of #16: a reserved name, a remote server with
// an empty `url`, a header value with a trailing line break, and a `timeout` in seconds. Seven
// more servers each break one OAuth or environment rule. The last one is at an Anthropic-hosted host.
const badMcpServers = {
  workspace: { command: 'x' },
  docs: { type: 'http', url: '' },
  api: { type: 'http', url: 'https://x.test/mcp', headers: { Authorization: 'Bearer t\n' } },
  build: { command: 'x', timeout: 60 },
  stdioOauth: { command: 'x', oauth: { clientId: 'id' } },
  arrayScopes: { type: 'http', url: 'https://x.test/mcp', oauth: { scopes: ['a'] } },
  shadowed: {
    type: 'http',
    url: 'https://x.test/mcp',
    headers: { Authorization: 'Bearer t' },
    oauth: {},
  },
  projectDir: { command: `\${CLAUDE_PROJECT_DIR}/s.sh` },
  literal: { command: 'x', label: `\${NAME}` },
  credential: { type: 'http', url: 'https://x.test/mcp', headers: { Key: `\${NPM_TOKEN}` } },
  helper: { type: 'http', url: 'https://x.test/mcp', headersHelper: 'echo $MY_TOKEN' },
  hosted: { type: 'http', url: 'https://gmail.mcp.claude.com/mcp' },
  // The warn rules: a name with a dot, the synced skills name, the `sse` type, a relative header
  // helper, and a relative command.
  'bad.name': { command: 'x' },
  'anthropic-skills': { command: 'x' },
  legacy: { type: 'sse', url: 'https://x.test/sse' },
  relHelper: { type: 'http', url: 'https://x.test/mcp', headersHelper: './h.sh' },
  relCommand: { command: './server.js' },
}
const badMcp = JSON.stringify({ mcpServers: badMcpServers })

// An LSP server config with a `command` that has a space, and `transport` `socket`: one fault for
// each LSP rule. A valid config has neither.
const badLsp = JSON.stringify({
  go: { command: 'gopls serve', extensionToLanguage: { '.go': 'go' }, transport: 'socket' },
})
const goodLsp = JSON.stringify({ go: { command: 'gopls', extensionToLanguage: { '.go': 'go' } } })

// An allowlist with a `serverUrl`, a `serverCommand` and a `serverName` entry.
const deadAllowlist = JSON.stringify({
  allowedMcpServers: [
    { serverUrl: 'https://a.test/*' },
    { serverCommand: ['npx'] },
    { serverName: 'a' },
  ],
})
// A policy `serverUrl` with a variable reference.
const variableAllowlist = `{"allowedMcpServers": [{"serverUrl": "https://\${HOST}/*"}]}`

// A `managedMcpServers` value that is an array, and an object with an entry that has a `command`.
const badManagedArray = JSON.stringify({ managedMcpServers: [{ name: 'a' }] })
const badManagedEntry = JSON.stringify({
  managedMcpServers: { a: { command: 'x', type: 'http', url: 'https://a.test' } },
})

const TREE: Record<string, string> = {
  'plugins/p/.claude-plugin/plugin.json': JSON.stringify({ name: 'p', hooks: { Bogus: [] } }),
  'plugins/p/skills/s/SKILL.md': `---\nname: s\ndescription: ${long}\n---\n`,
  'plugins/p/commands/c.md': '# C\n',
  'plugins/p/hooks/hooks.json': badHooks,
  '.claude/skills/t/SKILL.md': `---\nname: t\ndescription: ${long}\n---\n`,
  '.claude/commands/c.md': '# C\n',
  '.claude/commands/ns/c.md': '# C\n',
  '.claude/settings.json': badSettings,
  '.claude/settings.local.json': badSettings,
  'packages/x/.claude/settings.json': badSettings,
  'packages/x/.claude/settings.local.json': badSettings,
  // One bad file for each skill rule, and the same fault where the rule is silent.
  '.claude/skills/position/SKILL.md': '\n---\nname: position\n---\n',
  '.claude/skills/schema/SKILL.md': '---\nmade_up: 1\n---\n',
  '.claude/skills/fork/SKILL.md': '---\nagent: Plan\n---\n',
  '.claude/skills/unreachable/SKILL.md':
    '---\ndisable-model-invocation: true\nuser-invocable: false\n---\n',
  '.claude/skills/synced/SKILL.md': '# Synced\n',
  '.claude/skills/vars/SKILL.md': `Run ${pluginRoot}/run.sh\n`,
  '.claude/skills/bang/SKILL.md': 'KEY=!`cmd`\n',
  '.claude/skills/tools/SKILL.md': '---\nallowed-tools: AskUserQuestion\n---\n',
  '.claude/commands/schema.md': '---\nname: schema\n---\n',
  'plugins/p/skills/synced/SKILL.md': '# Synced\n',
  'plugins/p/skills/vars/SKILL.md': `Run ${pluginRoot}/run.sh\n`,
  'plugins/p/SKILL.md': `---\nname: p\n---\n\nRun ${pluginData}\n`,
  'plugins/q/.claude-plugin/plugin.json': JSON.stringify({ name: 'q' }),
  'plugins/m/.claude-plugin/plugin.json': JSON.stringify({ name: 'm', version: '1.0.0' }),
  'plugins/k/.claude-plugin/plugin.json': JSON.stringify({ name: 'k' }),
  'plugins/h/.claude-plugin/plugin.json': JSON.stringify({ name: 'h', hooks: { Stop: [] } }),
  'skills/listed/SKILL.md': '---\nname: listed\ndescription: d\n---\n',
  'skills/omitted/SKILL.md': '---\nname: omitted\ndescription: d\n---\n',
  'plugins/q/SKILL.md': '# Q\n',
  // One plugin for each rule of the manifest and layout layer (#11).
  // The executable is a component inside `.claude-plugin/`, and no rule reads the file.
  'plugins/loc/.claude-plugin/plugin.json': JSON.stringify({ name: 'loc' }),
  'plugins/loc/.claude-plugin/bin/tool': '',
  // The default `skills/` directory is in the `skills` key too. That entry is a report of
  // `plugin-skills-key-redundant-default`. Its loose file is a report of `skill-file-layout` only.
  // The loose file in `extra/` is a report of the manifest rule.
  'plugins/skl/.claude-plugin/plugin.json': JSON.stringify({
    name: 'skl',
    skills: ['./extra', './skills'],
  }),
  'plugins/skl/extra/loose.md': '# Loose\n',
  'plugins/skl/skills/loose.md': '# Loose\n',
  // A `commands` directory with no command in it.
  'plugins/cmd/.claude-plugin/plugin.json': JSON.stringify({ name: 'cmd', commands: './cmds' }),
  'plugins/cmd/cmds/.gitkeep': '',
  // A `commands` key that points out of the default `commands/` folder.
  'plugins/shadow/.claude-plugin/plugin.json': JSON.stringify({
    name: 'shadow',
    commands: ['./extras/c.md'],
  }),
  'plugins/shadow/commands/c.md': '# C\n',
  // A `package.json` with a lockfile that Claude Code skips.
  'plugins/lock/.claude-plugin/plugin.json': JSON.stringify({ name: 'lock' }),
  'plugins/lock/package.json': '{}',
  'plugins/lock/yarn.lock': '',
  // A file that a `.gitattributes` pattern sends to Git LFS.
  'plugins/lfs/.claude-plugin/plugin.json': JSON.stringify({ name: 'lfs' }),
  'plugins/lfs/.gitattributes': '*.bin filter=lfs diff=lfs merge=lfs -text\n',
  'plugins/lfs/model.bin': '',
  // Two plugins in a marketplace in a repository with a `.git`. The test makes a link in each one.
  // The link of `m` leads out of the marketplace, and the link of `n` leads to `m`. The marketplace
  // needs a `.git` above it, because a link out of the plugin has a target out of the repository
  // otherwise.
  'packages/l/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/l/shared/s.txt': 'shared\n',
  'packages/l/site/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'links',
    owner: { name: 'o' },
    plugins: [],
  }),
  'packages/l/site/plugins/m/.claude-plugin/plugin.json': JSON.stringify({ name: 'm' }),
  'packages/l/site/plugins/m/own.txt': 'own\n',
  'packages/l/site/plugins/n/.claude-plugin/plugin.json': JSON.stringify({ name: 'n' }),
  // A bare plugin variable in the body of a plugin skill, command and agent.
  'plugins/bare/.claude-plugin/plugin.json': JSON.stringify({ name: 'bare' }),
  'plugins/bare/skills/s/SKILL.md': '---\nname: s\n---\n\nRun $CLAUDE_PLUGIN_ROOT/run.sh\n',
  'plugins/bare/commands/c.md': 'Run $CLAUDE_PLUGIN_DATA/run.sh\n',
  'plugins/bare/agents/a.md':
    '---\nname: a\ndescription: d\n---\n\nRun $CLAUDE_PLUGIN_ROOT/run.sh\n',
  // A `${user_config.*}` reference in each field that a shell runs, in the manifest and in the
  // three default files.
  'plugins/ucf/.claude-plugin/plugin.json': JSON.stringify({
    name: 'ucf',
    hooks: { Stop: [{ hooks: [{ type: 'command', command: userConfigRef }] }] },
  }),
  'plugins/ucf/hooks/hooks.json': JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: 'command', command: userConfigRef }] }] },
  }),
  'plugins/ucf/.mcp.json': JSON.stringify({ mcpServers: { a: { headersHelper: userConfigRef } } }),
  'plugins/ucf/monitors/monitors.json': JSON.stringify([{ name: 'm', command: userConfigRef }]),
  // A monitor that reads a bare variable, in the manifest and in the default file.
  'plugins/env/.claude-plugin/plugin.json': JSON.stringify({
    name: 'env',
    monitors: [{ name: 'm', description: 'd', command: '$CLAUDE_PLUGIN_ROOT/m.sh' }],
  }),
  'plugins/env2/.claude-plugin/plugin.json': JSON.stringify({ name: 'env2' }),
  'plugins/env2/monitors/monitors.json': JSON.stringify([
    { name: 'm', description: 'd', command: 'tail -F $CLAUDE_PLUGIN_DATA/log' },
  ]),
  // A monitor command with the plugin root outside quotes, inline and in the monitors file.
  'plugins/mq/.claude-plugin/plugin.json': JSON.stringify({
    name: 'mq',
    monitors: [{ name: 'm', description: 'd', command: `node ${pluginRoot}/m.js` }],
  }),
  'plugins/mq2/.claude-plugin/plugin.json': JSON.stringify({ name: 'mq2' }),
  'plugins/mq2/monitors/monitors.json': JSON.stringify([
    { name: 'm', description: 'd', command: `tail -F ${pluginData}/log` },
  ]),
  // A plugin with a `postinstall` script in its `package.json`, and a `package.json` below it.
  'plugins/lc/.claude-plugin/plugin.json': JSON.stringify({ name: 'lc' }),
  'plugins/lc/package.json': JSON.stringify({ scripts: { postinstall: 'node setup.js' } }),
  'plugins/lc/sub/package.json': JSON.stringify({ scripts: { postinstall: 'node setup.js' } }),
  // A plugin with two lockfiles that Claude Code reads.
  'plugins/lch/.claude-plugin/plugin.json': JSON.stringify({ name: 'lch' }),
  'plugins/lch/package.json': '{}',
  'plugins/lch/bun.lock': '',
  'plugins/lch/package-lock.json': '',
  // A plugin with a theme file whose `base` is no preset.
  'plugins/th/.claude-plugin/plugin.json': JSON.stringify({ name: 'th' }),
  'plugins/th/themes/t.json': JSON.stringify({ name: 'T', base: 'bogus' }),
  // A marketplace in a repository with a `.git`, and a plugin that depends on a name that the
  // marketplace does not list.
  'packages/cxd/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/cxd/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'cx',
    owner: { name: 'o' },
    plugins: [
      { name: 'dep', source: './plugins/dep' },
      { name: 'pkg', source: { source: 'npm', package: '@acme/pkg' } },
    ],
  }),
  'packages/cxd/plugins/dep/.claude-plugin/plugin.json': JSON.stringify({
    name: 'dep',
    dependencies: ['ghost'],
  }),
  // A plugin that the marketplace serves from npm, with a `package.json` and no shrinkwrap.
  'packages/cxd/plugins/pkg/.claude-plugin/plugin.json': JSON.stringify({ name: 'pkg' }),
  'packages/cxd/plugins/pkg/package.json': '{}',
  // A plugin that depends on a plugin with a `command` source in the same marketplace, in a
  // repository with a `.git`.
  'packages/nai/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/nai/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'nai',
    owner: { name: 'o' },
    plugins: [
      { name: 'user', source: './plugins/user' },
      { name: 'minted', source: { source: 'command', command: 'mint-plugin' } },
    ],
  }),
  'packages/nai/plugins/user/.claude-plugin/plugin.json': JSON.stringify({
    name: 'user',
    dependencies: ['minted'],
  }),
  // A monitor that starts when a skill runs, in the manifest and in the default file. The plugin
  // has no such skill.
  'plugins/msk/.claude-plugin/plugin.json': JSON.stringify({
    name: 'msk',
    monitors: [{ name: 'm', description: 'd', command: 'run', when: 'on-skill-invoke:gone' }],
  }),
  'plugins/msk2/.claude-plugin/plugin.json': JSON.stringify({ name: 'msk2' }),
  'plugins/msk2/monitors/monitors.json': JSON.stringify([
    { name: 'm', description: 'd', command: 'run', when: 'on-skill-invoke:gone' },
  ]),
  // A plugin that sets `agent` in the manifest and in a root `settings.json`. The file wins, and
  // the plugin has no agent `b`.
  'plugins/set/.claude-plugin/plugin.json': JSON.stringify({
    name: 'set',
    settings: { agent: 'a' },
  }),
  'plugins/set/settings.json': JSON.stringify({ agent: 'b' }),
  // A `min` bound on a string option.
  'plugins/uca/.claude-plugin/plugin.json': JSON.stringify({
    name: 'uca',
    userConfig: { a: { type: 'string', title: 'T', description: 'D', min: 1 } },
  }),
  // The `off` plugin rules read these trees. A token option without `sensitive` reports in `strict`
  // only. The decoy sets it, or has no word of a token or a password.
  'plugins/ucs/.claude-plugin/plugin.json': JSON.stringify({
    name: 'ucs',
    userConfig: { api_token: { type: 'string', title: 'T', description: 'D' } },
  }),
  'plugins/ucs2/.claude-plugin/plugin.json': JSON.stringify({
    name: 'ucs2',
    userConfig: {
      api_token: { type: 'string', title: 'T', description: 'D', sensitive: true },
      tokenizer: { type: 'string', title: 'T', description: 'D' },
    },
  }),
  // A channel bound to a remote server reports in `strict` only. The decoy binds to a stdio server.
  'plugins/chs/.claude-plugin/plugin.json': JSON.stringify({
    name: 'chs',
    mcpServers: { tg: { url: 'https://chat.example.com/mcp' } },
    channels: [{ server: 'tg' }],
  }),
  'plugins/chs2/.claude-plugin/plugin.json': JSON.stringify({
    name: 'chs2',
    mcpServers: { tg: { command: 'node' } },
    channels: [{ server: 'tg' }],
  }),
  // A `bin/` file with the name of a system command reports in `strict` only. The decoy does not.
  'plugins/bsc/.claude-plugin/plugin.json': JSON.stringify({ name: 'bsc' }),
  'plugins/bsc/bin/git': '#!/bin/sh\n',
  'plugins/bsc2/.claude-plugin/plugin.json': JSON.stringify({ name: 'bsc2' }),
  'plugins/bsc2/bin/my-tool': '#!/bin/sh\n',
  // A `cli` entry with a space reports in `strict` only. The decoy has one command name.
  'packages/rsh/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'rsh',
    owner: { name: 'o' },
    plugins: [
      {
        name: 'tf',
        source: { source: 'github', repo: 'a/b' },
        relevance: { signals: { cli: ['terraform plan'] } },
      },
    ],
  }),
  'packages/rsh2/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'rsh2',
    owner: { name: 'o' },
    plugins: [
      {
        name: 'tf',
        source: { source: 'github', repo: 'a/b' },
        relevance: { signals: { cli: ['terraform'] } },
      },
    ],
  }),
  // A script that loads a marketplace root with `--plugin-dir` reports in `strict` only. The decoy
  // loads the plugin under it.
  'packages/dnm/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'dnm',
    owner: { name: 'o' },
    plugins: [{ name: 'p', source: { source: 'github', repo: 'a/b' } }],
  }),
  'packages/dnm/package.json': JSON.stringify({ scripts: { dev: 'claude --plugin-dir .' } }),
  'packages/dnm2/package.json': JSON.stringify({
    scripts: { dev: 'claude --plugin-dir ./plugins/p' },
  }),
  'packages/dnm2/plugins/p/.claude-plugin/plugin.json': JSON.stringify({ name: 'dnm2' }),
  // A monitor that writes under the plugin root reports in `strict` only. The decoy writes to the
  // data folder.
  'plugins/nsr/.claude-plugin/plugin.json': JSON.stringify({
    name: 'nsr',
    monitors: [{ name: 'm', description: 'd', command: `touch "\${CLAUDE_PLUGIN_ROOT}/x"` }],
  }),
  'plugins/nsr2/.claude-plugin/plugin.json': JSON.stringify({
    name: 'nsr2',
    monitors: [{ name: 'm', description: 'd', command: `touch "\${CLAUDE_PLUGIN_DATA}/x"` }],
  }),
  // A range that misses the pre-release version of its dependency reports in `strict` only. The
  // decoy has the suffix. The marketplace needs a `.git` above it.
  'packages/pr/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/pr/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'pr',
    owner: { name: 'o' },
    plugins: [
      { name: 'user', source: './plugins/user' },
      { name: 'dep', source: { source: 'npm', package: '@acme/dep' }, version: '2.0.0-beta.1' },
    ],
  }),
  'packages/pr/plugins/user/.claude-plugin/plugin.json': JSON.stringify({
    name: 'user',
    dependencies: [{ name: 'dep', version: '^2.0.0' }],
  }),
  'packages/pr2/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/pr2/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'pr2',
    owner: { name: 'o' },
    plugins: [
      { name: 'user', source: './plugins/user' },
      { name: 'dep', source: { source: 'npm', package: '@acme/dep' }, version: '2.0.0-beta.1' },
    ],
  }),
  'packages/pr2/plugins/user/.claude-plugin/plugin.json': JSON.stringify({
    name: 'user',
    dependencies: [{ name: 'dep', version: '^2.0.0-0' }],
  }),
  // A command entry with a field that the manifest reference does not list.
  'plugins/cmf/.claude-plugin/plugin.json': JSON.stringify({
    name: 'cmf',
    commands: { a: { content: 'x', bogus: 1 } },
  }),
  // A plugin with a backslash in a component path.
  'plugins/bsl/.claude-plugin/plugin.json': JSON.stringify({
    name: 'bsl',
    commands: ['./commands\\a.md'],
  }),
  // A reference to a sensitive option in a skill and an agent of a plugin. A command is not read.
  'plugins/sen/.claude-plugin/plugin.json': JSON.stringify({
    name: 'sen',
    userConfig: {
      token: { type: 'string', title: 'T', description: 'D', sensitive: true },
    },
  }),
  'plugins/sen/skills/s/SKILL.md': `---\nname: s\n---\n\n${tokenRef}`,
  'plugins/sen/agents/a.md': `---\nname: a\ndescription: d\n---\n\n${tokenRef}`,
  'plugins/sen/commands/c.md': tokenRef,
  // A repository with a `.git`, because the rule counts the directories below the repository.
  // The same plugin below `plugins/` is a decoy. A tree with no `.git` gets no report.
  'packages/ppl/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/ppl/.claude/plugins/p/.claude-plugin/plugin.json': JSON.stringify({ name: 'pp' }),
  'packages/ppl/plugins/p/.claude-plugin/plugin.json': JSON.stringify({ name: 'pp' }),
  '.claude/plugins/q/.claude-plugin/plugin.json': JSON.stringify({ name: 'q' }),
  // A plugin in `.claude/skills/` that declares a monitor and an MCP bundle. The same manifest
  // in a plugin outside `.claude/skills/`, and one level too deep, is a decoy.
  '.claude/skills/sp/.claude-plugin/plugin.json': JSON.stringify({
    name: 'sp',
    mcpServers: './server.mcpb',
    monitors: [],
  }),
  '.claude/skills/deep/sp/.claude-plugin/plugin.json': JSON.stringify({
    name: 'sp',
    mcpServers: './server.mcpb',
    monitors: [],
  }),
  'plugins/sp/.claude-plugin/plugin.json': JSON.stringify({
    name: 'sp',
    mcpServers: './server.mcpb',
    monitors: [],
  }),
  '.claude/skills/loose.md': '# Loose\n',
  '.claude/skills/layout/skill.md': '# Wrong case\n',
  '.claude/skills/ref/SKILL.md': '[a](missing.md)\n',
  '.claude/skills/ref-ok/SKILL.md': '[a](reference.md)\n',
  '.claude/skills/ref-ok/reference.md': '# Reference\n',
  '.claude/skills/agent/SKILL.md': '---\ncontext: fork\nagent: ghost\n---\n',
  '.claude/skills/agent-ok/SKILL.md': '---\ncontext: fork\nagent: Explore\n---\n',
  '.claude/commands/ghost.md': '---\ncontext: fork\nagent: ghost\n---\n',
  '.claude/skills/twin-a/SKILL.md': '---\nname: twin\n---\n',
  '.claude/skills/twin-b/SKILL.md': '---\nname: Twin\n---\n',
  'packages/x/.claude/skills/twin/SKILL.md': '# Twin\n',
  '.claude/skills/glob/SKILL.md': '---\npaths: "photos [2024/**"\n---\n',
  '.claude/skills/glob-ok/SKILL.md':
    '---\npaths:\n  - "src/**/*.{ts,tsx}"\n  - "photos \\\\[2024/**"\n---\n',
  // One bad tool list for each rule of the tool-list layer, in a skill, a command and an agent.
  '.claude/skills/grammar/SKILL.md':
    '---\nallowed-tools:\n  - Bash(\n  - bogus\n  - B*\n  - WebSearch(x)\n  - Write(docs/**)\n  - mcp__a(x)\ndisallowed-tools: Bash(command:x)\n---\n',
  '.claude/commands/allowed.md': '---\nallowed-tools: Bogus\n---\n',
  'plugins/p/commands/allowed.md': '---\nallowed-tools: Bogus\n---\n',
  '.claude/skills/broad/SKILL.md': '---\nallowed-tools: Bash\n---\n',
  '.claude/skills/skill-rule/SKILL.md': '---\nallowed-tools: Skill(anthropic *)\n---\n',
  // The grammar rules do not read the tool lists of a subagent. `agent-tools-known` does.
  '.claude/agents/tools.md': '---\nname: t\ndescription: d\ntools: Read(\n---\n',
  'plugins/p/agents/tools.md': '---\nname: t\ndescription: d\ntools: Bogus\n---\n',
  '.claude/agents/unavailable.md': '---\nname: u\ndescription: d\ntools: AskUserQuestion\n---\n',
  // The same content in files that no rule reads, so no report.
  'docs/commands/c.md': '# Not a command\n',
  'docs/readme.md': '# Other Markdown\n',
  'docs/SKILL.md': `\n---\nmade_up: 1\nagent: Plan\nallowed-tools: AskUserQuestion Bash Skill(anthropic *) Bogus(\n---\nKEY=!\`cmd\` ${pluginRoot}\n`,
  '.claude/agents/a.md': `---\nname: a\ndescription: ${long}\n---\n`,
  // The warn rules of #50, layer 1: one bad file for each, and the same fault where the rule is
  // silent. `skill-no-bom` and `skill-boolean-literal` are inactive in the presets, so their files
  // give no report here. The mark is the first character of the three files that start with `\ufeff`.
  '.claude/skills/bom/SKILL.md': '\ufeff---\nname: bom\ndescription: d\n---\n',
  '.claude/commands/cbom.md': '\ufeff---\ndescription: d\n---\n',
  'docs/bom/SKILL.md': '\ufeff---\nname: bom\ndescription: d\n---\n',
  '.claude/skills/bool/SKILL.md': '---\ndescription: d\ndisable-model-invocation: yes\n---\n',
  '.claude/skills/bool-ok/SKILL.md':
    '---\ndescription: d\ndisable-model-invocation: true\nuser-invocable: true\n---\n',
  '.claude/skills/meta/SKILL.md': '---\ndescription: d\nmetadata:\n  paths: src\n---\n',
  '.claude/skills/meta-ok/SKILL.md': '---\ndescription: d\nmetadata:\n  team: web\n---\n',
  '.claude/skills/redundant/SKILL.md':
    '---\ndescription: d\ndisable-model-invocation: true\nwhen_to_use: x\n---\n',
  '.claude/skills/redundant-ok/SKILL.md':
    '---\ndescription: d\ndisable-model-invocation: true\nargument-hint: x\n---\n',
  '.claude/skills/no-description/SKILL.md': '---\nname: no-description\n---\n',
  '.claude/skills/shadow/SKILL.md': '---\nname: clear\ndescription: d\n---\n',
  '.claude/skills/shadow-ok/SKILL.md': '---\nname: shadow-ok\ndescription: d\n---\n',
  'plugins/p/skills/clear/SKILL.md': '---\ndescription: d\n---\n',
  // The command files of the same rules. `model` is a built-in command, and `model` is a frontmatter
  // field.
  '.claude/commands/model.md': '---\ndescription: d\n---\n',
  '.claude/commands/cmeta.md': '---\ndescription: d\nmetadata:\n  model: x\n---\n',
  // The warn rules of #50, layer 2. `skill-plugin-name-prefix` and `skill-shell-platform` are
  // inactive in the presets, so their files give no report here. The files of the others are
  // bad, and each has a silent twin. `plugins/q/SKILL.md` above has no `name`.
  '.claude/skills/escape/SKILL.md': '---\ndescription: d\n---\n\nPrice \\\\$1.00\n',
  '.claude/skills/escape-ok/SKILL.md': '---\ndescription: d\n---\n\nPrice \\$1.00\n',
  '.claude/commands/cescape.md': '---\ndescription: d\n---\n\nRun \\\\$ARGUMENTS\n',
  '.claude/skills/long/SKILL.md': `---\ndescription: d\n---\n${'line\n'.repeat(497)}`,
  '.claude/skills/short/SKILL.md': `---\ndescription: d\n---\n${'line\n'.repeat(496)}`,
  'plugins/p/skills/prefixed/SKILL.md': '---\nname: p:prefixed\ndescription: d\n---\n',
  '.claude/skills/shell/SKILL.md': '---\ndescription: d\nshell: powershell\n---\n\n!`date`\n',
  // The `off` skill rules of #50, layer 3. Each has its own scope under `packages/`, so that the
  // files above stay out of its count. The rules report in `strict` only. A silent twin sits
  // beside each bad file, and a file that is no skill or command file sits beside it too.
  // Six skills of 1,537 characters (a name and a description of 1,536) are over 8,000.
  ...Object.fromEntries(
    ['a', 'b', 'c', 'd', 'e', 'f'].map((folder) => [
      `packages/lb/.claude/skills/${folder}/SKILL.md`,
      `---\ndescription: ${'a'.repeat(1536)}\n---\n`,
    ]),
  ),
  // A body of 20,001 characters is 5,001 tokens, and 20,000 characters are 5,000.
  'packages/bt/.claude/skills/big/SKILL.md': `---\ndescription: d\n---\n${'a'.repeat(20001)}`,
  'packages/bt/.claude/skills/edge/SKILL.md': `---\ndescription: d\n---\n${'a'.repeat(20000)}`,
  'packages/bt/.claude/commands/cbig.md': `---\ndescription: d\n---\n${'a'.repeat(20001)}`,
  'packages/bt/docs/SKILL.md': 'a'.repeat(20001),
  'packages/bt/notes.md': 'a'.repeat(20001),
  // An amount that Claude Code reads as an argument, and the escaped amount.
  'packages/ld/.claude/skills/price/SKILL.md': '---\ndescription: d\n---\n\nPrice $1.00\n',
  'packages/ld/.claude/skills/price-ok/SKILL.md': '---\ndescription: d\n---\n\nPrice \\$1.00\n',
  'packages/ld/.claude/commands/cprice.md': '---\ndescription: d\n---\n\nPrice $1.00\n',
  'packages/ld/notes.md': 'Price $1.00\n',
  // An unbraced plugin variable in a plugin skill. A command file, a skill outside a plugin and
  // the braced form are silent.
  'packages/pw/.claude-plugin/plugin.json': JSON.stringify({ name: 'pw' }),
  'packages/pw/skills/bad/SKILL.md': '---\ndescription: d\n---\n\nRun $CLAUDE_PLUGIN_ROOT/run.sh\n',
  'packages/pw/skills/ok/SKILL.md': `---\ndescription: d\n---\n\nRun ${pluginRoot}/run.sh\n`,
  'packages/pw/commands/cbad.md': '---\ndescription: d\n---\n\nRun $CLAUDE_PLUGIN_ROOT/run.sh\n',
  'packages/pw/other/.claude/skills/bad/SKILL.md':
    '---\ndescription: d\n---\n\nRun $CLAUDE_PLUGIN_ROOT/run.sh\n',
  // An injected command that no `allowed-tools` rule matches, and the same command with a rule.
  'packages/ir/.claude/skills/bad/SKILL.md': '---\ndescription: d\n---\n\n!`npm test`\n',
  'packages/ir/.claude/skills/ok/SKILL.md':
    '---\ndescription: d\nallowed-tools: Bash(npm *)\n---\n\n!`npm test`\n',
  'packages/ir/.claude/commands/cbad.md': '---\ndescription: d\n---\n\n!`npm test`\n',
  'packages/ir/notes.md': '!`npm test`\n',
  // The `off` skill rules of #50, layer 4. A skill that Claude can invoke and has a side effect, and
  // the same skill with `disable-model-invocation: true`.
  'packages/se/.claude/skills/push/SKILL.md':
    '---\ndescription: d\nallowed-tools: Bash(git push *)\n---\n',
  'packages/se/.claude/skills/push-ok/SKILL.md':
    '---\ndescription: d\ndisable-model-invocation: true\nallowed-tools: Bash(git push *)\n---\n',
  'packages/se/.claude/commands/cpush.md': '---\ndescription: d\n---\n\n!`git push`\n',
  'packages/se/notes.md': '!`git push`\n',
  // A `model` other than `inherit`, and `inherit`.
  'packages/mo/.claude/skills/opus/SKILL.md': '---\ndescription: d\nmodel: opus\n---\n',
  'packages/mo/.claude/skills/inherit/SKILL.md': '---\ndescription: d\nmodel: inherit\n---\n',
  'packages/mo/.claude/commands/cmodel.md': '---\ndescription: d\nmodel: opus\n---\n',
  'packages/mo/notes.md': '---\nmodel: opus\n---\n',
  // A `loop.md` that starts with a skill that only the user can invoke, and one that starts with a
  // skill that Claude can invoke. A file of that name elsewhere is not read.
  'packages/lr/.claude/loop.md': '/deploy now\n',
  'packages/lr/.claude/skills/deploy/SKILL.md':
    '---\ndescription: d\ndisable-model-invocation: true\n---\n',
  'packages/lq/.claude/loop.md': '/check now\n',
  'packages/lq/.claude/skills/check/SKILL.md': '---\ndescription: d\n---\n',
  'packages/lr/notes/loop.md': '/deploy now\n',
  // One bad file for each agent and output style rule, and the same fault where it is silent.
  '.claude/agents/valid.md': '---\nname: v\n---\n',
  '.claude/agents/schema.md': '---\nname: s\ndescription: d\nmade_up: 1\n---\n',
  '.claude/agents/bypass.md':
    '---\nname: b\ndescription: d\npermissionMode: bypassPermissions\n---\n',
  '.claude/agents/mcp.md': '---\nname: m\ndescription: d\nmcpServers: github\n---\n',
  '.claude/agents/memory.md': '---\nname: y\ndescription: d\nmemory: project\ntools: Read\n---\n',
  'plugins/p/agents/ignored.md': '---\nname: i\ndescription: d\npermissionMode: plan\n---\n',
  'plugins/p/agents/schema.md': '---\nname: s\ndescription: d\nmade_up: 1\n---\n',
  'plugins/p/agents/no-name.md': '---\ndescription: A plugin agent without a name loads.\n---\n',
  // The subagent field warn rules: a reporting file for each rule, the same fault in a plugin
  // agent where the rule is silent, and in a folder that no rule reads. The two version rules
  // report only once `minVersion` is set, so the test below sets it.
  '.claude/agents/shadow.md': '---\nname: Explore\ndescription: d\n---\n',
  '.claude/agents/conditional.md': '---\nname: c\ndescription: d\ntools: Read, CronCreate\n---\n',
  '.claude/agents/disallowed.md':
    '---\nname: dis\ndescription: d\ndisallowedTools: Bash(git push *)\n---\n',
  '.claude/agents/task-alias.md': '---\nname: ta\ndescription: d\ntools: Task(worker), Read\n---\n',
  '.claude/agents/inline.md':
    '---\nname: i\ndescription: d\nmcpServers:\n  - pw:\n      type: stdio\n      command: npx\n---\n',
  '.claude/agents/bom.md': '\uFEFF---\nname: bom\ndescription: d\n---\n',
  '.claude/agents/versions.md': '---\nname: ver\ndescription: d\nomitClaudeMd: true\n---\n',
  'plugins/p/agents/shadow.md': '---\nname: Explore\ndescription: d\n---\n',
  'plugins/p/agents/conditional.md': '---\nname: c\ndescription: d\ntools: Read, CronCreate\n---\n',
  'plugins/p/agents/inline.md':
    '---\nname: i\ndescription: d\nmcpServers:\n  - pw:\n      type: stdio\n      command: npx\n---\n',
  'plugins/p/agents/bom.md': '\uFEFF---\nname: bom\ndescription: d\n---\n',
  'plugins/p/agents/versions.md': '---\nname: ver\ndescription: d\nomitClaudeMd: true\n---\n',
  'docs/agents/warn.md':
    '\uFEFF---\nname: Explore\ntools: CronCreate, Task\ndisallowedTools: Bash(x)\nomitClaudeMd: true\nmcpServers:\n  - pw:\n      command: npx\n---\n',
  '.claude/output-styles/yaml.md': '---\nname: [unclosed\n---\n',
  '.claude/output-styles/schema.md': '---\nforce-for-plugin: true\n---\n',
  'plugins/p/output-styles/forced.md': '---\nforce-for-plugin: true\n---\n',
  // The cross-file agent rules: one scope with settings, two agents of one name, a skill that
  // a subagent cannot preload, and one clean agent.
  'packages/z/.claude/settings.json':
    '{"agent":"boss","autoMemoryEnabled":false,"env":{"CLAUDE_CODE_SUBAGENT_MODEL_FORCE":"1"}}',
  'packages/z/.claude/agents/boss.md':
    '---\nname: boss\ndescription: d\nmodel: sonnet\nmemory: project\nomitClaudeMd: true\n---\n',
  'packages/z/.claude/agents/dup1.md': '---\nname: dup\ndescription: d\n---\n',
  'packages/z/.claude/agents/dup2.md': '---\nname: dup\ndescription: d\n---\n',
  'packages/z/.claude/agents/preload.md':
    '---\nname: preload\ndescription: d\nskills:\n  - hidden\n---\n',
  'packages/z/.claude/agents/clean.md': '---\nname: clean\ndescription: d\n---\n',
  'packages/z/.claude/skills/hidden/SKILL.md':
    '---\nname: hidden\ndescription: d\ndisable-model-invocation: true\n---\n',
  '.claude/teams/teams.json': '{}',
  '.claude/teams/team.md': '# Team\n',
  '.claude/teams/team.yaml': 'members: []\n',
  '.claude/teams/sub/x.json': '{}',
  'packages/x/.claude/teams/x.md': '# Team\n',
  '.claude/agents/review/deep/n.md':
    '---\nname: n\ndescription: d\npermissionMode: bypassPermissions\n---\n',
  'plugins/p/agents/sub/n.md': '---\nname: n\ndescription: d\npermissionMode: plan\n---\n',
  'docs/agents/a.md':
    '---\nmade_up: 1\npermissionMode: bypassPermissions\ntools: AskUserQuestion, Bogus\n---\n',
  'docs/output-styles/s.md': '---\nname: [unclosed\nforce-for-plugin: true\n---\n',
  // The name rules of the agent and output style group: a reporting file for each rule, and the
  // same fault where the rule is silent. `packages/sh` has a `.git`, so the rules that read the
  // folders above can walk up to it. In the rest of the tree the bound is the `.claude/` folder.
  '.claude/agents/manual.md': '---\nname: man\ndescription: d\npermissionMode: manual\n---\n',
  'plugins/p/agents/manual.md': '---\nname: man\ndescription: d\npermissionMode: manual\n---\n',
  '.claude/agents/scope.md': '---\nname: sc\ndescription: d\nmemory: user\n---\n',
  '.claude/agents/scope-project.md': '---\nname: scp\ndescription: d\nmemory: project\n---\n',
  'plugins/p/agents/scope.md': '---\nname: sc\ndescription: d\nmemory: local\n---\n',
  'plugins/p/agents/clash-a.md': '---\nname: clash-b\ndescription: d\n---\n',
  'plugins/p/agents/clash-b.md': '---\ndescription: d\n---\n',
  // The same rules over a subfolder of `agents/`, which the globs of the four rules must reach.
  '.claude/agents/review/deep/deep-manual.md':
    '---\nname: dm\ndescription: d\npermissionMode: manual\n---\n',
  '.claude/agents/review/deep/deep-scope.md': '---\nname: ds\ndescription: d\nmemory: user\n---\n',
  'plugins/p/agents/sub/d.md': '---\ndescription: d\n---\n',
  'plugins/p/agents/sub/e.md': '---\nname: d\ndescription: d\n---\n',
  'packages/sh/.claude/agents/deepdup.md': '---\nname: deepdup\ndescription: d\n---\n',
  'packages/sh/pkg/.claude/agents/sub/deepdup.md': '---\nname: deepdup\ndescription: d\n---\n',
  'packages/sh/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/sh/.claude/agents/layered.md': '---\nname: layered\ndescription: d\n---\n',
  'packages/sh/pkg/.claude/agents/layered.md': '---\nname: layered\ndescription: d\n---\n',
  'packages/sh/pkg/.claude/agents/solo.md': '---\nname: solo\ndescription: d\n---\n',
  // The `off` agent rules report in `strict` only. `packages/o` is a repository of its own, with
  // a `.git` entry, so each rule reads this folder and nothing above it. Without `.git`, the
  // repository would end at `.claude/`, and `.mcp.json` would be out of it. Each reporting file
  // has a silent twin.
  'packages/o/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/o/.claude/settings.json': '{"agent":"main"}',
  'packages/o/.mcp.json':
    '{"mcpServers":{"github":{"type":"http","url":"https://mcp.example.com/mcp"}}}',
  'packages/o/.claude/skills/real/SKILL.md': '---\nname: real\ndescription: d\n---\n\nBody\n',
  'packages/o/.claude/agents/skill-tool.md':
    '---\nname: skill-tool\ndescription: d\ntools: Read, Skill\n---\n',
  'packages/o/.claude/agents/skill-tool-ok.md':
    '---\nname: skill-tool-ok\ndescription: d\ntools: Read, Skill\nskills:\n  - real\n---\n',
  'packages/o/.claude/agents/model.md': '---\nname: model\ndescription: d\nmodel: sonet\n---\n',
  'packages/o/.claude/agents/model-ok.md':
    '---\nname: model-ok\ndescription: d\nmodel: opus\n---\n',
  'plugins/p/agents/model.md': '---\nname: model\ndescription: d\nmodel: sonet\n---\n',
  'packages/o/.claude/agents/prompt.md':
    '---\nname: prompt\ndescription: d\ninitialPrompt: Review the diff\n---\n',
  'packages/o/.claude/agents/main.md':
    '---\nname: main\ndescription: d\ninitialPrompt: Review the diff\ntools: Agent(ghost), Read\n---\n',
  'packages/o/.claude/agents/typelist.md':
    '---\nname: typelist\ndescription: d\ntools: Agent(worker), Read\n---\n',
  'plugins/p/agents/typelist.md':
    '---\nname: typelist\ndescription: d\ntools: Agent(worker), Read\n---\n',
  'packages/o/.claude/agents/skills.md':
    '---\nname: skills\ndescription: d\nskills:\n  - ghost\n---\n',
  'packages/o/.claude/agents/mcp-ref.md':
    '---\nname: mcp-ref\ndescription: d\nmcpServers:\n  - ghost\n---\n',
  'packages/o/.claude/agents/mcp-ok.md':
    '---\nname: mcp-ok\ndescription: d\nmcpServers:\n  - github\n---\n',
  // The same faults in a file that no rule reads.
  'docs/agents/off.md':
    '---\nname: off\ndescription: d\nmodel: sonet\ninitialPrompt: Go\ntools: Skill, Agent(ghost)\nskills:\n  - ghost\n---\n',
  'packages/sh/.claude/output-styles/layered.md': '---\nname: layered\n---\n',
  'packages/sh/pkg/.claude/output-styles/layered.md': '---\nname: layered\n---\n',
  '.claude/output-styles/twin-a.md': '---\nname: twin\n---\n',
  '.claude/output-styles/twin-b.md': '---\nname: twin\n---\n',
  'plugins/p/output-styles/clean.md': '---\nname: clean\ndescription: d\n---\n',
  'plugins/p/output-styles/bare.md': '# Bare\n',
  // One bad marketplace file with each fault of the marketplace rules, one in a
  // nested directory, and the same content where no rule reads it.
  '.claude-plugin/marketplace.json': badMarketplace,
  'packages/m/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'inline',
    owner: { name: 'm' },
    plugins: [],
  }),
  // A `plugin.json` beside that marketplace, which lists no entry for the root.
  'packages/m/.claude-plugin/plugin.json': JSON.stringify({ name: 'inline' }),
  // A marketplace that the project settings register as a `url` source, with a relative source.
  'packages/uh/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'hosted',
    owner: { name: 'uh' },
    plugins: [{ name: 'p', source: './p' }],
  }),
  'packages/uh/p/README.md': '# P\n',
  'packages/uh/.claude/settings.json': hostedSettings,
  'packages/uh/.claude/settings.local.json': hostedSettings,
  // The same registration where no rule reads it: the settings of another directory.
  'packages/uh/other/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'hosted',
    owner: { name: 'uh' },
    plugins: [{ name: 'p', source: './p' }],
  }),
  'packages/uh/other/p/README.md': '# P\n',
  // A literal header credential in an entry and in a `url` source. Only the files named in the
  // glob are read.
  'packages/hc/.claude-plugin/marketplace.json': credentialMarketplace,
  'packages/hc/other.json': credentialMarketplace,
  'packages/hc/.claude/settings.json': credentialSettings,
  'packages/hc/.claude/settings.local.json': credentialSettings,
  'packages/hc/.claude/nested/settings.json': credentialSettings,
  'packages/hc/.vscode/settings.json': credentialSettings,
  'packages/hc/settings.json': credentialSettings,
  // A marketplace in a repository with a `.git`, where `plugins/p` is a link to a directory out of
  // the marketplace root. The test makes the link. The tree above has no `.git`, so no link there
  // gives a report.
  'packages/s/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/s/shared/p/.claude-plugin/plugin.json': JSON.stringify({ name: 'p' }),
  'packages/s/site/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'site',
    owner: { name: 's' },
    plugins: [{ name: 'p', source: './plugins/p' }],
  }),
  // Beside the marketplace with the link, so a glob wider than the directory would read it.
  'packages/s/site/docs/marketplace.json': JSON.stringify({
    name: 'site',
    owner: { name: 's' },
    plugins: [{ name: 'p', source: './plugins/p' }],
  }),
  'docs/marketplace.json': badMarketplace,
  'marketplace.json': badMarketplace,
  // The settings rules of #12 read the two project settings files, and no other settings file.
  // A valid marketplace, which the cross-file settings rules read from the settings files.
  'packages/mk/.claude/market/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'acme-market',
    owner: { name: 'mk' },
    plugins: [{ name: 'fmt', source: { source: 'github', repo: 'acme/fmt' } }],
  }),
  'packages/mk/.claude/settings.json': badMarketSettings,
  'packages/mk/.claude/settings.local.json': badMarketSettings,
  'packages/mk/.claude/nested/settings.json': badMarketSettings,
  'packages/mk/.claude/nested/settings.local.json': badMarketSettings,
  'packages/mk/.vscode/settings.json': badMarketSettings,
  'packages/mk/.vscode/settings.local.json': badMarketSettings,
  'packages/mk/settings.json': badMarketSettings,
  '.claude-plugin/other.json': badMarketplace,
  'other.json': badHooks,
  // The hooks rules of layer 1 read the settings files, the managed files, the `hooks.json` of a
  // plugin, and the frontmatter of a skill and a project subagent. The same content where no rule
  // reads it: a hidden drop-in, another extension, a nested directory, and another settings file.
  'packages/hk/.claude/settings.json': hooksSettings,
  'packages/hk/.claude/settings.local.json': hooksSettings,
  'packages/hk/managed-settings.json': hooksSettings,
  'packages/hk/managed-settings.d/10-a.json': hooksDropIn,
  'packages/hk/managed-settings.d/.20-hidden.json': hooksSettings,
  'packages/hk/managed-settings.d/30-b.txt': hooksSettings,
  'packages/hk/managed-settings.d/sub/40-c.json': hooksSettings,
  'packages/hk/.vscode/settings.json': hooksSettings,
  'packages/hk/plugin/hooks/hooks.json': JSON.stringify({ hooks: hooksFaults }),
  'packages/hk/.claude/skills/hk/SKILL.md': hooksYaml,
  // A script with no shebang line, which the hook of `hooksFaults` runs.
  'packages/hk/scripts/plain.sh': 'echo hi\n',
  'packages/hk/.claude/agents/hk.md': hooksYaml.replace('name: hk', 'name: hk\ndescription: d'),
  // `hooks-duplicate-handler`: one handler in a settings file, in `hooks/hooks.json` and in `plugin.json`.
  // The local settings file holds it too, and is not the later source. A `plugin.json` outside
  // `.claude-plugin/` is no manifest.
  'packages/dup/.claude/settings.json': dupHooks,
  'packages/dup/.claude/settings.local.json': dupHooks,
  'packages/dup/hooks/hooks.json': dupHooks,
  'packages/dup/.claude-plugin/plugin.json': dupManifest,
  'packages/dup/docs/plugin.json': dupManifest,
  // `disableAllHooks: false` is reported in the project file only (`hooks-disable-all-override`).
  'packages/dh/.claude/settings.json': '{"disableAllHooks": false}',
  'packages/dh/.claude/settings.local.json': '{"disableAllHooks": false}',
  'packages/dh/managed-settings.json': '{"disableAllHooks": false}',
  'packages/hk/.claude/skills/ev/SKILL.md': unknownEventYaml,
  'packages/hk/.claude/agents/ev.md': unknownEventYaml.replace(
    'name: ev',
    'name: ev\ndescription: d',
  ),
  'packages/hk/docs/SKILL.md': hooksYaml,
  'packages/hk/docs/agents/hk.md': hooksYaml,
  // Hooks files that Claude Code does not read, and a decoy that is no hooks file.
  'packages/hk/.claude/hooks.json': '{}',
  // The unknown event in the standalone file is not reported: Claude Code does not read the file.
  'packages/hk/.claude/hooks/hooks.json': badHooks,
  'packages/hk/.claude-plugin/hooks.json': '{}',
  'packages/hk/docs/hooks.json': '{}',
  'packages/ho/.claude/settings.json': JSON.stringify({ hooks: outputHooks }),
  'packages/ho/scripts/deny.sh': '#!/bin/bash\necho "Blocked" >&2\nexit 1\n',
  'packages/ho/scripts/stop.sh': '#!/bin/bash\necho "Run the tests" >&2\nexit 2\n',
  'hooks.json': badHooks,
  '.vscode/settings.json': badSettings,
  '.vscode/settings.local.json': badSettings,
  // The settings rules of the scope layer of #14. A top level that is not an object, in the
  // two project files and in the same files in a decoy directory.
  'packages/vj/.claude/settings.json': '[1]',
  'packages/vj/.claude/settings.local.json': '"x"',
  'packages/vj/.vscode/settings.json': '[1]',
  // A file of 2 MiB and 8 bytes, in each place the size rule reads, and in places it does not.
  'packages/big/.claude/settings.json': big,
  'packages/big/.claude/settings.local.json': big,
  'packages/big/managed-settings.json': big,
  'packages/big/managed-settings.d/30-big.json': big,
  'packages/big/managed-settings.d/30-big.txt': big,
  'packages/big/managed-settings.d/sub/40-big.json': big,
  'packages/big/.vscode/settings.json': big,
  // `settings-key-scope`: a Managed key in the project file, and a User, local, or managed key in
  // the local file, which is allowed there. A Global config key in a managed file, and a Managed
  // key in a drop-in, which is allowed there. The same keys where no rule reads them.
  'packages/sc/.claude/settings.json': '{"allowManagedHooksOnly": true}',
  'packages/sc/.claude/settings.local.json': '{"skipDangerousModePermissionPrompt": true}',
  'packages/sc/managed-settings.json': '{"autoConnectIde": true}',
  'packages/sc/managed-settings.d/10-a.json': '{"allowManagedHooksOnly": true}',
  'packages/sc/managed-settings.d/20-b.txt': '{"autoConnectIde": true}',
  'packages/sc/managed-settings.d/sub/30-c.json': '{"autoConnectIde": true}',
  'packages/sc/managed-settings.json.bak': '{"autoConnectIde": true}',
  'packages/sc/.vscode/settings.json': '{"autoConnectIde": true}',
  // `settings-managed-file`: a top level that is an array, a hidden drop-in, and
  // "merge" in `managed-settings.json`. A drop-in with a policy key is silent, and so is a drop-in
  // with only a control key.
  // The same content where no rule reads it: another extension, a nested directory, and a
  // project settings file.
  'packages/mf/managed-settings.json': '[1]',
  'packages/mf/managed-settings.d/10-ctl.json': '{"managedSourcesBehavior": "first-wins"}',
  'packages/mf/managed-settings.d/.20-hidden.json': '{"model": "opus"}',
  'packages/mf/managed-settings.d/30-ok.json': '{"model": "opus"}',
  'packages/mf/managed-settings.d/40-x.txt': '[1]',
  'packages/mf/managed-settings.d/sub/50-y.json': '[1]',
  'packages/mf/.claude/settings.local.json': '[1]',
  // Only control keys in `managed-settings.json`, and no policy drop-in beside it.
  'packages/mf3/managed-settings.json': '{"wslInheritsWindowsSettings": true}',
  'packages/mf3/managed-settings.d/10-ctl.json': '{"managedSourcesBehavior": "first-wins"}',
  'packages/mf2/managed-settings.json': '{"managedSourcesBehavior": "merge", "model": "opus"}',
  'packages/mf2/managed-settings.d/10-m.json':
    '{"managedSourcesBehavior": "merge", "model": "opus"}',
  // The settings rules of the env layer of #14. `settings-removed-key`: a key with no effect in
  // each file that it reads. `permissionExplainerEnabled` is also a Global config key, and gets
  // one report, from this rule. `disableArtifact: false` in a managed file, and a key with its
  // replacement in a drop-in. A hidden drop-in is for `settings-managed-file`. The same content
  // where no rule reads it: another extension, a nested directory, and another settings file.
  'packages/rk/.claude/settings.json': '{"taskOutputMaxChars": 1}',
  'packages/rk/.claude/settings.local.json': '{"permissionExplainerEnabled": false}',
  'packages/rk/managed-settings.json': '{"disableArtifact": false}',
  'packages/rk/managed-settings.d/10-a.json': '{"voiceEnabled": true, "voice": {"enabled": true}}',
  'packages/rk/managed-settings.d/.20-hidden.json': '{"taskOutputMaxChars": 1}',
  'packages/rk/managed-settings.d/30-b.txt': '{"taskOutputMaxChars": 1}',
  'packages/rk/managed-settings.d/sub/40-c.json': '{"taskOutputMaxChars": 1}',
  'packages/rk/.vscode/settings.json': '{"taskOutputMaxChars": 1}',
  // `settings-env-credential`: a credential variable, and a credential header line, in each
  // file that it reads. A hidden drop-in is for `settings-managed-file`. The same content where
  // no rule reads it: another extension, a nested directory, and another settings file.
  'packages/ec/.claude/settings.json': '{"env": {"ANTHROPIC_API_KEY": "sk-x"}}',
  'packages/ec/.claude/settings.local.json':
    '{"env": {"ANTHROPIC_CUSTOM_HEADERS": "X-Api-Key: x"}}',
  'packages/ec/managed-settings.json': '{"env": {"CLAUDE_CODE_OAUTH_TOKEN": "x"}}',
  'packages/ec/managed-settings.d/10-a.json': '{"env": {"ANTHROPIC_AUTH_TOKEN": "x"}}',
  'packages/ec/managed-settings.d/.20-hidden.json': '{"env": {"ANTHROPIC_API_KEY": "x"}}',
  'packages/ec/managed-settings.d/30-b.txt': '{"env": {"ANTHROPIC_API_KEY": "x"}}',
  'packages/ec/managed-settings.d/sub/40-c.json': '{"env": {"ANTHROPIC_API_KEY": "x"}}',
  'packages/ec/.vscode/settings.json': '{"env": {"ANTHROPIC_API_KEY": "x"}}',
  // `settings-env-value-format`: an `env` that is not an object, a value that is not a string,
  // and a known variable with a value that breaks its form, in each file that it reads. A hidden
  // drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/ef/.claude/settings.json': '{"env": []}',
  'packages/ef/.claude/settings.local.json': '{"env": {"FOO": 1}}',
  'packages/ef/managed-settings.json': '{"env": {"ENABLE_TOOL_SEARCH": "maybe"}}',
  'packages/ef/managed-settings.d/10-a.json': '{"env": {"BASH_MAX_OUTPUT_LENGTH": "200000"}}',
  'packages/ef/managed-settings.d/.20-hidden.json': '{"env": []}',
  'packages/ef/managed-settings.d/30-b.txt': '{"env": []}',
  'packages/ef/managed-settings.d/sub/40-c.json': '{"env": []}',
  'packages/ef/.vscode/settings.json': '{"env": []}',
  // `settings-env-ignored-var`: a variable that is ignored in every file, in a project file, and
  // a removed variable. A project-only variable is silent in a managed file. A hidden drop-in is
  // for `settings-managed-file`. The same content where no rule reads it.
  'packages/ei/.claude/settings.json': '{"env": {"CLAUDE_CONFIG_DIR": "/x"}}',
  'packages/ei/.claude/settings.local.json': '{"env": {"OTEL_LOGS_EXPORTER": "otlp"}}',
  'packages/ei/managed-settings.json': '{"env": {"CLAUDE_CODE_REMOTE": "1", "HOME": "/x"}}',
  'packages/ei/managed-settings.d/10-a.json': '{"env": {"TASK_MAX_OUTPUT_LENGTH": "1"}}',
  'packages/ei/managed-settings.d/20-b.json':
    '{"env": {"HOME": "/x", "OTEL_LOGS_EXPORTER": "otlp"}}',
  'packages/ei/managed-settings.d/.30-hidden.json': '{"env": {"CLAUDE_CODE_REMOTE": "1"}}',
  'packages/ei/managed-settings.d/40-c.txt': '{"env": {"CLAUDE_CODE_REMOTE": "1"}}',
  'packages/ei/managed-settings.d/sub/50-d.json': '{"env": {"CLAUDE_CODE_REMOTE": "1"}}',
  'packages/ei/.vscode/settings.json': '{"env": {"CLAUDE_CODE_REMOTE": "1"}}',
  // `settings-project-value-ignored`: a value that Claude Code ignores in a project file. It
  // reads the two project files only. A managed file can set the value. The same content in
  // another settings file is silent.
  'packages/pv/.claude/settings.json': '{"remoteControlAtStartup": true}',
  'packages/pv/.claude/settings.local.json': '{"crossSessionInbound": "accept"}',
  'packages/pv/managed-settings.json': '{"remoteControlAtStartup": true, "model": "opus"}',
  'packages/pv/managed-settings.d/10-a.json': '{"forceLoginMethod": "gateway"}',
  'packages/pv/.vscode/settings.json': '{"remoteControlAtStartup": true}',
  // The grammar rules on the managed files (#14): `managed-settings.json` and a drop-in. A hidden
  // drop-in is for `settings-managed-file`, because Claude Code ignores it. The same content
  // where no rule reads it: another extension, a nested directory, and another settings file.
  'packages/gr/managed-settings.json': badSettings,
  'packages/gr/managed-settings.d/10-a.json': badSettings,
  'packages/gr/managed-settings.d/.20-hidden.json': badSettings,
  'packages/gr/managed-settings.d/30-b.txt': badSettings,
  'packages/gr/managed-settings.d/sub/40-c.json': badSettings,
  'packages/gr/.vscode/settings.json': badSettings,
  // `settings-known-marketplaces-policy-schema`: a policy entry of an unknown type in a managed
  // file and in a drop-in. A hidden drop-in is for `settings-managed-file`. The same content
  // where no rule reads it: another extension, a nested directory, and another settings file.
  'packages/kp/managed-settings.json': '{"strictKnownMarketplaces": [{"source": "bogus"}]}',
  'packages/kp/managed-settings.d/10-a.json': '{"blockedMarketplaces": [{"source": "npm"}]}',
  'packages/kp/managed-settings.d/.20-hidden.json': '{"pluginTrustMessage": 1}',
  'packages/kp/managed-settings.d/30-b.txt': '{"pluginTrustMessage": 1}',
  'packages/kp/managed-settings.d/sub/40-c.json': '{"pluginTrustMessage": 1}',
  'packages/kp/.vscode/settings.json': '{"pluginTrustMessage": 1}',
  // `settings-plugin-suggestion-marketplaces-source`: a name with no source in the merged file
  // source. A drop-in that declares the name makes `managed-settings.json` silent. Where the
  // source declares it, and where no rule reads the file, the rules are silent.
  'packages/ps/managed-settings.json': '{"pluginSuggestionMarketplaces": ["acme"]}',
  'packages/ps/managed-settings.d/10-a.json': '{"pluginSuggestionMarketplaces": ["acme"]}',
  'packages/ps/managed-settings.d/.20-hidden.json': '{"pluginSuggestionMarketplaces": ["acme"]}',
  'packages/ps/managed-settings.d/30-b.txt': '{"pluginSuggestionMarketplaces": ["acme"]}',
  'packages/ps/managed-settings.d/sub/40-c.json': '{"pluginSuggestionMarketplaces": ["acme"]}',
  'packages/ps/.vscode/settings.json': '{"pluginSuggestionMarketplaces": ["acme"]}',
  'packages/ps2/managed-settings.json': '{"pluginSuggestionMarketplaces": ["acme"]}',
  'packages/ps2/managed-settings.d/10-a.json':
    '{"strictKnownMarketplaces": [{"source": "github", "repo": "acme/*"}]}',
  // `settings-conflicting-keys`: a pair of keys in one file, in each file that it reads. The
  // channels pair is for a managed file. A hidden drop-in is for `settings-managed-file`. The
  // same content where no rule reads it: another extension, a nested directory, and another
  // settings file.
  'packages/ck/.claude/settings.json': '{"verbose": true, "viewMode": "default"}',
  'packages/ck/.claude/settings.local.json':
    '{"spinnerTipsOverride": {}, "spinnerTipsEnabled": false}',
  'packages/ck/managed-settings.json': '{"allowedChannelPlugins": []}',
  'packages/ck/managed-settings.d/10-a.json': '{"timeZone": "UTC", "timeFormat": "24-hour-utc"}',
  'packages/ck/managed-settings.d/.20-hidden.json': '{"verbose": true, "viewMode": "default"}',
  'packages/ck/managed-settings.d/30-b.txt': '{"verbose": true, "viewMode": "default"}',
  'packages/ck/managed-settings.d/sub/40-c.json': '{"verbose": true, "viewMode": "default"}',
  'packages/ck/.vscode/settings.json': '{"verbose": true, "viewMode": "default"}',
  // `settings-model-value`: a model value that is no alias and no ID, in each file that it reads.
  // A hidden drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/mv/.claude/settings.json': '{"model": "sonet"}',
  'packages/mv/.claude/settings.local.json': '{"fallbackModel": ["sonnet", "gpt-5"]}',
  'packages/mv/managed-settings.json': '{"advisorModel": "haiku"}',
  'packages/mv/managed-settings.d/10-a.json': '{"env": {"ANTHROPIC_DEFAULT_OPUS_MODEL": "opus"}}',
  'packages/mv/managed-settings.d/.20-hidden.json': '{"model": "sonet"}',
  'packages/mv/managed-settings.d/30-b.txt': '{"model": "sonet"}',
  'packages/mv/managed-settings.d/sub/40-c.json': '{"model": "sonet"}',
  'packages/mv/.vscode/settings.json': '{"model": "sonet"}',
  // `settings-model-list`: a fallback chain of four models, a list that a family ID narrows, a
  // `best` entry in `deniedModels` and an override key that is an alias, in each file that it
  // reads. A hidden drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/ml/.claude/settings.json': '{"fallbackModel": ["opus", "sonnet", "haiku", "fable"]}',
  'packages/ml/.claude/settings.local.json': '{"availableModels": ["sonnet", "claude-sonnet-4-5"]}',
  'packages/ml/managed-settings.json': '{"deniedModels": ["best"]}',
  'packages/ml/managed-settings.d/10-a.json': '{"modelOverrides": {"opus": "x"}}',
  'packages/ml/managed-settings.d/.20-hidden.json': '{"deniedModels": ["best"]}',
  'packages/ml/managed-settings.d/30-b.txt': '{"deniedModels": ["best"]}',
  'packages/ml/managed-settings.d/sub/40-c.json': '{"deniedModels": ["best"]}',
  'packages/ml/.vscode/settings.json': '{"fallbackModel": ["opus", "sonnet", "haiku", "fable"]}',
  // `settings-skilloverrides-key`: a plugin skill key in each file that it reads, and a bundled
  // alias key, which a managed file honors. A hidden drop-in is for `settings-managed-file`. The
  // same content where no rule reads it.
  'packages/so/.claude/settings.json': '{"skillOverrides": {"review": "off"}}',
  'packages/so/.claude/settings.local.json':
    '{"enabledPlugins": {"a@m": true}, "skillOverrides": {"a:b": "off"}}',
  'packages/so/managed-settings.json':
    '{"enabledPlugins": {"a@m": true}, "skillOverrides": {"a:b": "off", "checkup": "off"}}',
  'packages/so/managed-settings.d/10-a.json': '{"skillOverrides": {"proactive": "off"}}',
  'packages/so/managed-settings.d/.20-hidden.json':
    '{"enabledPlugins": {"a@m": true}, "skillOverrides": {"a:b": "off"}}',
  'packages/so/managed-settings.d/30-b.txt':
    '{"enabledPlugins": {"a@m": true}, "skillOverrides": {"a:b": "off"}}',
  'packages/so/managed-settings.d/sub/40-c.json':
    '{"enabledPlugins": {"a@m": true}, "skillOverrides": {"a:b": "off"}}',
  'packages/so/.vscode/settings.json':
    '{"enabledPlugins": {"a@m": true}, "skillOverrides": {"a:b": "off"}}',
  // `settings-env-shadowed`: a voided variable in each file that it reads. A hidden drop-in is for
  // `settings-managed-file`. The same content where no rule reads it.
  'packages/es/.claude/settings.json':
    '{"bashOutputMaxChars": 5000, "env": {"BASH_MAX_OUTPUT_LENGTH": "1000"}}',
  'packages/es/.claude/settings.local.json': '{"env": {"ANTHROPIC_DEFAULT_MODEL": "haiku"}}',
  'packages/es/managed-settings.json': '{"env": {"CLAUDE_CODE_SUBAGENT_MODEL": "inherit"}}',
  'packages/es/managed-settings.d/10-a.json': '{"env": {"NO_COLOR": "1"}}',
  'packages/es/managed-settings.d/.20-hidden.json': '{"env": {"NO_COLOR": "1"}}',
  'packages/es/managed-settings.d/30-b.txt': '{"env": {"NO_COLOR": "1"}}',
  'packages/es/managed-settings.d/sub/40-c.json': '{"env": {"NO_COLOR": "1"}}',
  'packages/es/.vscode/settings.json': '{"env": {"NO_COLOR": "1"}}',
  // `hooks-script-exists`: a hook script that is not there, in each file that it reads. A managed
  // file holds a policy key. A hidden drop-in is for `settings-managed-file`. The same content
  // where no rule reads it: another extension, a nested directory, another settings file, and
  // a `hooks/hooks.json` that is in no plugin.
  'packages/hs/.claude/settings.json': JSON.stringify(hookOf(`${projectDir}/gone.sh`)),
  'packages/hs/.claude/settings.local.json': JSON.stringify(hookOf('tools/gone.sh')),
  'packages/hs/managed-settings.json': JSON.stringify({
    model: 'opus',
    ...hookOf(`${projectDir}/gone.sh`),
  }),
  'packages/hs/managed-settings.d/10-a.json': JSON.stringify({
    model: 'opus',
    ...hookOf(`${projectDir}/gone.sh`),
  }),
  'packages/hs/managed-settings.d/.20-hidden.json': JSON.stringify({
    model: 'opus',
    ...hookOf(`${projectDir}/gone.sh`),
  }),
  'packages/hs/managed-settings.d/30-b.txt': JSON.stringify(hookOf(`${projectDir}/gone.sh`)),
  'packages/hs/managed-settings.d/sub/40-c.json': JSON.stringify(hookOf(`${projectDir}/gone.sh`)),
  'packages/hs/.vscode/settings.json': JSON.stringify(hookOf(`${projectDir}/gone.sh`)),
  'packages/hs/plugin/.claude-plugin/plugin.json': JSON.stringify({ name: 'hs' }),
  'packages/hs/plugin/hooks/hooks.json': JSON.stringify(hookOf(`${pluginRoot}/gone.sh`)),
  'packages/hs/plugin/hooks/other.json': JSON.stringify(hookOf(`${pluginRoot}/gone.sh`)),
  'packages/hs/loose/hooks/hooks.json': JSON.stringify(hookOf(`${pluginRoot}/gone.sh`)),
  // `settings-enabled-plugins-marketplace-declared` is `off`. It reads the two project files, and
  // no other file. The same content where no rule reads it: a nested directory, another
  // directory, a managed file and the top level.
  'packages/md/.claude/settings.json': undeclaredSettings,
  'packages/md/.claude/settings.local.json': undeclaredSettings,
  'packages/md/.claude/nested/settings.json': undeclaredSettings,
  'packages/md/.vscode/settings.json': undeclaredSettings,
  'packages/md/settings.json': undeclaredSettings,
  'packages/md/managed-settings.json': undeclaredSettings,
  // `settings-enabled-plugins-external-source` reads `.claude/settings.json` only. The local file
  // holds the same content and no rule reports it.
  'packages/ex/.claude/market/.claude-plugin/marketplace.json': externalMarketplace,
  'packages/ex/.claude/settings.json': externalSettings,
  'packages/ex/.claude/settings.local.json': externalSettings,
  'packages/ex/.claude/nested/settings.json': externalSettings,
  'packages/ex/.vscode/settings.json': externalSettings,
  'packages/ex/settings.json': externalSettings,
  // `settings-extra-known-marketplaces-directory` reads `.claude/settings.json` only. A managed
  // file can deploy a marketplace to each machine.
  'packages/dr/.claude/settings.json': directorySettings,
  'packages/dr/.claude/settings.local.json': directorySettings,
  'packages/dr/.claude/nested/settings.json': directorySettings,
  'packages/dr/.vscode/settings.json': directorySettings,
  'packages/dr/managed-settings.json': directorySettings,
  // `settings-marketplace-skip-lfs` reads the project files and the managed files. A hidden drop-in
  // is for `settings-managed-file`. The same content where no rule reads it.
  'packages/lf/.claude/settings.json': skipLfsSettings,
  'packages/lf/.claude/settings.local.json': skipLfsSettings,
  'packages/lf/managed-settings.json': skipLfsSettings,
  'packages/lf/managed-settings.d/10-a.json': skipLfsSettings,
  'packages/lf/managed-settings.d/.20-hidden.json': skipLfsSettings,
  'packages/lf/managed-settings.d/30-b.txt': skipLfsSettings,
  'packages/lf/managed-settings.d/sub/40-c.json': skipLfsSettings,
  'packages/lf/.vscode/settings.json': skipLfsSettings,
  // `settings-marketplace-key-alias` reads the project files and the managed files. In a project
  // file it reads `additionalMarketplaces` only. `allowedMarketplaces` there is for
  // `settings-key-scope`, and an alias beside its key is for the conflict rule.
  'packages/ka/.claude/settings.json': '{"additionalMarketplaces": {}}',
  'packages/ka/.claude/settings.local.json': '{"additionalMarketplaces": {}}',
  'packages/ka/managed-settings.json': '{"allowedMarketplaces": [{"source": "skills-dir"}]}',
  'packages/ka/managed-settings.d/10-a.json': '{"additionalMarketplaces": {}}',
  'packages/ka/managed-settings.d/.20-hidden.json': '{"additionalMarketplaces": {}}',
  'packages/ka/managed-settings.d/30-b.txt': '{"additionalMarketplaces": {}}',
  'packages/ka/managed-settings.d/sub/40-c.json': '{"additionalMarketplaces": {}}',
  'packages/ka/.vscode/settings.json': '{"additionalMarketplaces": {}}',
  'packages/ka2/.claude/settings.json':
    '{"strictKnownMarketplaces": [], "allowedMarketplaces": []}',
  // `settings-marketplace-key-alias-conflict` reads a policy pair in the managed files only.
  'packages/ac/managed-settings.json':
    '{"strictKnownMarketplaces": [{"source": "skills-dir"}], "allowedMarketplaces": []}',
  'packages/ac/managed-settings.d/10-a.json':
    '{"extraKnownMarketplaces": {}, "additionalMarketplaces": {}}',
  'packages/ac/managed-settings.d/.20-hidden.json':
    '{"extraKnownMarketplaces": {}, "additionalMarketplaces": {}}',
  'packages/ac/managed-settings.d/30-b.txt':
    '{"extraKnownMarketplaces": {}, "additionalMarketplaces": {}}',
  'packages/ac/managed-settings.d/sub/40-c.json':
    '{"extraKnownMarketplaces": {}, "additionalMarketplaces": {}}',
  'packages/ac/.vscode/settings.json':
    '{"extraKnownMarketplaces": {}, "additionalMarketplaces": {}}',
  // `settings-known-marketplaces-pattern-anchored` reads the managed files, and no other file.
  'packages/pa/managed-settings.json': JSON.stringify({
    strictKnownMarketplaces: [
      skillsDir,
      { source: 'hostPattern', hostPattern: 'github.example.com' },
    ],
  }),
  'packages/pa/managed-settings.d/10-a.json': JSON.stringify({
    strictKnownMarketplaces: [skillsDir, { source: 'pathPattern', pathPattern: '/opt' }],
  }),
  'packages/pa/managed-settings.d/.20-hidden.json': JSON.stringify({
    strictKnownMarketplaces: [skillsDir, { source: 'pathPattern', pathPattern: '/opt' }],
  }),
  'packages/pa/managed-settings.d/30-b.txt': JSON.stringify({
    strictKnownMarketplaces: [skillsDir, { source: 'pathPattern', pathPattern: '/opt' }],
  }),
  'packages/pa/managed-settings.d/sub/40-c.json': JSON.stringify({
    strictKnownMarketplaces: [skillsDir, { source: 'pathPattern', pathPattern: '/opt' }],
  }),
  'packages/pa/.vscode/settings.json': JSON.stringify({
    strictKnownMarketplaces: [skillsDir, { source: 'pathPattern', pathPattern: '/opt' }],
  }),
  // `settings-strict-known-marketplaces-skills-dir` reads the merged managed source. A drop-in
  // with the entry makes `managed-settings.json` and the other drop-in silent.
  'packages/sd/managed-settings.json': noSkillsDir,
  'packages/sd/managed-settings.d/10-a.json': noSkillsDir,
  'packages/sd/managed-settings.d/.20-hidden.json': noSkillsDir,
  'packages/sd/managed-settings.d/30-b.txt': noSkillsDir,
  'packages/sd/managed-settings.d/sub/40-c.json': noSkillsDir,
  'packages/sd/.vscode/settings.json': noSkillsDir,
  'packages/sd2/managed-settings.json': noSkillsDir,
  'packages/sd2/managed-settings.d/10-a.json': withSkillsDir,
  // `claude-md-agents-md-variant`: the variants that Claude Code never reads, and a Markdown file
  // below `.agents/`. The same text where Claude Code reads it or where no rule reads it.
  'packages/av/AGENTS.local.md': '# Notes\n',
  'packages/av/AGENTS.override.md': '# Notes\n',
  'packages/av/.agents/notes.md': '# Notes\n',
  'packages/av/.agents/skills/x/SKILL.md': '# Notes\n',
  'packages/av/.agents/config.json': '{}',
  'packages/av/AGENTS.md': '# Notes\n',
  'packages/av/.claude/AGENTS.md': '# Notes\n',
  'packages/av/docs/agents/notes.md': '# Notes\n',
  'packages/av/docs/AGENTS.local.md.bak': '# Notes\n',
  // `claude-md-agents-md-shadowed`: an AGENTS.md in a folder that holds a CLAUDE.md file, in
  // either place. The same files where the CLAUDE.md imports the AGENTS.md, and where no rule
  // reads the file as an AGENTS.md. The AGENTS.md files of the trees of other rules sit beside a
  // CLAUDE.md too, and are reported here (see the reports below).
  'packages/sh/CLAUDE.md': '# Rules\n',
  'packages/sh/AGENTS.md': '# Agents\n',
  'packages/sh/.claude/AGENTS.md': '# Agents\n',
  'packages/sh/.claude/rules/AGENTS.md': '# Rule\n',
  'packages/sh/ok/CLAUDE.md': '@AGENTS.md\n',
  'packages/sh/ok/AGENTS.md': '# Agents\n',
  // `rules-symlink-external-scoped`: a rule file with `paths` that is a link out of the tree. The
  // links are made in `beforeAll`. The same text in a regular file is not reported.
  'packages/rx/.git': 'gitdir: ../.git\n',
  'packages/rx/.claude/rules/local.md': SCOPED_RULE,
  // `claude-md-import-exists`: an import of a missing file in each instruction file that Claude
  // Code expands. The same text where no rule reads it: a Markdown file that is not one of them,
  // and a rule file.
  'packages/ie/present.md': '# Present\n',
  'packages/ie/CLAUDE.md': '@present.md @missing.md\n',
  'packages/ie/.claude/CLAUDE.md': '@missing.md\n',
  'packages/ie/CLAUDE.local.md': '@missing.md\n',
  'packages/ie/AGENTS.md': '@missing.md\n',
  'packages/ie/.claude/AGENTS.md': '@missing.md\n',
  'packages/ie/docs/notes.md': '@missing.md\n',
  'packages/ie/.claude/rules/r.md': '@missing.md\n',
  // `claude-md-import-max-depth`: a chain of five hops from each instruction file that Claude
  // Code expands. The same chain at four hops, and in a file that no rule reads. The file `.git`
  // makes `packages/md` a repository, so that the imports of `.claude/CLAUDE.md` stay inside it.
  'packages/md/.git': 'gitdir: ../.git\n',
  'packages/md/f1.md': '@f2.md\n',
  'packages/md/f2.md': '@f3.md\n',
  'packages/md/f3.md': '@f4.md\n',
  'packages/md/f4.md': '@f5.md\n',
  'packages/md/f5.md': 'end\n',
  'packages/mda/f1.md': '@f2.md\n',
  'packages/mda/f2.md': '@f3.md\n',
  'packages/mda/f3.md': '@f4.md\n',
  'packages/mda/f4.md': '@f5.md\n',
  'packages/mda/f5.md': 'end\n',
  'packages/md/CLAUDE.md': '@f1.md\n',
  'packages/md/.claude/CLAUDE.md': '@../f1.md\n',
  'packages/md/CLAUDE.local.md': '@f1.md\n',
  'packages/md/ok/CLAUDE.md': '@../f2.md\n',
  'packages/md/docs/notes.md': '@../f1.md\n',
  'packages/mda/AGENTS.md': '@f1.md\n',
  // `claude-md-import-in-code-span`: a path in a code span or a fence that names a file, in each
  // file that the rule reads. The same paths where no rule reads them, and a path to a missing
  // file. The file `.git` makes `packages/ic` a repository.
  'packages/ic/.git': 'gitdir: ../.git\n',
  'packages/ic/present.md': '# Present\n',
  'packages/ic/CLAUDE.md': 'Use `@present.md`.\n',
  'packages/ic/.claude/CLAUDE.md': 'Use `@../present.md`.\n',
  'packages/ic/CLAUDE.local.md': '```\n@present.md\n```\n',
  'packages/ic/docs/notes.md': 'Use `@../present.md`.\n',
  'packages/ic/ok/CLAUDE.md': 'Use `@none.md`, and import @../present.md.\n',
  'packages/ica/AGENTS.md': 'Use `@present.md`.\n',
  'packages/ica/present.md': '# Present\n',
  // `claude-md-agents-md-prose-pointer`: a sentence that tells Claude to read AGENTS.md. The same
  // sentence where no rule reads it, and beside an import.
  'packages/pp/.git': 'gitdir: ../.git\n',
  'packages/pp/CLAUDE.md': 'Read AGENTS.md first.\n',
  'packages/pp/.claude/CLAUDE.md': 'Read AGENTS.md first.\n',
  'packages/pp/CLAUDE.local.md': 'Read AGENTS.md first.\n',
  'packages/pp/ok/CLAUDE.md': '@AGENTS.md\n\nRead AGENTS.md first.\n',
  'packages/pp/ok/AGENTS.md': '# Agents\n',
  // `claude-md-excludes-absolute-committed`: a machine path in the committed file. The same path
  // in the local file, in a managed file and in another settings file.
  'packages/ea/.claude/settings.json': '{"claudeMdExcludes": ["/Users/x/work/**", "**/ok/**"]}',
  'packages/ea/.claude/settings.local.json': '{"claudeMdExcludes": ["/Users/x/work/**"]}',
  'packages/ea/managed-settings.json': '{"claudeMdExcludes": ["/Users/x/work/**"]}',
  'packages/ea/.vscode/settings.json': '{"claudeMdExcludes": ["/Users/x/work/**"]}',
  // `memory-agent-memory-orphan`: an index of a folder that no subagent owns, and one that a
  // project subagent owns. The file `.git` makes `packages/ao` a repository.
  'packages/ao/.git': 'gitdir: ../.git\n',
  'packages/ao/.claude/agent-memory/lone/MEMORY.md': '# Lone\n',
  'packages/ao/.claude/agent-memory/lone/topic.md': '# Topic\n',
  'packages/ao/.claude/agent-memory/owned/MEMORY.md': '# Owned\n',
  'packages/ao/.claude/agents/owned.md':
    '---\nname: owned\ndescription: d\nmemory: project\ntools: Read, Write, Edit\n---\n',
  // `rules-paths-no-match`: a rule with a glob that matches a file, and one that matches none.
  // The same rule where no rule reads it. The file `.git` makes `packages/pn` a repository.
  'packages/pn/.git': 'gitdir: ../.git\n',
  'packages/pn/src/a.ts': 'x\n',
  'packages/pn/.claude/rules/hit.md': '---\npaths:\n  - "src/**/*.ts"\n---\n# Hit\n',
  'packages/pn/.claude/rules/miss.md': '---\npaths:\n  - "nope/**/*.ts"\n---\n# Miss\n',
  'packages/pn/docs/miss.md': '---\npaths:\n  - "nope/**/*.ts"\n---\n# Miss\n',
  // `claude-md-location`: a CLAUDE.local.md in a `.claude` folder, and a case variant. The loaded
  // names, and a name that only looks like one.
  'packages/lo/.claude/CLAUDE.local.md': '# Notes\n',
  'packages/lo/web/claude.md': '# Notes\n',
  'packages/lo/CLAUDE.md': '# Notes\n',
  'packages/lo/.claude/CLAUDE.md': '# Notes\n',
  'packages/lo/CLAUDE.local.md': '# Notes\n',
  'packages/lo/docs/claude-notes.md': '# Notes\n',
  // `claude-md-html-comment-content`: a block comment with an instruction in each file that the
  // rule reads. The same comment where no rule reads it, and inline, in a fence and as a note.
  'packages/hc/.git': 'gitdir: ../.git\n',
  'packages/hc/CLAUDE.md': '<!-- MUST run tests -->\n',
  'packages/hc/.claude/CLAUDE.md': '<!-- MUST run tests -->\n',
  'packages/hc/CLAUDE.local.md': '<!-- MUST run tests -->\n',
  'packages/hc/docs/notes.md': '<!-- MUST run tests -->\n',
  'packages/hc/ok/CLAUDE.md':
    'Text <!-- MUST run tests --> more\n\n```\n<!-- MUST run tests -->\n```\n\n<!-- Maintainer: Jo -->\n',
  // `claude-md-max-lines`: a file of 201 lines in each place that it lints, and an import of a long
  // file. The same text where no rule reads it: a Markdown file that is not an instruction file.
  'packages/lm/CLAUDE.md': LONG,
  'packages/lm/.claude/CLAUDE.md': LONG,
  'packages/lm/CLAUDE.local.md': LONG,
  'packages/lm/docs/notes.md': LONG,
  'packages/lma/AGENTS.md': LONG,
  'packages/lmi/CLAUDE.md': '@long.md\n',
  'packages/lmi/long.md': LONG,
  // `rules-max-lines`: a rule file of 201 lines. The same text outside `.claude/rules/`.
  'packages/rm/.claude/rules/long.md': LONG,
  'packages/rm/docs/long.md': LONG,
  // `memory-index-max-size`: the index of a subagent. The same text in a topic file and in a
  // file that is not below `.claude/agent-memory/<name>/`.
  'packages/mi/.claude/agent-memory/rev/MEMORY.md': LONG,
  'packages/mi/.claude/agent-memory/rev/topic.md': LONG,
  'packages/mi/MEMORY.md': LONG,
  // `memory-index-entry-format`: an index entry that takes two lines. The same text in a topic
  // file and in a file that is not below `.claude/agent-memory/<name>/`.
  'packages/ent/.claude/agent-memory/rev/MEMORY.md': '- [Testing](testing.md): first\n  second\n',
  'packages/ent/.claude/agent-memory/rev/topic.md': '- [Testing](testing.md): first\n  second\n',
  'packages/ent/MEMORY.md': '- [Testing](testing.md): first\n  second\n',
  // `memory-topic-frontmatter`: a topic file with a `type` that is none of the four kinds. A valid
  // file, the same text in the index, in a deeper folder and outside `.claude/agent-memory/<name>/`.
  'packages/tf/.claude/agent-memory/rev/bad.md': '---\ntype: note\n---\n',
  'packages/tf/.claude/agent-memory/rev/ok.md':
    '---\ntype: user\nmodified: 2026-10-14T09:30:00Z\n---\n',
  'packages/tf/.claude/agent-memory/rev/MEMORY.md': '---\ntype: note\n---\n',
  'packages/tf/.claude/agent-memory/rev/sub/bad.md': '---\ntype: note\n---\n',
  'packages/tf/docs/bad.md': '---\ntype: note\n---\n',
  // `claude-md-guardrail-to-hook`: a prohibition in each file that the rule reads. The same text
  // where no rule reads it, and in a fence.
  'packages/gh/CLAUDE.md': 'Never edit the lock file.\n',
  'packages/gh/.claude/CLAUDE.md': 'Never edit the lock file.\n',
  'packages/gh/CLAUDE.local.md': 'Never edit the lock file.\n',
  'packages/gh/.claude/rules/lock.md': 'Never edit the lock file.\n',
  'packages/gh/docs/notes.md': 'Never edit the lock file.\n',
  'packages/gh/ok/CLAUDE.md': '```\nNever edit the lock file.\n```\n',
  // `claude-md-derivable-content`: a directory tree in each file that the rule reads. The same text
  // where no rule reads it, and a block with two branches.
  'packages/dc/CLAUDE.md': '```\nsrc/\n├── a.ts\n├── b.ts\n└── c.ts\n```\n',
  'packages/dc/.claude/CLAUDE.md': '```\nsrc/\n├── a.ts\n├── b.ts\n└── c.ts\n```\n',
  'packages/dc/CLAUDE.local.md': '```\nsrc/\n├── a.ts\n├── b.ts\n└── c.ts\n```\n',
  'packages/dc/.claude/rules/layout.md': '```\nsrc/\n├── a.ts\n├── b.ts\n└── c.ts\n```\n',
  'packages/dc/docs/notes.md': '```\nsrc/\n├── a.ts\n├── b.ts\n└── c.ts\n```\n',
  'packages/dc/ok/CLAUDE.md': '```\nsrc/\n├── a.ts\n└── b.ts\n```\n',
  // `claude-md-git-instructions`: a commit rule in each file that the rule reads, in a repository
  // whose settings do not turn the git instructions off. The same text where no rule reads it, and
  // in a repository whose project settings turn them off. The files `.git` make the repositories.
  'packages/gi/.git': 'gitdir: ../.git\n',
  'packages/gi/CLAUDE.md': 'Write commit messages in English.\n',
  'packages/gi/.claude/CLAUDE.md': 'Write commit messages in English.\n',
  'packages/gi/.claude/rules/git.md': 'Write commit messages in English.\n',
  'packages/gi/CLAUDE.local.md': 'Write commit messages in English.\n',
  'packages/gi/docs/notes.md': 'Write commit messages in English.\n',
  'packages/gi/ok/.git': 'gitdir: ../.git\n',
  'packages/gi/ok/CLAUDE.md': 'Write commit messages in English.\n',
  'packages/gi/ok/.claude/settings.json': '{"includeGitInstructions": false}',
  // `claude-md-dangling-reference`: a path that is not there, in each file that the rule reads. The
  // same text where no rule reads it, and a path and a command that are there. The file `.git`
  // makes `packages/dr` a repository.
  'packages/dr/.git': 'gitdir: ../.git\n',
  'packages/dr/CLAUDE.md': 'See `docs/gone/file.md`.\n',
  'packages/dr/.claude/CLAUDE.md': 'See `docs/gone/file.md`.\n',
  'packages/dr/CLAUDE.local.md': 'See `docs/gone/file.md`.\n',
  'packages/dr/.claude/rules/a.md': 'See `docs/gone/file.md`.\n',
  'packages/dr/docs/notes.md': 'See `docs/gone/file.md`.\n',
  'packages/dr/ok/.git': 'gitdir: ../.git\n',
  'packages/dr/ok/CLAUDE.md': 'See `src/a.ts`, and run `/ship`.\n',
  'packages/dr/ok/src/a.ts': 'x\n',
  'packages/dr/ok/.claude/skills/ship/SKILL.md': '---\nname: ship\ndescription: d\n---\n',
  // `claude-md-import-external`: an import out of the repository in a CLAUDE.md file. The file
  // `.git` makes each package a repository. The same import in a CLAUDE.local.md and an AGENTS.md
  // file, which the rule does not lint.
  'packages/ix/.git': 'gitdir: ../.git\n',
  'packages/ix/docs/in.md': '# In\n',
  'packages/ix/CLAUDE.md': '@docs/in.md @~/mine.md\n',
  'packages/ix/.claude/CLAUDE.md': '@/nowhere/x.md\n',
  'packages/ix/CLAUDE.local.md': '@~/mine.md\n',
  'packages/ixa/.git': 'gitdir: ../.git\n',
  'packages/ixa/AGENTS.md': '@~/mine.md\n',
  // `claude-md-symlink`: a CLAUDE.md that is a link, made in `beforeAll`. A regular file passes.
  'packages/cs/notes.md': '# Notes\n',
  'packages/cs/sub/CLAUDE.md': '# Sub\n',
  // `memory-auto-memory-directory-committed`: the key in each project settings file. A managed file
  // passes.
  'packages/ad/.claude/settings.json': '{"autoMemoryDirectory": "~/mem"}',
  'packages/ad/.claude/settings.local.json': '{"autoMemoryDirectory": "~/mem"}',
  'packages/ad/managed-settings.json': '{"autoMemoryDirectory": "~/mem"}',
  // `claude-md-excludes-pattern`: a relative-style pattern in each settings file that it reads.
  // A hidden drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/cx/.claude/settings.json': '{"claudeMdExcludes": ["packages/web/**"]}',
  'packages/cx/.claude/settings.local.json': '{"claudeMdExcludes": ["*/CLAUDE.md", "**/ok/**"]}',
  'packages/cx/managed-settings.json': '{"claudeMdExcludes": ["a/**"]}',
  'packages/cx/managed-settings.d/10-a.json': '{"claudeMdExcludes": ["b/**"]}',
  'packages/cx/managed-settings.d/.20-hidden.json': '{"claudeMdExcludes": ["c/**"]}',
  'packages/cx/managed-settings.d/30-b.txt': '{"claudeMdExcludes": ["d/**"]}',
  'packages/cx/managed-settings.d/sub/40-c.json': '{"claudeMdExcludes": ["e/**"]}',
  'packages/cx/.vscode/settings.json': '{"claudeMdExcludes": ["f/**"]}',
  'packages/cx/ok/.claude/settings.json': '{"claudeMdExcludes": ["**/web/**", "/abs/CLAUDE.md"]}',
  // `memory-settings-schema`: a memory key of the wrong type in each settings file that it reads.
  // A hidden drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/ms/.claude/settings.json': '{"autoMemoryEnabled": "no"}',
  'packages/ms/.claude/settings.local.json': '{"autoMemoryDirectory": "memory"}',
  'packages/ms/managed-settings.json': '{"claudeMdExcludes": "**/a/**"}',
  'packages/ms/managed-settings.d/10-a.json':
    '{"pluginConfigs": {"cc-plugin-agents-md@builtin": {"options": {"instructionFiles": "both"}}}}',
  'packages/ms/managed-settings.d/.20-hidden.json': '{"autoMemoryEnabled": "no"}',
  'packages/ms/managed-settings.d/30-b.txt': '{"autoMemoryEnabled": "no"}',
  'packages/ms/managed-settings.d/sub/40-c.json': '{"autoMemoryEnabled": "no"}',
  'packages/ms/.vscode/settings.json': '{"autoMemoryEnabled": "no"}',
  // `rules-frontmatter-schema`: a bad frontmatter in a rule file at each depth, and a block below
  // line 1. The same content where no rule reads it: a Markdown file that is not a rule file.
  'packages/rf/.claude/rules/globs.md': '---\nglobs: "*.ts"\n---\n# Rule\n',
  'packages/rf/.claude/rules/sub/yaml.md': '---\npaths: *.ts\n---\n# Rule\n',
  'packages/rf/.claude/rules/late.md': '# Rule\n\n---\npaths: "src/**"\n---\n',
  'packages/rf/.claude/rules/ok.md': '---\npaths:\n  - "src/**/*.ts"\n---\n# Rule\n',
  'packages/rf/docs/rules/globs.md': '---\nglobs: "*.ts"\n---\n# Not a rule file\n',
  // `rules-paths-glob-valid`: a bad glob in a rule file at each depth. The same content where no
  // rule reads it.
  'packages/rg/.claude/rules/bracket.md': '---\npaths: "photos [2024/**"\n---\n# Rule\n',
  'packages/rg/.claude/rules/sub/ok.md': '---\npaths: "photos \\\\[2024/**"\n---\n# Rule\n',
  'packages/rg/docs/rules/bracket.md': '---\npaths: "photos [2024/**"\n---\n# Not a rule file\n',
  // `rules-md-extension`: a file below `.claude/rules/` with another extension, at each depth. A
  // hidden file, a file with the extension `.md`, and the same names where no rule reads them.
  'packages/re/.claude/rules/style.txt': '# Rule\n',
  'packages/re/.claude/rules/sub/react.markdown': '# Rule\n',
  'packages/re/.claude/rules/noextension': '# Rule\n',
  'packages/re/.claude/rules/.gitkeep': '',
  'packages/re/.claude/rules/ok.md': '# Rule\n',
  'packages/re/docs/rules/style.txt': '# Not a rule file\n',
  'packages/re/.claude/style.txt': '# Not a rule file\n',
  'packages/ms/ok/.claude/settings.json':
    '{"autoMemoryEnabled": false, "autoMemoryDirectory": "~/memory", "claudeMdExcludes": ["**/a/**"]}',
  // `settings-schema`: an unknown key, an env variable name at the top level, a wrong type and an
  // unknown field, in each file that it reads. A hidden drop-in is for `settings-managed-file`.
  // The same content where no rule reads it: another extension, a nested directory, and another
  // settings file.
  'packages/ss/.claude/settings.json': '{"modle": "opus"}',
  'packages/ss/.claude/settings.local.json': '{"DISABLE_TELEMETRY": "1"}',
  'packages/ss/managed-settings.json': '{"fastMode": "yes"}',
  'packages/ss/managed-settings.d/10-a.json': '{"worktree": {"base": "head"}}',
  'packages/ss/managed-settings.d/.20-hidden.json': '{"modle": "opus"}',
  'packages/ss/managed-settings.d/30-b.txt': '{"modle": "opus"}',
  'packages/ss/managed-settings.d/sub/40-c.json': '{"modle": "opus"}',
  'packages/ss/.vscode/settings.json': '{"modle": "opus"}',
  // The rules of the global layer of #14. Each group has the files that the rule reads and a
  // hidden drop-in. It has the same content where no rule reads it: another extension, a nested
  // directory, and another settings file.
  // `settings-deprecated-key` reads the project and managed files.
  'packages/dk/.claude/settings.json': '{"includeCoAuthoredBy": false}',
  'packages/dk/.claude/settings.local.json': '{"voiceEnabled": true}',
  'packages/dk/managed-settings.json': '{"disableArtifact": true}',
  'packages/dk/managed-settings.d/10-a.json': '{"includeCoAuthoredBy": true}',
  'packages/dk/managed-settings.d/.20-hidden.json': '{"voiceEnabled": true}',
  'packages/dk/managed-settings.d/30-b.txt': '{"voiceEnabled": true}',
  'packages/dk/managed-settings.d/sub/40-c.json': '{"voiceEnabled": true}',
  'packages/dk/.vscode/settings.json': '{"voiceEnabled": true}',
  // `settings-attribution-false` reads the two project files, and no managed file.
  'packages/af/.claude/settings.json': '{"attribution": false}',
  'packages/af/.claude/settings.local.json': '{"attribution": false}',
  'packages/af/managed-settings.json': '{"attribution": false}',
  'packages/af/managed-settings.d/10-a.json': '{"attribution": false}',
  'packages/af/.vscode/settings.json': '{"attribution": false}',
  // `settings-redundant-value` reads the project and managed files.
  'packages/rv/.claude/settings.json': '{"alwaysThinkingEnabled": true}',
  'packages/rv/.claude/settings.local.json': '{"enableArtifact": true}',
  'packages/rv/managed-settings.json': '{"syncClaudeAiPlugins": true}',
  'packages/rv/managed-settings.d/10-a.json': '{"spinnerVerbs": {"mode": "replace", "verbs": []}}',
  'packages/rv/managed-settings.d/.20-hidden.json': '{"enableArtifact": true}',
  'packages/rv/managed-settings.d/30-b.txt': '{"enableArtifact": true}',
  'packages/rv/managed-settings.d/sub/40-c.json': '{"enableArtifact": true}',
  'packages/rv/.vscode/settings.json': '{"enableArtifact": true}',
  // `settings-project-autocontinue-off` reads the project and managed files. A Boolean in a
  // managed file is silent, and a value of another type is not.
  'packages/au/.claude/settings.json': '{"autoContinueAtUsageLimit": false}',
  'packages/au/.claude/settings.local.json': '{"autoContinueAtUsageLimit": true}',
  'packages/au/managed-settings.json': '{"autoContinueAtUsageLimit": "no"}',
  'packages/au/managed-settings.d/10-a.json': '{"autoContinueAtUsageLimit": 0}',
  'packages/au/managed-settings.d/20-ok.json': '{"autoContinueAtUsageLimit": false}',
  'packages/au/managed-settings.d/.30-hidden.json': '{"autoContinueAtUsageLimit": 0}',
  'packages/au/managed-settings.d/40-c.txt': '{"autoContinueAtUsageLimit": 0}',
  'packages/au/managed-settings.d/sub/50-d.json': '{"autoContinueAtUsageLimit": 0}',
  'packages/au/.vscode/settings.json': '{"autoContinueAtUsageLimit": 0}',
  // `settings-schema-url` reads the project and managed files. A file with no `$schema` is
  // reported too, and the list of those files is computed below.
  'packages/su/.claude/settings.json': '{"$schema": "https://example.com/s.json"}',
  'packages/su/.claude/settings.local.json':
    '{"$schema": "https://json.schemastore.org/claude-code-settings.json"}',
  'packages/su/managed-settings.json': '{"$schema": 1}',
  'packages/su/managed-settings.d/10-a.json':
    '{"$schema": "https://json.schemastore.org/claude-code-settings.json"}',
  'packages/su/managed-settings.d/.20-hidden.json': '{"$schema": "x"}',
  'packages/su/managed-settings.d/30-b.txt': '{"$schema": "x"}',
  'packages/su/managed-settings.d/sub/40-c.json': '{"$schema": "x"}',
  'packages/su/.vscode/settings.json': '{"$schema": "x"}',
  // `settings-outputstyle-resolves` reads the two project files, and no managed file. A style
  // file next to the settings file makes a name silent.
  'packages/os/.claude/settings.json': '{"outputStyle": "Nope"}',
  'packages/os/.claude/settings.local.json': '{"outputStyle": "explanatory"}',
  'packages/os/managed-settings.json': '{"outputStyle": "Nope"}',
  'packages/os/managed-settings.d/10-a.json': '{"outputStyle": "Nope"}',
  'packages/os/.vscode/settings.json': '{"outputStyle": "Nope"}',
  'packages/os2/.claude/settings.json': '{"outputStyle": "team-style"}',
  'packages/os2/.claude/settings.local.json': '{"outputStyle": "Learning"}',
  'packages/os2/.claude/output-styles/team-style.md': 'Be brief.\n',
  // `settings-global-only-file` reads a keybindings file and a theme file in `.claude/`, and a
  // `.claude.json` with one of the three keys. The same content in other places is silent.
  'packages/go/.claude/keybindings.json': '{"bindings": []}',
  'packages/go/.claude/themes/dracula.json': '{"name": "Dracula", "base": "dark"}',
  'packages/go/.claude.json': '{"permissions": {}}',
  'packages/go/.claude/themes/sub/other.json': '{"name": "Other"}',
  'packages/go/.claude/themes/notes.txt': '{"name": "Other"}',
  'packages/go/keybindings.json': '{"bindings": []}',
  'packages/go/.vscode/keybindings.json': '{"bindings": []}',
  'packages/go/themes/dracula.json': '{"name": "Dracula"}',
  'packages/go2/.claude.json': '{"theme": "dark"}',
  // The warn rules of the env and helper layer of #14. Each group has the files that the rule
  // reads, a hidden drop-in, and the same content where no rule reads it: another extension, a
  // nested directory, and another settings file.
  // `settings-env-deprecated-var` reads the project and managed files. A value of `1` for
  // `CLAUDE_CODE_ENABLE_TASKS` is silent.
  'packages/dv/.claude/settings.json': '{"env": {"ANTHROPIC_SMALL_FAST_MODEL": "haiku"}}',
  'packages/dv/.claude/settings.local.json': '{"env": {"CLAUDE_CODE_ENABLE_TASKS": "0"}}',
  'packages/dv/managed-settings.json': '{"env": {"DISABLE_BUG_COMMAND": "1"}}',
  'packages/dv/managed-settings.d/10-a.json': '{"env": {"SLASH_COMMAND_TOOL_CHAR_BUDGET": "9000"}}',
  'packages/dv/managed-settings.d/.20-hidden.json': '{"env": {"DISABLE_BUG_COMMAND": "1"}}',
  'packages/dv/managed-settings.d/30-b.txt': '{"env": {"DISABLE_BUG_COMMAND": "1"}}',
  'packages/dv/managed-settings.d/sub/40-c.json': '{"env": {"DISABLE_BUG_COMMAND": "1"}}',
  'packages/dv/.vscode/settings.json': '{"env": {"DISABLE_BUG_COMMAND": "1"}}',
  'packages/dv2/.claude/settings.json': '{"env": {"CLAUDE_CODE_ENABLE_TASKS": "1"}}',
  // `settings-env-routing` reads the shared project file only. The OpenTelemetry endpoint in
  // `packages/er2` is for `settings-env-ignored-var`.
  'packages/er/.claude/settings.json': '{"env": {"HTTPS_PROXY": "http://proxy.example.com:3128"}}',
  'packages/er/.claude/settings.local.json': '{"env": {"HTTPS_PROXY": "http://p.example.com:1"}}',
  'packages/er/managed-settings.json': '{"env": {"CLAUDE_CODE_USE_BEDROCK": "1"}}',
  'packages/er/managed-settings.d/10-a.json': '{"env": {"CLAUDE_CODE_USE_VERTEX": "1"}}',
  'packages/er/.vscode/settings.json': '{"env": {"HTTPS_PROXY": "http://p.example.com:1"}}',
  'packages/er2/.claude/settings.json':
    '{"env": {"OTEL_EXPORTER_OTLP_ENDPOINT": "https://otel.example.com"}}',
  // `settings-env-prompt-caching-off` reads the shared project file only.
  'packages/pc/.claude/settings.json': '{"env": {"DISABLE_PROMPT_CACHING": "1"}}',
  'packages/pc/.claude/settings.local.json': '{"env": {"DISABLE_PROMPT_CACHING": "1"}}',
  'packages/pc/managed-settings.json': '{"env": {"DISABLE_PROMPT_CACHING": "1"}}',
  'packages/pc/managed-settings.d/10-a.json': '{"env": {"DISABLE_PROMPT_CACHING_OPUS": "1"}}',
  'packages/pc/.vscode/settings.json': '{"env": {"DISABLE_PROMPT_CACHING": "1"}}',
  // `settings-committed-helper-command` reads the shared project file only.
  'packages/ch/.claude/settings.json': '{"apiKeyHelper": "/bin/key.sh"}',
  'packages/ch/.claude/settings.local.json': '{"apiKeyHelper": "/bin/key.sh"}',
  'packages/ch/managed-settings.json': '{"apiKeyHelper": "/bin/key.sh"}',
  'packages/ch/managed-settings.d/10-a.json': '{"awsAuthRefresh": "aws sso login"}',
  'packages/ch/.vscode/settings.json': '{"apiKeyHelper": "/bin/key.sh"}',
  'packages/hc2/.claude/settings.json':
    '{"statusLine": {"type": "command", "command": "~/status.sh"}}',
  // `settings-local-location` reads the local file in a repository with a `.git`: the file below
  // the root is a fault, and the file at the root is not.
  'packages/ll/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/ll/.claude/settings.local.json': '{}',
  'packages/ll/pkg/.claude/settings.local.json': '{}',
  'packages/ll/pkg/.claude/settings.json': '{}',
  // The settings rules of #14 that are `off` in `recommended` read these files. Each pair has a
  // file that reports in `strict` and a file where the rule is silent.
  'packages/ll/.claude/settings.json': '{}',
  'packages/oa-agent/.claude/settings.json': '{"agent": "nobody"}',
  'packages/oa-agent/.claude/settings.local.json': '{"agent": "Explore"}',
  'packages/oa-skill/.claude/settings.json': '{"skillOverrides": {"nothing": "off"}}',
  'packages/oa-skill/.claude/settings.local.json': '{"skillOverrides": {"batch": "off"}}',
  'packages/oa-pin/.claude/settings.json': '{"model": "opus"}',
  'packages/oa-pin/.claude/settings.local.json': '{"model": "opus"}',
  'packages/oa-pin/managed-settings.json':
    '{"env": {"CLAUDE_CODE_USE_BEDROCK": "1"}, "availableModels": ["claude-opus-4-8"]}',
  'packages/oa-pin/managed-settings.d/10-a.json':
    '{"env": {"CLAUDE_CODE_USE_BEDROCK": "1"}, "availableModels": ["us.anthropic.claude-opus-4-8"]}',
  'packages/oa-cap/.claude/settings.json': '{"model": "claude-sonnet-4-5[1m]"}',
  'packages/oa-cap/.claude/settings.local.json': '{"model": "claude-opus-4-6[1m]"}',
  'packages/oa-cap/managed-settings.json':
    '{"availableModels": ["opus"], "model": "claude-opus-5-5", "alwaysThinkingEnabled": false}',
  'packages/oa-secret/.claude/settings.json': '{"env": {"MY_TOKEN": "abc"}}',
  'packages/oa-secret/.claude/settings.local.json': '{"env": {"MY_TOKEN": "abc"}}',
  'packages/oa-cost/.claude/settings.json': '{"env": {"FORCE_PROMPT_CACHING_5M": "1"}}',
  'packages/oa-cost/.claude/settings.local.json': '{"env": {"FORCE_PROMPT_CACHING_5M": "1"}}',
  'packages/oa-format/.claude/settings.json': '{"env": {"MCP_TIMEOUT": "30s"}}',
  'packages/oa-format/.claude/settings.local.json': '{"env": {"MCP_TIMEOUT": "30000"}}',
  'packages/oa-format/managed-settings.json':
    '{"availableModels": ["opus"], "env": {"MCP_TIMEOUT": "30s"}}',
  // `settings-defaultshell-powershell-tool` reports only with the option `platforms`, and the
  // configs set no option, so the files below get no report.
  'packages/oa-shell/.claude/settings.json': '{"defaultShell": "powershell"}',
  'packages/oa-shell/.claude/settings.local.json': '{"defaultShell": "powershell"}',
  'packages/oa-shell/managed-settings.json': '{"defaultShell": "powershell"}',
  // `settings-worktree-paths` reads the two project files. A managed file has no project, and a
  // folder that is there gets no report.
  'packages/oa-wt/.claude/settings.json': '{"worktree": {"symlinkDirectories": ["/node_modules"]}}',
  'packages/oa-wt/.claude/settings.local.json': '{"worktree": {"symlinkDirectories": ["gone"]}}',
  'packages/oa-wt/managed-settings.json': '{"worktree": {"symlinkDirectories": ["/node_modules"]}}',
  'packages/oa-wt/managed-settings.d/10-a.json':
    '{"worktree": {"symlinkDirectories": ["/node_modules"]}}',
  'packages/oa-wt/.vscode/settings.json': '{"worktree": {"symlinkDirectories": ["/node_modules"]}}',
  'packages/oa-wt2/.claude/settings.json': '{"worktree": {"sparsePaths": [".claude", "src"]}}',
  'packages/oa-wt2/.claude/settings.local.json':
    '{"worktree": {"symlinkDirectories": [".claude"]}}',
  'packages/oa-wt2/src/main.ts': '',
  // `settings-managed-merge` reads the drop-ins. `settings-managed-file` owns the key in
  // `managed-settings.json`.
  'packages/oa-merge/managed-settings.json': '{"availableModels": ["opus"]}',
  'packages/oa-merge/managed-settings.d/10-a.json': '{"managedSourcesBehavior": "merge"}',
  'packages/oa-merge/managed-settings.d/20-b.json': '{"managedSourcesBehavior": "first-wins"}',
  // `settings-managed-effort-cap` reads the merged managed source. A cap in a drop-in makes the
  // main file silent.
  'packages/oa-effort/managed-settings.json': '{"effortLevel": "high"}',
  'packages/oa-effort/managed-settings.d/10-a.json': '{"availableModels": ["opus"]}',
  'packages/oa-effort/.claude/settings.json': '{"effortLevel": "high"}',
  'packages/oa-effort2/managed-settings.json': '{"effortLevel": "high"}',
  'packages/oa-effort2/managed-settings.d/10-a.json': '{"maxEffortLevel": "high"}',
  // `statusline-home-path-shared` reads the shared file only. The committed-helper rule reports
  // the command in the shared file too.
  'packages/oa-home/.claude/settings.json':
    '{"statusLine": {"type": "command", "command": "~/.claude/statusline.sh"}}',
  'packages/oa-home/.claude/settings.local.json':
    '{"statusLine": {"type": "command", "command": "~/.claude/statusline.sh"}}',
  'packages/oa-home/managed-settings.json':
    '{"statusLine": {"type": "command", "command": "~/.claude/statusline.sh"}}',
  // `statusline-script-terminal-size` reads the script of the project and managed files. The script
  // of the local file reads COLUMNS.
  'packages/oa-size/.claude/settings.json':
    '{"statusLine": {"type": "command", "command": ".claude/statusline.sh"}}',
  'packages/oa-size/.claude/settings.local.json':
    '{"statusLine": {"type": "command", "command": ".claude/columns.sh"}}',
  'packages/oa-size/.claude/statusline.sh': '#!/bin/bash\necho "$(tput cols)"\n',
  'packages/oa-size/.claude/columns.sh': `#!/bin/bash\necho "\${COLUMNS}"\n`,
  'packages/oa-size/managed-settings.json': `{"statusLine": {"type": "command", "command": "\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh"}}`,
  'packages/oa-size/managed-settings.d/10-a.json': `{"statusLine": {"type": "command", "command": "\${CLAUDE_PROJECT_DIR}/.claude/columns.sh"}}`,
  // `settings-webfetch-preflight-skip` reads the project files and the managed files. A
  // `WebFetch(...)` rule in the other file of the folder, or of the managed source, is silent.
  'packages/wf/.claude/settings.json': '{"skipWebFetchPreflight": true}',
  'packages/wf/.claude/settings.local.json': '{"skipWebFetchPreflight": true}',
  'packages/wf/managed-settings.json': '{"skipWebFetchPreflight": true}',
  'packages/wf/managed-settings.d/10-a.json': '{"skipWebFetchPreflight": true}',
  'packages/wf/managed-settings.d/.20-hidden.json': '{"skipWebFetchPreflight": true}',
  'packages/wf/managed-settings.d/30-b.txt': '{"skipWebFetchPreflight": true}',
  'packages/wf/.vscode/settings.json': '{"skipWebFetchPreflight": true}',
  'packages/wf2/.claude/settings.json': '{"skipWebFetchPreflight": true}',
  'packages/wf2/.claude/settings.local.json':
    '{"permissions": {"deny": ["WebFetch(domain:evil.example)"]}}',
  'packages/wf2/managed-settings.json': '{"skipWebFetchPreflight": true}',
  'packages/wf2/managed-settings.d/10-a.json':
    '{"permissions": {"deny": ["WebFetch(domain:evil.example)"]}}',
  // The warn rules of the managed and status line layer of #14. Each group has the files that the
  // rule reads, a hidden drop-in, and the same content where no rule reads it.
  // `settings-env-numeric-spelling` reads the project and managed files. The variable of
  // `packages/numeric2` has a form in `settings-env-value-format`, which reports it.
  'packages/numeric/.claude/settings.json': '{"env": {"API_TIMEOUT_MS": "1e6"}}',
  'packages/numeric/.claude/settings.local.json': '{"env": {"MAX_THINKING_TOKENS": "64_000"}}',
  'packages/numeric/managed-settings.json': '{"env": {"API_TIMEOUT_MS": "2e3"}}',
  'packages/numeric/managed-settings.d/10-a.json': '{"env": {"API_TIMEOUT_MS": "1_000"}}',
  'packages/numeric/managed-settings.d/.20-hidden.json': '{"env": {"API_TIMEOUT_MS": "1e6"}}',
  'packages/numeric/managed-settings.d/30-b.txt': '{"env": {"API_TIMEOUT_MS": "1e6"}}',
  'packages/numeric/managed-settings.d/sub/40-c.json': '{"env": {"API_TIMEOUT_MS": "1e6"}}',
  'packages/numeric/.vscode/settings.json': '{"env": {"API_TIMEOUT_MS": "1e6"}}',
  'packages/numeric2/.claude/settings.json':
    '{"env": {"CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS": "9e5"}}',
  'packages/numeric3/.claude/settings.json': '{"env": {"API_TIMEOUT_MS": "1000000"}}',
  // `settings-worktree-sparse-claude-dir` reads the project and managed files. A list with
  // `.claude` in the other file of the folder or of the managed source is silent.
  'packages/sparse/.claude/settings.json': '{"worktree": {"sparsePaths": ["packages/api"]}}',
  'packages/sparse/.claude/settings.local.json': '{"worktree": {"sparsePaths": ["packages/api"]}}',
  'packages/sparse/managed-settings.json': '{"worktree": {"sparsePaths": ["packages/api"]}}',
  'packages/sparse/managed-settings.d/10-a.json': '{"worktree": {"sparsePaths": ["packages/web"]}}',
  'packages/sparse/managed-settings.d/.20-hidden.json': '{"worktree": {"sparsePaths": ["x"]}}',
  'packages/sparse/managed-settings.d/30-b.txt': '{"worktree": {"sparsePaths": ["x"]}}',
  'packages/sparse/managed-settings.d/sub/40-c.json': '{"worktree": {"sparsePaths": ["x"]}}',
  'packages/sparse/.vscode/settings.json': '{"worktree": {"sparsePaths": ["x"]}}',
  'packages/sparse2/.claude/settings.json': '{"worktree": {"sparsePaths": ["packages/api"]}}',
  'packages/sparse2/.claude/settings.local.json': '{"worktree": {"sparsePaths": [".claude"]}}',
  'packages/sparse3/managed-settings.json': '{"worktree": {"sparsePaths": ["packages/api"]}}',
  'packages/sparse3/managed-settings.d/10-a.json': '{"worktree": {"sparsePaths": [".claude"]}}',
  // `settings-footerlinks-pattern` reads the managed files. The project file of `packages/footer` has
  // the key, and `settings-key-scope` reports it there.
  'packages/footer/managed-settings.json':
    '{"footerLinksRegexes": [{"type": "regex", "pattern": "(a+)+", "url": "https://x.example/{k}"}]}',
  'packages/footer/managed-settings.d/10-a.json':
    '{"footerLinksRegexes": [{"type": "regex", "pattern": "a", "url": "https://x.example/{k}", "label": "123456789012345678901234567890"}]}',
  'packages/footer/managed-settings.d/.20-hidden.json':
    '{"footerLinksRegexes": [{"type": "regex", "pattern": "(a+)+", "url": "https://x.example/{k}"}]}',
  'packages/footer/managed-settings.d/30-b.txt':
    '{"footerLinksRegexes": [{"type": "regex", "pattern": "(a+)+", "url": "https://x.example/{k}"}]}',
  'packages/footer/.claude/settings.json':
    '{"footerLinksRegexes": [{"type": "regex", "pattern": "(a+)+", "url": "https://x.example/{k}"}]}',
  'packages/footer2/managed-settings.json':
    '{"footerLinksRegexes": [{"type": "regex", "pattern": "\\\\b(?<k>X-\\\\d+)\\\\b", "url": "https://x.example/{k}", "label": "{k}"}]}',
  // `settings-managed-value-form` reads the managed files. The project file of `packages/form` sets
  // the same variable, and no rule reports it.
  'packages/form/managed-settings.json': '{"env": {"DISABLE_TELEMETRY": "0"}}',
  'packages/form/managed-settings.d/10-a.json': '{"env": {"DO_NOT_TRACK": "false"}}',
  'packages/form/managed-settings.d/.20-hidden.json': '{"env": {"DISABLE_TELEMETRY": "0"}}',
  'packages/form/managed-settings.d/30-b.txt': '{"env": {"DISABLE_TELEMETRY": "0"}}',
  'packages/form/.claude/settings.json': '{"env": {"DISABLE_TELEMETRY": "0"}}',
  'packages/form2/managed-settings.json': '{"env": {"DISABLE_TELEMETRY": "1"}}',
  // `settings-managed-version-floor` reads the managed files. A floor of 2.1.283 in the other file
  // of the source is silent. The project file of `packages/floor` has `deniedModels`, and
  // `settings-key-scope` reports it there.
  'packages/floor/managed-settings.json': '{"deniedModels": ["claude-opus-5-5"]}',
  'packages/floor/managed-settings.d/10-a.json': '{"availableModelsMatch": "exact"}',
  'packages/floor/managed-settings.d/.20-hidden.json': '{"requiredMinimumVersion": "2.1.283"}',
  'packages/floor/managed-settings.d/30-b.txt': '{"requiredMinimumVersion": "2.1.283"}',
  'packages/floor/.claude/settings.json': '{"deniedModels": ["claude-opus-5-5"]}',
  'packages/floor2/managed-settings.json': '{"deniedModels": ["claude-opus-5-5"]}',
  'packages/floor2/managed-settings.d/10-a.json': '{"requiredMinimumVersion": "2.1.283"}',
  // `statusline-windows-path` reads the project and managed files. The shared file of
  // `packages/winpath` also gets the report of `settings-committed-helper-command`.
  'packages/winpath/.claude/settings.json':
    '{"statusLine": {"type": "command", "command": "node C:\\\\Users\\\\me\\\\status.mjs"}}',
  'packages/winpath/.claude/settings.local.json':
    '{"statusLine": {"type": "command", "command": "node C:\\\\Users\\\\me\\\\status.mjs"}}',
  'packages/winpath/managed-settings.json':
    '{"statusLine": {"type": "command", "command": "node C:\\\\Users\\\\me\\\\status.mjs"}}',
  'packages/winpath/managed-settings.d/10-a.json':
    '{"statusLine": {"type": "command", "command": "node C:\\\\Users\\\\me\\\\status.mjs"}}',
  'packages/winpath/managed-settings.d/.20-hidden.json':
    '{"statusLine": {"type": "command", "command": "node C:\\\\Users\\\\me\\\\status.mjs"}}',
  'packages/winpath/managed-settings.d/30-b.txt':
    '{"statusLine": {"type": "command", "command": "node C:\\\\Users\\\\me\\\\status.mjs"}}',
  'packages/winpath/.vscode/settings.json':
    '{"statusLine": {"type": "command", "command": "node C:\\\\Users\\\\me\\\\status.mjs"}}',
  'packages/winpath2/managed-settings.json':
    '{"statusLine": {"type": "command", "command": "node C:/Users/me/status.mjs"}}',
  // The `.mcp.json` rules of #16. A project file with one fault for each content rule, a file
  // with the VS Code key, and a clean file. `MCP_SIZE_TREE` holds the file over the size limit.
  'packages/mc/.mcp.json': badMcp,
  'packages/mk2/.mcp.json': '{"servers": {"db": {"command": "x"}}}',
  'packages/mok/.mcp.json': '{"mcpServers": {"db": {"command": "x", "timeout": 5000}}}',
  // The three paths under `.claude/` that Claude Code does not read. Only `mcp-json-location`
  // reports them, and the content rules skip them. A nearby path is silent for every rule.
  'packages/mu/.claude/.mcp.json': badMcp,
  'packages/mu/.claude/mcp.json': badMcp,
  'packages/mu/.claude/config/mcp.json': badMcp,
  'packages/mu/.claude/other/mcp.json': badMcp,
  // A plugin `.mcp.json` may omit the wrapper, and may hold a placeholder with an empty `url`.
  // The plugin root is `plugins/p`, which has a manifest above. The servers-key and URL rules skip
  // it. The other content rules read it.
  'plugins/p/.mcp.json': JSON.stringify(badMcpServers),
  // `mcp-settings-mcpservers`: the key in the two project files. The rule does not read a managed
  // file. The same content where no rule reads it.
  'packages/mcs/.claude/settings.json': '{"mcpServers": {"db": {"command": "x"}}}',
  'packages/mcs/.claude/settings.local.json': '{"mcpServers": {"db": {"command": "x"}}}',
  'packages/mcs/managed-settings.json': '{"mcpServers": {"db": {"command": "x"}}}',
  'packages/mcs/.vscode/settings.json': '{"mcpServers": {"db": {"command": "x"}}}',
  // `mcp-project-plugin-bundle`: an MCP bundle in a plugin directly under `.claude/skills/`. A
  // JSON file in such a plugin, a bundle in a plugin at another place, and a deeper directory are
  // silent.
  'packages/pb/.claude/skills/p/.claude-plugin/plugin.json': '{"mcpServers": "./server.mcpb"}',
  'packages/pb/.claude/skills/q/.claude-plugin/plugin.json': '{"mcpServers": "./servers.json"}',
  // An absolute path leaves the plugin directory.
  'packages/pb/.claude/skills/r/.claude-plugin/plugin.json': '{"mcpServers": "/opt/servers.json"}',
  'packages/pb/.claude/skills/p/sub/.claude-plugin/plugin.json': '{"mcpServers": "./server.mcpb"}',
  'packages/pb/.claude-plugin/plugin.json': '{"mcpServers": "./server.mcpb"}',
  // `mcp-tool-name-format`: a tool reference with one underscore, in each file that the rule reads.
  // A hidden drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/tn/.claude/settings.json': '{"permissions": {"allow": ["mcp_server_tool"]}}',
  'packages/tn/.claude/settings.local.json': '{"permissions": {"deny": ["mcp_server_tool"]}}',
  'packages/tn/managed-settings.json': '{"permissions": {"ask": ["mcp_server_tool"]}}',
  'packages/tn/managed-settings.d/10-a.json': '{"permissions": {"allow": ["mcp_server_tool"]}}',
  'packages/tn/managed-settings.d/.20-hidden.json':
    '{"permissions": {"allow": ["mcp_server_tool"]}}',
  'packages/tn/managed-settings.d/30-b.txt': '{"permissions": {"allow": ["mcp_server_tool"]}}',
  'packages/tn/managed-settings.d/sub/40-c.json': '{"permissions": {"allow": ["mcp_server_tool"]}}',
  'packages/tn/.vscode/settings.json': '{"permissions": {"allow": ["mcp_server_tool"]}}',
  'packages/tn/.claude/skills/s/SKILL.md': '---\nallowed-tools: mcp_server_tool\n---\n',
  'packages/tn/docs/SKILL.md': '---\nallowed-tools: mcp_server_tool\n---\n',
  // `mcp-approval-committed`: an approval key in the committed project file. The local file and the
  // managed files are silent. The same content where no rule reads it.
  'packages/ma/.claude/settings.json': '{"enableAllProjectMcpServers": true}',
  'packages/ma/.claude/settings.local.json': '{"enableAllProjectMcpServers": true}',
  'packages/ma/managed-settings.json': '{"enableAllProjectMcpServers": true}',
  'packages/ma/.vscode/settings.json': '{"enableAllProjectMcpServers": true}',
  'packages/ma2/.claude/settings.json': '{"enabledMcpjsonServers": ["db"]}',
  'packages/ma2/.claude/settings.local.json': '{"enabledMcpjsonServers": ["db"]}',
  'packages/ma2/managed-settings.d/10-a.json': '{"enabledMcpjsonServers": ["db"]}',
  // `mcp-disable-connectors-false`: `false` in a managed file and in a drop-in. The project files
  // are for `settings-project-value-ignored`, so the value gets one report there. A hidden
  // drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/dc/managed-settings.json': '{"disableClaudeAiConnectors": false}',
  'packages/dc/managed-settings.d/10-a.json': '{"disableClaudeAiConnectors": false}',
  'packages/dc/managed-settings.d/.20-hidden.json': '{"disableClaudeAiConnectors": false}',
  'packages/dc/managed-settings.d/30-b.txt': '{"disableClaudeAiConnectors": false}',
  'packages/dc/managed-settings.d/sub/40-c.json': '{"disableClaudeAiConnectors": false}',
  'packages/dc/.claude/settings.json': '{"disableClaudeAiConnectors": false}',
  'packages/dc/.claude/settings.local.json': '{"disableClaudeAiConnectors": false}',
  'packages/dc/.vscode/settings.json': '{"disableClaudeAiConnectors": false}',
  // `mcp-policy-entry-schema`: an invalid policy entry in each file that the rule reads. A hidden
  // drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/pe/.claude/settings.json': '{"allowedMcpServers": [1]}',
  'packages/pe/.claude/settings.local.json': '{"deniedMcpServers": [{}]}',
  'packages/pe/managed-settings.json': '{"allowedMcpServers": [{"serverName": "a b"}]}',
  'packages/pe/managed-settings.d/10-a.json': '{"deniedMcpServers": [{"serverName": " x"}]}',
  'packages/pe/managed-settings.d/.20-hidden.json': '{"allowedMcpServers": [1]}',
  'packages/pe/managed-settings.d/30-b.txt': '{"allowedMcpServers": [1]}',
  'packages/pe/managed-settings.d/sub/40-c.json': '{"allowedMcpServers": [1]}',
  'packages/pe/.vscode/settings.json': '{"allowedMcpServers": [1]}',
  // `lsp-json-schema` and `lsp-transport-socket`: a `.lsp.json` at a plugin root has both faults. A
  // valid file, a file in a directory with no manifest, a file below the root, and a file with
  // another name are silent. The inline `lspServers` of a `plugin.json` is for the socket rule only.
  // The `.git` makes `plugins/q` the repository root, so the walk of `lsp-json-location` from
  // `sub/` ends at the plugin root. The tree has no other `.git`, and the walk stops at the folder.
  'plugins/q/.git/HEAD': 'ref: refs/heads/main\n',
  'plugins/q/.lsp.json': badLsp,
  'plugins/q/sub/.lsp.json': badLsp,
  'plugins/q/lsp.json': badLsp,
  'plugins/m/.lsp.json': goodLsp,
  'packages/lp/.lsp.json': badLsp,
  'plugins/lx/.claude-plugin/plugin.json': JSON.stringify({
    name: 'lx',
    lspServers: JSON.parse(badLsp),
  }),
  // `mcp-allowlist-servername-dead`: the main file has the three kinds. A drop-in with names only is
  // dead too, because the lists combine. A hidden drop-in is for `settings-managed-file`. The same
  // content where no rule reads it.
  'packages/mad/managed-settings.json': deadAllowlist,
  'packages/mad/managed-settings.d/10-a.json': JSON.stringify({
    allowedMcpServers: [{ serverName: 'b' }],
  }),
  'packages/mad/managed-settings.d/.20-hidden.json': deadAllowlist,
  'packages/mad/managed-settings.d/30-b.txt': deadAllowlist,
  'packages/mad/managed-settings.d/sub/40-c.json': deadAllowlist,
  'packages/mad/.claude/settings.json': deadAllowlist,
  'packages/mad/.vscode/settings.json': deadAllowlist,
  // `mcp-managed-servers-entry`: an array in the main file, and a dropped entry in a drop-in. A
  // hidden drop-in is for `settings-managed-file`. The same content where no rule reads it.
  'packages/me/managed-settings.json': badManagedArray,
  'packages/me/managed-settings.d/10-a.json': badManagedEntry,
  'packages/me/managed-settings.d/.20-hidden.json': badManagedEntry,
  'packages/me/managed-settings.d/30-b.txt': badManagedEntry,
  'packages/me/managed-settings.d/sub/40-c.json': badManagedEntry,
  'packages/me/.vscode/settings.json': badManagedEntry,
  // `mcp-insecure-url`: an `http://` URL in a project file. A plugin file is for `claude plugin
  // validate`, and a loopback host is silent.
  'packages/iu/.mcp.json':
    '{"mcpServers": {"a": {"type": "http", "url": "http://example.com/mcp"}}}',
  'packages/iu/dev/.mcp.json':
    '{"mcpServers": {"a": {"type": "http", "url": "http://localhost:3000/mcp"}}}',
  'plugins/iu/.claude-plugin/plugin.json': JSON.stringify({
    name: 'iu',
    mcpServers: { b: { type: 'http', url: 'http://example.com/mcp' } },
  }),
  'plugins/iu/.mcp.json':
    '{"mcpServers": {"a": {"type": "http", "url": "http://example.com/mcp"}}}',
  // `mcp-allowlist-empty`, `mcp-policy-literal-values` and `mcp-policy-servername-weak`: the
  // managed files. A hidden drop-in, a file that is not a `.json` file and a project file are
  // silent. `mcp-plugin-stdio-reach` reports nothing, because `targets` is unset.
  'packages/ae/managed-settings.json': '{"allowedMcpServers": []}',
  'packages/ae/managed-settings.d/.10-hidden.json': '{"allowedMcpServers": []}',
  'packages/ae/managed-settings.d/20-b.txt': '{"allowedMcpServers": []}',
  'packages/ae/.vscode/settings.json': '{"allowedMcpServers": []}',
  'packages/lv/managed-settings.json': variableAllowlist,
  'packages/lv/managed-settings.d/.10-hidden.json': variableAllowlist,
  'packages/lv/.vscode/settings.json': variableAllowlist,
  'packages/sw/managed-settings.json': '{"deniedMcpServers": [{"serverName": "a"}]}',
  'packages/sw/managed-settings.d/.10-hidden.json': '{"deniedMcpServers": [{"serverName": "a"}]}',
  'packages/sw/.vscode/settings.json': '{"deniedMcpServers": [{"serverName": "a"}]}',
  // `mcp-env-client-secret`: the secret in the committed project file. The local file and the
  // managed files are silent. The same content where no rule reads it.
  'packages/cs/.claude/settings.json': '{"env": {"MCP_CLIENT_SECRET": "s3cret"}}',
  'packages/cs/.claude/settings.local.json': '{"env": {"MCP_CLIENT_SECRET": "s3cret"}}',
  'packages/cs/managed-settings.json': '{"env": {"MCP_CLIENT_SECRET": "s3cret"}}',
  'packages/cs/managed-settings.d/10-a.json': '{"env": {"MCP_CLIENT_SECRET": "s3cret"}}',
  'packages/cs/.vscode/settings.json': '{"env": {"MCP_CLIENT_SECRET": "s3cret"}}',
  // `mcp-duplicate-server-name`: `db` in `.mcp.json` and in the inline map. A plugin with distinct
  // names, and a `plugin.json` outside `.claude-plugin/`, are silent.
  'plugins/dn/.claude-plugin/plugin.json': JSON.stringify({
    name: 'dn',
    mcpServers: { db: { command: 'x' } },
  }),
  'plugins/dn/.mcp.json': '{"mcpServers": {"db": {"command": "x"}}}',
  // `mcp-server-name-format`, `mcp-server-name-anthropic-skills`, `mcp-no-sse-transport` and
  // `mcp-headershelper-path` read the inline servers of a manifest.
  'plugins/ns/.claude-plugin/plugin.json': JSON.stringify({
    name: 'ns',
    mcpServers: {
      'bad.name': { type: 'sse', url: 'https://x.test/sse', headersHelper: './h.sh' },
      'anthropic-skills': { command: 'x' },
    },
  }),
  'plugins/dv/.claude-plugin/plugin.json': JSON.stringify({
    name: 'dv',
    mcpServers: { web: { command: 'x' } },
  }),
  'plugins/dv/.mcp.json': '{"mcpServers": {"db": {"command": "x"}}}',
  'packages/dn/plugin.json': JSON.stringify({ name: 'dn', mcpServers: [{ db: {} }, { db: {} }] }),
  // `lsp-extension-conflict`: two plugins of one marketplace claim `.go`. A marketplace with
  // distinct extensions, and the same content where no rule reads it, are silent.
  'packages/lc/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'lc',
    owner: { name: 'lc' },
    plugins: [
      { name: 'a', source: './plugins/a' },
      { name: 'b', source: './plugins/b' },
    ],
  }),
  'packages/lc/plugins/a/.claude-plugin/plugin.json': JSON.stringify({ name: 'a' }),
  'packages/lc/plugins/a/.lsp.json': goodLsp,
  'packages/lc/plugins/b/.claude-plugin/plugin.json': JSON.stringify({ name: 'b' }),
  'packages/lc/plugins/b/.lsp.json': goodLsp,
  'packages/lv/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'lv',
    owner: { name: 'lv' },
    plugins: [
      { name: 'a', source: './plugins/a' },
      { name: 'b', source: './plugins/b' },
    ],
  }),
  'packages/lv/plugins/a/.claude-plugin/plugin.json': JSON.stringify({ name: 'a' }),
  'packages/lv/plugins/a/.lsp.json': goodLsp,
  'packages/lv/plugins/b/.claude-plugin/plugin.json': JSON.stringify({ name: 'b' }),
  'packages/lv/plugins/b/.lsp.json': JSON.stringify({
    rs: { command: 'rust-analyzer', extensionToLanguage: { '.rs': 'rust' } },
  }),
  'packages/lc/marketplace.json': JSON.stringify({ plugins: [{ source: './plugins/a' }] }),
  // `lsp-duplicate-server-name`: `go` in `.lsp.json` and in the inline map.
  'plugins/ld/.claude-plugin/plugin.json': JSON.stringify({
    name: 'ld',
    lspServers: JSON.parse(goodLsp),
  }),
  'plugins/ld/.lsp.json': goodLsp,
  // `mcp-plugin-tool-name-scoped`: a bare tool of the plugin's own server, in each Markdown file
  // that the rule reads. A skill outside a plugin, a server that the plugin does not declare, and
  // the same content where no rule reads it, are silent.
  'plugins/ts/.claude-plugin/plugin.json': JSON.stringify({ name: 'ts' }),
  'plugins/ts/.mcp.json': '{"mcpServers": {"db": {"command": "x"}}}',
  'plugins/ts/skills/s/SKILL.md': '---\nallowed-tools: mcp__db__q\n---\n',
  'plugins/ts/commands/c.md': '---\nallowed-tools: mcp__db__q\n---\n',
  'plugins/ts/agents/a.md': '---\nname: a\ndescription: d\ntools: mcp__db__q\n---\n',
  'plugins/ts/skills/o/SKILL.md': '---\nallowed-tools: mcp__other__q mcp__plugin_ts_db__q\n---\n',
  'plugins/ts/docs/SKILL.md': '---\nallowed-tools: mcp__db__q\n---\n',
  // The `off` rules of #16 read these trees. `mcp-tool-server-unknown`: a server that `.mcp.json`
  // lacks, in each project file, a skill and a command. A managed file and a skill outside a
  // skills folder are silent.
  'packages/tu/.mcp.json': '{"mcpServers": {"db": {"command": "x"}}}',
  'packages/tu/.claude/settings.json': '{"permissions": {"allow": ["mcp__nope__t"]}}',
  'packages/tu/.claude/settings.local.json': '{"permissions": {"deny": ["mcp__nope__t"]}}',
  'packages/tu/.claude/skills/s/SKILL.md': '---\nallowed-tools: mcp__nope__t\n---\n',
  'packages/tu/.claude/commands/c.md': '---\nallowed-tools: mcp__nope__t\n---\n',
  'packages/tu/managed-settings.json': '{"permissions": {"allow": ["mcp__nope__t"]}}',
  'packages/tu/docs/SKILL.md': '---\nallowed-tools: mcp__nope__t\n---\n',
  // `mcp-project-toggle-keys` and `mcp-env-var-numbers`: the key and the value in each settings
  // file. A hidden drop-in is for `settings-managed-file`.
  'packages/tk/.claude/settings.json':
    '{"disabledMcpServers": ["a"], "env": {"MCP_TIMEOUT": "30"}}',
  'packages/tk/.claude/settings.local.json': '{"enabledMcpServers": ["a"]}',
  'packages/tk/managed-settings.json': '{"env": {"MCP_TOOL_TIMEOUT": "30"}}',
  'packages/tk/managed-settings.d/10-a.json': '{"disabledMcpServers": ["a"]}',
  'packages/tk/managed-settings.d/.20-hidden.json':
    '{"disabledMcpServers": ["a"], "env": {"MCP_TIMEOUT": "30"}}',
  'packages/tk/.vscode/settings.json':
    '{"disabledMcpServers": ["a"], "env": {"MCP_TIMEOUT": "30"}}',
  // `mcp-always-load-count`: three servers with `alwaysLoad`, and a project with two.
  'packages/al/.mcp.json': JSON.stringify({
    mcpServers: {
      a: { command: 'x', alwaysLoad: true },
      b: { command: 'x', alwaysLoad: true },
      c: { command: 'x', alwaysLoad: true },
    },
  }),
  'packages/al/two/.mcp.json': JSON.stringify({
    mcpServers: { a: { command: 'x', alwaysLoad: true }, b: { command: 'x', alwaysLoad: true } },
  }),
  // `mcp-no-literal-secrets` and `mcp-env-var-syntax`: a literal token and a `$VAR`, in
  // `.mcp.json` and `managed-mcp.json`. The same content in another file is silent.
  'packages/sk/.mcp.json': JSON.stringify({
    mcpServers: { a: { command: '$HOME/bin/x', env: { API_KEY: 'abc123' } } },
  }),
  'packages/sk/managed-mcp.json': JSON.stringify({
    mcpServers: { a: { command: 'x', env: { API_KEY: 'abc123' } } },
  }),
  'packages/sk/other.json': JSON.stringify({
    mcpServers: { a: { command: '$HOME/bin/x', env: { API_KEY: 'abc123' } } },
  }),
  // `mcp-env-var-default`, `mcp-unknown-keys` and `mcp-stdio-command-has-args`: one entry with a
  // bare reference, an unknown key and a command with a space. A good entry and the same content
  // in another file are silent.
  'packages/ek/.mcp.json': JSON.stringify({
    mcpServers: { a: { command: 'npx -y s', cwd: '/t', env: { K: `\${API_KEY}` } } },
  }),
  'packages/ek/ok/.mcp.json': JSON.stringify({
    mcpServers: { a: { command: 'npx', args: ['-y', 's'], env: { K: `\${API_KEY:-x}` } } },
  }),
  'packages/ek/other.json': JSON.stringify({
    mcpServers: { a: { command: 'npx -y s', cwd: '/t', env: { K: `\${API_KEY}` } } },
  }),
  // `mcp-plugin-root-paths`: a relative path in a plugin file. The root variable is silent. A
  // project file is for `mcp-stdio-relative-path`.
  'plugins/rp/.claude-plugin/plugin.json': '{"name": "rp"}',
  'plugins/rp/.mcp.json': JSON.stringify({ mcpServers: { a: { command: './server.js' } } }),
  'plugins/rq/.claude-plugin/plugin.json': '{"name": "rq"}',
  'plugins/rq/.mcp.json': JSON.stringify({
    mcpServers: { a: { command: `\${CLAUDE_PLUGIN_ROOT}/server.js` } },
  }),
  'packages/rl/.mcp.json': JSON.stringify({ mcpServers: { a: { command: './server.js' } } }),
  // `lsp-json-location`: a `.lsp.json` with no plugin, under `.claude/`, and at a plugin root.
  'packages/ll/.lsp.json': goodLsp,
  'packages/ll/.claude/.lsp.json': goodLsp,
  'plugins/lk/.claude-plugin/plugin.json': '{"name": "lk"}',
  'plugins/lk/.lsp.json': goodLsp,
  // `mcp-approval-names-exist`: a name that `.mcp.json` does not declare, in each project file.
  // The managed files are silent.
  'packages/an/.mcp.json': '{"mcpServers": {"db": {"command": "x"}}}',
  'packages/an/.claude/settings.json': '{"enabledMcpjsonServers": ["db", "gone"]}',
  'packages/an/.claude/settings.local.json': '{"disabledMcpjsonServers": ["missing"]}',
  'packages/an/managed-settings.json': '{"enabledMcpjsonServers": ["gone"]}',
  'packages/an/.vscode/settings.json': '{"enabledMcpjsonServers": ["gone"]}',
  // `mcp-approval-conflict`: a name in both lists. The project pair reports in the file with the
  // enabled entry. The managed pair reports in the drop-in with the enabled entry. A hidden drop-in
  // is for `settings-managed-file`.
  'packages/mac/.claude/settings.json': '{"enabledMcpjsonServers": ["db"]}',
  'packages/mac/.claude/settings.local.json': '{"disabledMcpjsonServers": ["db"]}',
  'packages/mac/managed-settings.json': '{"disabledMcpjsonServers": ["db"]}',
  'packages/mac/managed-settings.d/10-a.json': '{"enabledMcpjsonServers": ["db"]}',
  'packages/mac/managed-settings.d/.20-hidden.json': '{"enabledMcpjsonServers": ["db"]}',
  'packages/mac/.vscode/settings.json': '{"enabledMcpjsonServers": ["db"]}',
  // `mcp-allow-deny-overlap`: the same shape for the policy lists.
  'packages/ao/.claude/settings.json': '{"allowedMcpServers": [{"serverName": "db"}]}',
  'packages/ao/.claude/settings.local.json': '{"deniedMcpServers": [{"serverName": "db"}]}',
  'packages/ao/managed-settings.json': '{"deniedMcpServers": [{"serverName": "db"}]}',
  'packages/ao/managed-settings.d/10-a.json': '{"allowedMcpServers": [{"serverName": "db"}]}',
  'packages/ao/managed-settings.d/.20-hidden.json': '{"allowedMcpServers": [{"serverName": "db"}]}',
  'packages/ao/.vscode/settings.json': '{"allowedMcpServers": [{"serverName": "db"}]}',
  // The same content where no rule reads it: other names and other directories.
  'packages/mc/mcp.json': badMcp,
  'packages/mc/.mcp.json.bak': badMcp,
  'packages/mc/sub/mcp.json': '{"servers": {}}',
  '.vscode/mcp.json': '{"servers": {"db": {"command": "x"}}}',
}

// The files that the test stages in the repository `packages/hx`, for the rules that read the git
// index mode. Every file has index mode `100644`, except the four that `GIT_EXECUTABLE` names.
const GIT_REPO = 'packages/hx'
const GIT_TREE: Record<string, string> = {
  'tools/run.sh': '#!/bin/sh\n',
  'scripts/run.sh': '#!/bin/sh\n',
  'ok/tools/ok.sh': '#!/bin/sh\n',
  '.claude/settings.json': JSON.stringify(hookOf(`${projectDir}/tools/run.sh`)),
  '.claude/settings.local.json': JSON.stringify(hookOf('./tools/run.sh')),
  'managed-settings.json': JSON.stringify({
    model: 'opus',
    ...hookOf(`${projectDir}/tools/run.sh`),
  }),
  'managed-settings.d/10-a.json': JSON.stringify({
    model: 'opus',
    ...hookOf(`${projectDir}/tools/run.sh`),
  }),
  'managed-settings.d/.20-hidden.json': JSON.stringify({
    model: 'opus',
    ...hookOf(`${projectDir}/tools/run.sh`),
  }),
  'managed-settings.d/30-b.txt': JSON.stringify(hookOf(`${projectDir}/tools/run.sh`)),
  'managed-settings.d/sub/40-c.json': JSON.stringify(hookOf(`${projectDir}/tools/run.sh`)),
  '.vscode/settings.json': JSON.stringify(hookOf(`${projectDir}/tools/run.sh`)),
  'ok/.claude/settings.json': JSON.stringify(hookOf(`${projectDir}/tools/ok.sh`)),
  'plugin/.claude-plugin/plugin.json': JSON.stringify({ name: 'hx' }),
  'plugin/scripts/run.sh': '#!/bin/sh\n',
  'plugin/hooks/hooks.json': JSON.stringify(hookOf(`${pluginRoot}/scripts/run.sh`)),
  'plugin/hooks/other.json': JSON.stringify(hookOf(`${pluginRoot}/scripts/run.sh`)),
  'loose/scripts/run.sh': '#!/bin/sh\n',
  'loose/hooks/hooks.json': JSON.stringify(hookOf(`${pluginRoot}/scripts/run.sh`)),
  // `plugin-bin-executable`: a plugin with a file in `bin/` at mode `100644` and one at `100755`,
  // a nested file and a hidden file, which are silent. A plugin with a mode `100755` file only is
  // silent. The `bin/` of a directory that is no plugin is silent.
  'plugin/bin/tool': '#!/bin/sh\n',
  'plugin/bin/ok': '#!/bin/sh\n',
  'plugin/bin/.gitkeep': '',
  'plugin/bin/lib/helper': '#!/bin/sh\n',
  'ok/.claude-plugin/plugin.json': JSON.stringify({ name: 'ok' }),
  'ok/bin/tool': '#!/bin/sh\n',
  'loose/bin/tool': '#!/bin/sh\n',
  // `statusline-script-exists`: a script with mode `100644`, a script that is not there, and a
  // key of each of the three, in each file that it reads. The project of a managed file is the
  // repository, so it names `sl/line.sh`. A hidden drop-in is for `settings-managed-file`. The
  // same content where no rule reads it. A script with mode `100755` is silent.
  'sl/line.sh': '#!/bin/sh\n',
  'sl/ok/line.sh': '#!/bin/sh\n',
  'sl/.claude/settings.json': JSON.stringify({
    statusLine: { type: 'command', command: `${projectDir}/line.sh` },
  }),
  'sl/.claude/settings.local.json': JSON.stringify({
    subagentStatusLine: { type: 'command', command: './gone.sh' },
  }),
  'sl/managed-settings.json': JSON.stringify({
    model: 'opus',
    fileSuggestion: { type: 'command', command: `${projectDir}/sl/line.sh` },
  }),
  'sl/managed-settings.d/10-a.json': JSON.stringify({
    model: 'opus',
    statusLine: { type: 'command', command: `${projectDir}/sl/line.sh` },
  }),
  'sl/managed-settings.d/.20-hidden.json': JSON.stringify({
    model: 'opus',
    statusLine: { type: 'command', command: `${projectDir}/sl/gone.sh` },
  }),
  'sl/managed-settings.d/30-b.txt': JSON.stringify({
    statusLine: { type: 'command', command: `${projectDir}/sl/gone.sh` },
  }),
  'sl/managed-settings.d/sub/40-c.json': JSON.stringify({
    statusLine: { type: 'command', command: `${projectDir}/sl/gone.sh` },
  }),
  'sl/.vscode/settings.json': JSON.stringify({
    statusLine: { type: 'command', command: `${projectDir}/gone.sh` },
  }),
  'sl/ok/.claude/settings.json': JSON.stringify({
    statusLine: { type: 'command', command: `${projectDir}/line.sh` },
  }),
}
// The repository `packages/gu`, for the rules of #11, #13 and #14 that ask git whether a file is
// tracked or ignored. Each area has its own `.gitignore`, so that a pattern covers one area only.
// `GU_LOOSE` holds files that exist but that git does not track.
const GU_REPO = 'packages/gu'
const GU_TREE: Record<string, string> = {
  // The root pattern covers each `settings.local.json`. The area `set/open` takes it back.
  '.gitignore': '**/.claude/settings.local.json\n',
  // `claude-md-local-untracked`: git tracks a `CLAUDE.local.md`; no pattern covers a file that is
  // not there; a pattern covers a file that is there. A file in `.claude/` is not read.
  'claude/bad/CLAUDE.md': '# Project\n',
  'claude/bad/CLAUDE.local.md': 'mine\n',
  'claude/loose/CLAUDE.md': '# Project\n',
  'claude/ok/CLAUDE.md': '# Project\n',
  'claude/ok/.gitignore': 'CLAUDE.local.md\n',
  'claude/dot/.claude/CLAUDE.md': '# Project\n',
  'claude/dot/.claude/CLAUDE.local.md': 'mine\n',
  'claude/dot/OTHER.md': '# Other\n',
  // `memory-agent-memory-local-untracked`: git tracks a memory file of the local scope. The
  // project scope, a directory with the same name outside `.claude/`, and a file that is not
  // Markdown are silent.
  'mem/bad/.claude/agent-memory-local/reviewer/MEMORY.md': '# Memory\n',
  'mem/project/.claude/agent-memory/reviewer/MEMORY.md': '# Memory\n',
  'mem/outside/agent-memory-local/reviewer/MEMORY.md': '# Memory\n',
  'mem/json/.claude/agent-memory-local/reviewer/state.json': '{}\n',
  // `settings-local-untracked`: git tracks a `settings.local.json`; the local file of another
  // project is not read.
  'set/bad/.claude/settings.json': '{}\n',
  'set/bad/.claude/settings.local.json': '{}\n',
  'set/ok/.claude/settings.json': '{}\n',
  'set/ok/other/.claude/settings.local.json': '{}\n',
  // `settings-local-gitignored`: a pattern of a deeper `.gitignore` takes the root pattern back.
  'set/open/.claude/settings.json': '{}\n',
  'set/open/.gitignore': '!.claude/settings.local.json\n',
  // `plugin-evals-results-gitignored`: a plugin with an eval suite and no pattern for its
  // results; the same plugin with a pattern; a plugin with no eval directory.
  'ev/bad/.claude-plugin/plugin.json': JSON.stringify({ name: 'bad' }),
  'ev/bad/evals/first/prompt.md': '# Case\n',
  'ev/ok/.claude-plugin/plugin.json': JSON.stringify({ name: 'ok' }),
  'ev/ok/evals/first/prompt.md': '# Case\n',
  'ev/ok/.gitignore': 'evals/results/\n',
  'ev/none/.claude-plugin/plugin.json': JSON.stringify({ name: 'none' }),
  // `plugin-evals-replay-committed`: a pattern that covers `mocks/.replay/`; recordings that git
  // does not track; recordings that git tracks.
  'rp/ignored/.claude-plugin/plugin.json': JSON.stringify({ name: 'ignored' }),
  'rp/ignored/evals/first/prompt.md': '# Case\n',
  'rp/ignored/.gitignore': 'evals/results/\n.replay/\n',
  'rp/loose/.claude-plugin/plugin.json': JSON.stringify({ name: 'loose' }),
  'rp/loose/evals/first/prompt.md': '# Case\n',
  'rp/loose/.gitignore': 'evals/results/\n',
  'rp/ok/.claude-plugin/plugin.json': JSON.stringify({ name: 'ok' }),
  'rp/ok/evals/mocks/.replay/github/answer.md': 'answer\n',
  'rp/ok/.gitignore': 'evals/results/\n',
}
const GU_LOOSE: Record<string, string> = {
  'claude/ok/CLAUDE.local.md': 'mine\n',
  'mem/ok/.claude/agent-memory-local/reviewer/MEMORY.md': '# Memory\n',
  'set/ok/.claude/settings.local.json': '{}\n',
  'rp/loose/evals/mocks/.replay/github/answer.md': 'answer\n',
}

const GIT_EXECUTABLE = ['ok/tools/ok.sh', 'plugin/bin/ok', 'ok/bin/tool', 'sl/ok/line.sh']

// The one marketplace rule that needs a `.git` and a link, and so has its own tree above.
const ESCAPE_RULE = 'marketplace-relative-source-escape-symlink'
// A link needs a privilege on Windows, so the test makes the one link elsewhere only.
const LINKS = process.platform !== 'win32'

// The permission grammar rules of #15, in the order of the `modules` list. Each is an error.
const GRAMMAR_RULES = [
  'permissions-rule-syntax',
  'permissions-unknown-tool',
  'permissions-tool-name-glob',
  'permissions-specifier-unsupported',
  'permissions-path-rule-tool',
  'permissions-mcp-rule-parens',
  'permissions-param-rule',
]

// The rules that read the settings files and the tool lists of skills. Each has one block for
// JSON and one for Markdown, in that order.
// `permissions-mcp-rule-parens` reads settings files only (ruling 17), so it has one block.
const SETTINGS_ONLY = 'permissions-mcp-rule-parens'
const TOOL_LIST_BLOCKS = [...GRAMMAR_RULES, 'permissions-skill-rule'].flatMap((rule) =>
  rule === SETTINGS_ONLY ? [rule] : [rule, rule],
)

// The marketplace rules of #12, in the order of the `modules` list. Each is an error.
const MARKETPLACE_RULES = [
  'marketplace-name-reserved',
  'marketplace-command-version-ignored',
  'marketplace-headers-helper-command',
  'marketplace-entry-hooks-inline',
  'marketplace-source-schema',
  'marketplace-relative-source-format',
  'marketplace-schema',
  'marketplace-entry-name-matches-manifest',
  'marketplace-relative-source-exists',
  ESCAPE_RULE,
  'marketplace-version-duplicate',
  'marketplace-entry-manifest-only-fields',
  'marketplace-strict-false-conflict',
  'marketplace-entry-hooks-override',
  'marketplace-entry-root-skills',
  'marketplace-entry-component-paths',
]

// The marketplace rules of #12 that are warnings, in the order of the `modules` list.
// `marketplace-location` reads every `marketplace.json`, and the rest read the
// `.claude-plugin/marketplace.json` only.
const LOCATION_RULE = 'marketplace-location'
const MARKETPLACE_WARN_RULES = [
  'marketplace-archive-sha256',
  'marketplace-command-link-mode',
  'marketplace-command-source',
  LOCATION_RULE,
  'marketplace-min-version',
  'marketplace-relative-source-backslash',
  'marketplace-self-hosted-root-source',
]

// The marketplace rules of #12 that are `off` in `recommended`, in the order of the `modules`
// list. `strict` turns each on at `warn`. The credential rule also reads the project settings.
const MARKETPLACE_OFF_RULES = [
  'marketplace-relative-source-url-hosted',
  'marketplace-headers-literal-credential',
]
const CREDENTIAL_RULE = 'marketplace-headers-literal-credential'

// The settings rules of #12, in the order of the `modules` list. Each is an error.
const SETTINGS_RULES = [
  'settings-enabled-plugins-schema',
  'settings-enabled-plugins-entry-exists',
  'settings-extra-known-marketplaces-schema',
  'settings-extra-known-marketplaces-key-matches-name',
  'settings-marketplace-headers-helper-https',
  'settings-marketplace-key-alias-conflict',
  'settings-sync-claude-ai-plugins',
]

// The settings rules of the scope layer of #14, in the order of the `modules` list, with the
// files of each. Each is an error.
const PROJECT_FILES = ['**/.claude/settings.json', '**/.claude/settings.local.json']
const MANAGED_FILES = ['**/managed-settings.json', '**/managed-settings.d/*.json']
const HOOKS_FILES = ['**/hooks/hooks.json', ...PROJECT_FILES, ...MANAGED_FILES]
const SHARED_FILE = ['**/.claude/settings.json']
const SCOPE_RULES: { name: string; files: string[]; severity?: 'warn' }[] = [
  { name: 'settings-valid-json', files: PROJECT_FILES },
  { name: 'settings-file-size', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-key-scope', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-managed-file', files: MANAGED_FILES },
  { name: 'settings-removed-key', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-env-credential', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-env-value-format', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-env-ignored-var', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-project-value-ignored', files: PROJECT_FILES },
  { name: 'settings-known-marketplaces-policy-schema', files: MANAGED_FILES },
  { name: 'settings-plugin-suggestion-marketplaces-source', files: MANAGED_FILES },
  { name: 'settings-conflicting-keys', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-model-value', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-model-list', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-skilloverrides-key', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-env-shadowed', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-schema', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  // The rules of the global layer: five are `warn`, and two are `error`.
  { name: 'settings-attribution-false', files: PROJECT_FILES, severity: 'warn' },
  {
    name: 'settings-deprecated-key',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  {
    name: 'settings-global-only-file',
    files: ['**/.claude/keybindings.json', '**/.claude/themes/*.json', '**/.claude.json'],
  },
  { name: 'settings-outputstyle-resolves', files: PROJECT_FILES },
  {
    name: 'settings-project-autocontinue-off',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  {
    name: 'settings-redundant-value',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  { name: 'settings-schema-url', files: [...PROJECT_FILES, ...MANAGED_FILES], severity: 'warn' },
  // The rules of the env and helper layer are `warn`. Three of them read the shared file only.
  { name: 'settings-committed-helper-command', files: SHARED_FILE, severity: 'warn' },
  {
    name: 'settings-env-deprecated-var',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  { name: 'settings-env-prompt-caching-off', files: SHARED_FILE, severity: 'warn' },
  { name: 'settings-env-routing', files: SHARED_FILE, severity: 'warn' },
  { name: 'settings-local-location', files: ['**/.claude/settings.local.json'], severity: 'warn' },
  {
    name: 'settings-webfetch-preflight-skip',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  // The rules of the managed and status line layer are `warn`. Two of them read managed files only.
  {
    name: 'settings-env-numeric-spelling',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  { name: 'settings-footerlinks-pattern', files: MANAGED_FILES, severity: 'warn' },
  { name: 'settings-managed-value-form', files: MANAGED_FILES, severity: 'warn' },
  { name: 'settings-managed-version-floor', files: MANAGED_FILES, severity: 'warn' },
  {
    name: 'settings-worktree-sparse-claude-dir',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  {
    name: 'statusline-windows-path',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  // The git layer of #10, #11 and #14. The rules that read the index mode need a repository.
  { name: 'hooks-script-exists', files: HOOKS_FILES },
  { name: 'hooks-script-executable', files: HOOKS_FILES },
  { name: 'plugin-bin-executable', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'statusline-script-exists', files: [...PROJECT_FILES, ...MANAGED_FILES] },
]

// The rules of #11, #13 and #14 that ask git whether a file is tracked or ignored, in the order of
// the `modules` list, with the language and files of each. Each is a warn.
const UNTRACKED_RULES = [
  { name: 'claude-md-local-untracked', language: 'markdown/gfm', files: ['**/CLAUDE.md'] },
  {
    name: 'memory-agent-memory-local-untracked',
    language: 'markdown/gfm',
    files: ['**/.claude/agent-memory-local/**/*.md'],
  },
  {
    name: 'plugin-evals-replay-committed',
    language: 'json/json',
    files: ['**/.claude-plugin/plugin.json'],
  },
  {
    name: 'plugin-evals-results-gitignored',
    language: 'json/json',
    files: ['**/.claude-plugin/plugin.json'],
  },
  { name: 'settings-local-gitignored', language: 'json/json', files: ['**/.claude/settings.json'] },
  { name: 'settings-local-untracked', language: 'json/json', files: ['**/.claude/settings.json'] },
]

// The marketplace settings rules of K3 (#12), in the order of the `modules` list, with the files and
// the `recommended` severity of each. `settings-enabled-plugins-marketplace-declared` is `off`:
// `strict` turns it on at `warn`.
const PROJECT_SETTINGS = ['**/.claude/settings.json']
const MARKET_SETTINGS_RULES = [
  { name: 'settings-enabled-plugins-external-source', files: PROJECT_SETTINGS, severity: 'warn' },
  { name: 'settings-enabled-plugins-marketplace-declared', files: PROJECT_FILES, severity: 'off' },
  {
    name: 'settings-extra-known-marketplaces-directory',
    files: PROJECT_SETTINGS,
    severity: 'warn',
  },
  { name: 'settings-known-marketplaces-pattern-anchored', files: MANAGED_FILES, severity: 'warn' },
  {
    name: 'settings-marketplace-key-alias',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  {
    name: 'settings-marketplace-skip-lfs',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    severity: 'warn',
  },
  { name: 'settings-strict-known-marketplaces-skills-dir', files: MANAGED_FILES, severity: 'warn' },
] as const
const MARKET_SETTINGS_OFF_RULES = MARKET_SETTINGS_RULES.filter(
  ({ severity }) => severity === 'off',
).map(({ name }) => name)
// The conflict rule reads the project files, and the managed files for the policy pair.
const CONFLICT_RULE = 'settings-marketplace-key-alias-conflict'
// The CLAUDE.md, rules and memory rules of #13, in the order of the `modules` list. Each is an
// error, and each has one block for its own language.
const MEMORY_RULES = [
  'claude-md-agents-md-shadowed',
  'claude-md-agents-md-variant',
  'claude-md-excludes-pattern',
  'claude-md-import-exists',
  'claude-md-import-max-depth',
  'claude-md-max-bytes',
  'memory-settings-schema',
  'memory-symlink-network-target',
  'rules-frontmatter-schema',
  'rules-md-extension',
  'rules-paths-glob-valid',
  'rules-symlink-external-scoped',
]

// The warn rules of #13 that follow, in the order of the `modules` list. Each has one block for its
// own language.
const MEMORY_WARN_RULES = [
  'claude-md-import-external',
  'claude-md-max-lines',
  'claude-md-symlink',
  'memory-auto-memory-directory-committed',
  'memory-index-max-size',
  'rules-max-lines',
  'rules-symlink-external',
]

// The rules of #13 that are `off` in `recommended`. `strict` turns each on at `warn`.
const MEMORY_OFF_BLOCKS: Record<string, [string, string[]]> = {
  'claude-md-agents-md-prose-pointer': ['markdown/gfm', ['**/CLAUDE.md']],
  'claude-md-combined-size': ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md']],
  'claude-md-dangling-reference': [
    'markdown/gfm',
    ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/.claude/rules/**/*.md'],
  ],
  'claude-md-derivable-content': ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md']],
  'claude-md-emphasis-overuse': ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md']],
  'claude-md-git-instructions': ['markdown/gfm', ['**/CLAUDE.md', '**/.claude/rules/**/*.md']],
  'claude-md-guardrail-to-hook': [
    'markdown/gfm',
    ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/.claude/rules/**/*.md'],
  ],
  'claude-md-html-comment-content': ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md']],
  'claude-md-excludes-absolute-committed': ['json/json', ['**/.claude/settings.json']],
  'claude-md-import-in-code-span': [
    'markdown/gfm',
    ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/AGENTS.md'],
  ],
  'claude-md-location': ['markdown/gfm', ['**/*.md']],
  'claude-md-procedure-to-skill': ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md']],
  'memory-agent-memory-orphan': ['markdown/gfm', ['**/.claude/agent-memory/*/MEMORY.md']],
  'memory-index-entry-format': ['markdown/gfm', ['**/.claude/agent-memory/*/MEMORY.md']],
  'memory-topic-frontmatter': ['markdown/gfm', ['**/.claude/agent-memory/*/*.md']],
  'rules-paths-no-match': ['markdown/gfm', ['**/.claude/rules/**/*.md']],
}
const MEMORY_OFF_RULES = Object.keys(MEMORY_OFF_BLOCKS).sort()

// The settings rules of the model, env, worktree, managed and status line layers of #14 are `off` in `recommended`. `strict` turns
// each on at `warn`. They come last in the `modules` list, with the files of each.
const SETTINGS_OFF_RULES: { name: string; files: string[] }[] = [
  { name: 'settings-agent-exists', files: PROJECT_FILES },
  { name: 'settings-defaultshell-powershell-tool', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-env-context-cost', files: SHARED_FILE },
  { name: 'settings-env-format-heuristic', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-env-secret-heuristic', files: SHARED_FILE },
  { name: 'settings-managed-effort-cap', files: MANAGED_FILES },
  { name: 'settings-managed-merge', files: MANAGED_FILES },
  { name: 'settings-model-capability', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'settings-model-pin-version', files: [...SHARED_FILE, ...MANAGED_FILES] },
  { name: 'settings-nested-project-file', files: SHARED_FILE },
  { name: 'settings-skilloverrides-unknown-skill', files: PROJECT_FILES },
  { name: 'settings-worktree-paths', files: PROJECT_FILES },
  { name: 'statusline-home-path-shared', files: SHARED_FILE },
  { name: 'statusline-script-terminal-size', files: [...PROJECT_FILES, ...MANAGED_FILES] },
]

// `settings-schema-url` reports each settings file that is a JSON object with no `$schema`. The
// trees have many such files, so the list is computed from them. A project file, a managed file
// and a drop-in that is not hidden are settings files. The other files of the trees are not.
const SETTINGS_FILE =
  /(^|\/)(\.claude\/settings(\.local)?\.json|managed-settings\.json|managed-settings\.d\/[^./][^/]*\.json)$/
const SCHEMA_URL_TREES = [
  ...Object.entries(TREE),
  ...Object.entries(GIT_TREE).map(([file, content]) => [`${GIT_REPO}/${file}`, content] as const),
  ...Object.entries({ ...GU_TREE, ...GU_LOOSE }).map(
    ([file, content]) => [`${GU_REPO}/${file}`, content] as const,
  ),
]
const SCHEMA_URL_MISSING = SCHEMA_URL_TREES.filter(([file, content]) => {
  const data: unknown = SETTINGS_FILE.test(file) ? JSON.parse(content) : null
  return typeof data === 'object' && data !== null && !Array.isArray(data) && !('$schema' in data)
}).map(([file]) => file)

// The rules of #16 on `.mcp.json`, in the order of the `modules` list, with the files of each.
// Each is an error.
const MCP_PATHS = ['**/.claude/.mcp.json', '**/.claude/mcp.json', '**/.claude/config/mcp.json']
const MCP_RULES: {
  name: string
  files: string[]
  markdown?: string[]
  language?: string
  severity?: 'warn'
}[] = [
  { name: 'mcp-json-location', files: MCP_PATHS },
  { name: 'mcp-json-servers-key', files: ['**/.mcp.json'] },
  { name: 'mcp-json-file-size', files: ['**/.mcp.json'] },
  { name: 'mcp-server-name-reserved', files: ['**/.mcp.json'] },
  { name: 'mcp-remote-url-empty', files: ['**/.mcp.json'] },
  { name: 'mcp-hidden-whitespace', files: ['**/.mcp.json'] },
  { name: 'mcp-timeout-min', files: ['**/.mcp.json'] },
  { name: 'mcp-oauth-transport', files: ['**/.mcp.json'] },
  { name: 'mcp-oauth-values', files: ['**/.mcp.json'] },
  { name: 'mcp-authorization-header-with-oauth', files: ['**/.mcp.json'] },
  { name: 'mcp-project-dir-default', files: ['**/.mcp.json'] },
  { name: 'mcp-env-expansion-field', files: ['**/.mcp.json'] },
  { name: 'mcp-credential-var-remote', files: ['**/.mcp.json'] },
  { name: 'mcp-headershelper-credential-env', files: ['**/.mcp.json'] },
  { name: 'mcp-settings-mcpservers', files: PROJECT_FILES },
  { name: 'mcp-anthropic-hosted-url', files: ['**/.mcp.json'] },
  { name: 'mcp-project-plugin-bundle', files: ['**/.claude/skills/*/.claude-plugin/plugin.json'] },
  {
    name: 'mcp-tool-name-format',
    files: [...PROJECT_FILES, ...MANAGED_FILES],
    // The same rule, for the tool lists of skills and commands.
    markdown: ['**/SKILL.md', '**/commands/**/*.md'],
  },
  { name: 'mcp-approval-committed', files: PROJECT_FILES },
  { name: 'mcp-disable-connectors-false', files: MANAGED_FILES },
  { name: 'mcp-policy-entry-schema', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'lsp-json-schema', files: ['**/.lsp.json'] },
  { name: 'lsp-transport-socket', files: ['**/.lsp.json', '**/.claude-plugin/plugin.json'] },
  { name: 'mcp-allowlist-servername-dead', files: MANAGED_FILES },
  { name: 'mcp-env-client-secret', files: PROJECT_FILES },
  { name: 'mcp-managed-servers-entry', files: MANAGED_FILES },
  { name: 'mcp-duplicate-server-name', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'lsp-extension-conflict', files: ['**/.claude-plugin/marketplace.json'] },
  { name: 'lsp-duplicate-server-name', files: ['**/.claude-plugin/plugin.json'] },
  {
    name: 'mcp-plugin-tool-name-scoped',
    files: ['**/SKILL.md', '**/commands/**/*.md', '**/agents/**/*.md'],
    language: 'markdown/gfm',
  },
  { name: 'mcp-approval-names-exist', files: PROJECT_FILES },
  { name: 'mcp-approval-conflict', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'mcp-allow-deny-overlap', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  // The warn rules of the server names, transport and headers.
  { name: 'mcp-headershelper-committed', files: ['**/.mcp.json'], severity: 'warn' },
  {
    name: 'mcp-headershelper-path',
    files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'mcp-no-sse-transport',
    files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'mcp-server-name-anthropic-skills',
    files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'mcp-server-name-format',
    files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  { name: 'mcp-stdio-relative-path', files: ['**/.mcp.json'], severity: 'warn' },
  // The warn rules of the URL and the policy lists.
  { name: 'mcp-allowlist-empty', files: MANAGED_FILES, severity: 'warn' },
  { name: 'mcp-insecure-url', files: ['**/.mcp.json'], severity: 'warn' },
  {
    name: 'mcp-plugin-stdio-reach',
    files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  { name: 'mcp-policy-literal-values', files: MANAGED_FILES, severity: 'warn' },
  { name: 'mcp-policy-servername-weak', files: MANAGED_FILES, severity: 'warn' },
]

// The `off` rules of #16, in the order of the `modules` list. `strict` turns each on at `warn`.
const MCP_OFF_RULES: { name: string; files: string[]; markdown?: string[] }[] = [
  { name: 'mcp-always-load-count', files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'] },
  { name: 'mcp-env-var-numbers', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  { name: 'mcp-env-var-syntax', files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'] },
  {
    name: 'mcp-no-literal-secrets',
    files: ['**/.mcp.json', '**/managed-mcp.json', '**/.claude-plugin/plugin.json'],
  },
  { name: 'mcp-project-toggle-keys', files: [...PROJECT_FILES, ...MANAGED_FILES] },
  {
    name: 'mcp-tool-server-unknown',
    files: PROJECT_FILES,
    markdown: ['**/SKILL.md', '**/commands/**/*.md'],
  },
  { name: 'lsp-json-location', files: ['**/.lsp.json'] },
  { name: 'mcp-env-var-default', files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'] },
  { name: 'mcp-plugin-root-paths', files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'] },
  { name: 'mcp-stdio-command-has-args', files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'] },
  { name: 'mcp-unknown-keys', files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'] },
]

// The reports of the rules that are `off` in recommended and `warn` in strict, besides the first one
// (`hooks-agent-stop-event`). Every report is a warning. `hooks-committed-command-review` reports each command
// handler of a project settings file, a project skill, an agent and a plugin `hooks.json`, but not of
// `settings.local.json` or a managed file. `hooks-command-path-variable` reports each command of a plugin
// `hooks.json` that starts in the working directory. `hooks-if-dir-glob-depth` reports nothing, because the
// configs set no `minVersion`.
const times = (count: number, line: string) => Array.from({ length: count }, () => line)
const NEW_HOOKS_FILES = [
  'packages/hk/.claude/agents/hk.md',
  'packages/hk/.claude/settings.json',
  'packages/hk/.claude/settings.local.json',
  'packages/hk/.claude/skills/hk/SKILL.md',
  'packages/hk/managed-settings.d/10-a.json',
  'packages/hk/managed-settings.json',
  'packages/hk/plugin/hooks/hooks.json',
]
const STRICT_ONLY_EXPECTED = [
  ...NEW_HOOKS_FILES.flatMap((file) =>
    [
      'hooks-async-on-blocking-event',
      'hooks-command-shell-safety',
      'hooks-matcher-name-unresolved',
      'hooks-matcher-unanchored-regex',
      'hooks-timeout-units',
    ].map((rule) => `${file}: claude/${rule}@1`),
  ),
  // The JSON files hold three more command handlers than the YAML files: an allow, a pipe in exec form and a script.
  ...['packages/hk/.claude/agents/hk.md', 'packages/hk/.claude/skills/hk/SKILL.md'].flatMap(
    (file) => times(22, `${file}: claude/hooks-committed-command-review@1`),
  ),
  ...['packages/hk/.claude/settings.json', 'packages/hk/plugin/hooks/hooks.json'].flatMap((file) =>
    times(25, `${file}: claude/hooks-committed-command-review@1`),
  ),
  ...[
    'packages/hk/.claude/settings.json',
    'packages/hk/.claude/settings.local.json',
    'packages/hk/managed-settings.d/10-a.json',
    'packages/hk/managed-settings.json',
    'packages/hk/plugin/hooks/hooks.json',
  ].flatMap((file) =>
    [
      'hooks-broad-auto-approve',
      'hooks-exec-form-shell-syntax',
      'hooks-http-literal-secret',
      // The allow in `hooksFaults` has no `hookEventName`.
      'hooks-output-schema',
    ].map((rule) => `${file}: claude/${rule}@1`),
  ),
  ...['packages/hk/.claude/settings.json', 'packages/hk/.claude/settings.local.json'].map(
    (file) => `${file}: claude/hooks-script-shebang@1`,
  ),
  // The hooks output rules: one fault for each, in `outputHooks`, and one review report for each of its seven handlers.
  ...[
    'hooks-multiple-updatedinput',
    'hooks-output-blocking-exit-code',
    'hooks-output-deprecated-fields',
    'hooks-output-schema',
    'hooks-sessionstart-static-context',
    'hooks-stop-loop-guard',
  ].map((rule) => `packages/ho/.claude/settings.json: claude/${rule}@1`),
  ...times(7, 'packages/ho/.claude/settings.json: claude/hooks-committed-command-review@1'),
  ...[
    'packages/dup/.claude/settings.json',
    'packages/dup/hooks/hooks.json',
    'packages/hk/.claude/agents/ev.md',
    'packages/hk/.claude/skills/ev/SKILL.md',
  ].map((file) => `${file}: claude/hooks-committed-command-review@1`),
  ...times(15, 'packages/hk/plugin/hooks/hooks.json: claude/hooks-command-path-variable@1'),
  'packages/dup/hooks/hooks.json: claude/hooks-command-path-variable@1',
]

// The plugin manifest and layout rules of #11, in the order of the `modules` list. Each is an
// error, except where `severity` says `warn`, with one JSON block for its files.
const PLUGIN_RULES: {
  name: string
  files: string[]
  language?: string
  severity?: 'warn'
}[] = [
  { name: 'plugin-manifest-location', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'plugin-skill-dir-layout', files: ['**/.claude-plugin/plugin.json'] },
  {
    name: 'plugin-no-project-plugins-dir',
    files: ['**/.claude/plugins/**/.claude-plugin/plugin.json'],
  },
  {
    name: 'plugin-project-skills-dir-limits',
    files: ['**/.claude/skills/*/.claude-plugin/plugin.json'],
  },
  { name: 'plugin-commands-dir-nonempty', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'plugin-default-dir-shadowed', files: ['**/.claude-plugin/plugin.json'] },
  {
    name: 'plugin-monitors-command-env',
    files: ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json'],
  },
  { name: 'plugin-no-git-lfs', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'plugin-package-lockfile', files: ['**/.claude-plugin/plugin.json'] },
  {
    name: 'plugin-path-var-braced',
    language: 'markdown/gfm',
    files: ['**/SKILL.md', '**/commands/**/*.md', '**/agents/**/*.md'],
  },
  {
    name: 'plugin-user-config-no-shell-fields',
    files: [
      '**/.claude-plugin/plugin.json',
      '**/hooks/hooks.json',
      '**/.mcp.json',
      '**/monitors/monitors.json',
    ],
  },
  { name: 'plugin-symlink-escapes-marketplace', files: ['**/.claude-plugin/plugin.json'] },
  {
    name: 'plugin-symlink-escapes-plugin',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  { name: 'plugin-dependencies-resolve', files: ['**/.claude-plugin/plugin.json'] },
  {
    name: 'plugin-monitors-skill-exists',
    files: ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json'],
  },
  { name: 'plugin-npm-source-shrinkwrap', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'plugin-settings-single-source', files: ['**/.claude-plugin/plugin.json'] },
  {
    name: 'plugin-user-config-sensitive-in-content',
    language: 'markdown/gfm',
    files: ['**/SKILL.md', '**/agents/**/*.md'],
  },
  // The rules with the option `minVersion` give no report in the config run, which sets no option.
  {
    name: 'plugin-feature-min-version',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'plugin-manifest-metadata-format',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  { name: 'plugin-manifest-no-bom', files: ['**/.claude-plugin/plugin.json'], severity: 'warn' },
  {
    name: 'plugin-manifest-publish-metadata',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'plugin-manifest-version-semver',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'plugin-commands-map-fields',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'plugin-dependencies-not-auto-installed',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'plugin-path-no-backslash',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'plugin-settings-agent-exists',
    files: ['**/.claude-plugin/plugin.json', '**/settings.json'],
    severity: 'warn',
  },
  {
    name: 'plugin-skills-key-redundant-default',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  {
    name: 'plugin-user-config-field-applicability',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  // The rule with the option `targets` gives no report in the config run, which sets no option.
  { name: 'plugin-bin-claude-ai', files: ['**/.claude-plugin/plugin.json'], severity: 'warn' },
  {
    name: 'plugin-monitors-command-quote',
    files: ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json'],
    severity: 'warn',
  },
  { name: 'plugin-package-lifecycle-scripts', files: ['**/package.json'], severity: 'warn' },
  {
    name: 'plugin-package-lockfile-choice',
    files: ['**/.claude-plugin/plugin.json'],
    severity: 'warn',
  },
  { name: 'plugin-themes-layout', files: ['**/themes/*.json'], severity: 'warn' },
]

// The plugin rules of #11 that are `off` in `recommended`, in the order of the `modules` list.
// `strict` turns each on at `warn`.
const PLUGIN_OFF_RULES: { name: string; files: string[] }[] = [
  { name: 'plugin-user-config-sensitive', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'plugin-channel-server-stdio', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'plugin-bin-shadows-system-command', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'plugin-dependencies-prerelease-range', files: ['**/.claude-plugin/plugin.json'] },
  { name: 'plugin-relevance-signal-hints', files: ['**/.claude-plugin/marketplace.json'] },
  { name: 'plugin-dir-not-marketplace-root', files: ['**/package.json'] },
  {
    name: 'plugin-no-state-in-plugin-root',
    files: [
      '**/.claude-plugin/plugin.json',
      '**/hooks/hooks.json',
      '**/.mcp.json',
      '**/monitors/monitors.json',
    ],
  },
]

// Each file with a report, as `file: rule@severity`. 1 is warn, 2 is error.
const EXPECTED = [
  '.claude/agents/bypass.md: claude/agent-permission-mode-bypass@2',
  '.claude/agents/mcp.md: claude/agent-mcp-servers-schema@2',
  '.claude/agents/memory.md: claude/agent-memory-grants-write@2',
  '.claude/agents/review/deep/n.md: claude/agent-permission-mode-bypass@2',
  '.claude/agents/schema.md: claude/agent-frontmatter-schema@2',
  '.claude/agents/valid.md: claude/agent-frontmatter-valid@2',
  '.claude/commands/c.md: claude/command-legacy-format@1',
  '.claude/commands/ghost.md: claude/command-legacy-format@1',
  '.claude/commands/ghost.md: claude/skill-agent-exists@2',
  '.claude/commands/ns/c.md: claude/command-legacy-format@1',
  '.claude/commands/schema.md: claude/command-legacy-format@1',
  '.claude/commands/schema.md: claude/skill-frontmatter-schema@2',
  '.claude/commands/schema.md: claude/skill-name-unique@2',
  '.claude/output-styles/schema.md: claude/output-style-frontmatter-schema@2',
  '.claude/output-styles/yaml.md: claude/output-style-frontmatter-valid@2',
  '.claude/settings.json: claude/hooks-event-name-known@2',
  '.claude/settings.local.json: claude/hooks-event-name-known@2',
  '.claude/skills/agent/SKILL.md: claude/skill-agent-exists@2',
  '.claude/skills/bang/SKILL.md: claude/skill-inject-bang-position@2',
  '.claude/skills/fork/SKILL.md: claude/skill-fork-fields-require-context@2',
  '.claude/skills/glob/SKILL.md: claude/skill-paths-glob-valid@2',
  '.claude/skills/layout/skill.md: claude/skill-file-layout@2',
  '.claude/skills/loose.md: claude/skill-file-layout@2',
  '.claude/skills/position/SKILL.md: claude/skill-frontmatter-position@2',
  '.claude/skills/ref/SKILL.md: claude/skill-reference-exists@2',
  '.claude/skills/schema/SKILL.md: claude/skill-frontmatter-schema@2',
  '.claude/skills/schema/SKILL.md: claude/skill-name-unique@2',
  '.claude/skills/synced/SKILL.md: claude/skill-reserved-name@2',
  '.claude/skills/t/SKILL.md: claude/skill-description-max-length@1',
  '.claude/skills/tools/SKILL.md: claude/skill-allowed-tools-ineffective@2',
  '.claude/skills/twin-a/SKILL.md: claude/skill-name-unique@2',
  '.claude/skills/twin-b/SKILL.md: claude/skill-name-unique@2',
  '.claude/skills/unreachable/SKILL.md: claude/skill-invocation-unreachable@2',
  '.claude/skills/vars/SKILL.md: claude/skill-plugin-vars-outside-plugin@2',
  '.claude/teams/sub/x.json: claude/agent-teams-no-project-config@2',
  '.claude/teams/team.md: claude/agent-teams-no-project-config@2',
  '.claude/teams/teams.json: claude/agent-teams-no-project-config@2',
  'packages/hk/.claude-plugin/hooks.json: claude/hooks-no-standalone-file@2',
  'packages/hk/.claude/agents/ev.md: claude/hooks-event-name-known@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-command-removed-cli-flag@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-config-schema@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-env-var-unavailable@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-exec-form-command-spaces@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-handler-field-ignored@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-handler-field-unknown@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-handler-type-event-support@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-http-env-allowlist@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-if-condition@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-matcher-deprecated-value@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-matcher-enum@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-matcher-mcp-name@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-matcher-never-matches@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-matcher-subagent-anchor@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-matcher-syntax@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-matcher-unsupported-event@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-powershell-placeholder@2',
  'packages/hk/.claude/agents/hk.md: claude/hooks-prompt-on-permission-request@1',
  'packages/hk/.claude/hooks.json: claude/hooks-no-standalone-file@2',
  'packages/hk/.claude/hooks/hooks.json: claude/hooks-no-standalone-file@2',
  'packages/hk/.claude/settings.json: claude/hooks-command-removed-cli-flag@2',
  'packages/hk/.claude/settings.json: claude/hooks-config-schema@2',
  'packages/hk/.claude/settings.json: claude/hooks-disabled-by-disableallhooks@2',
  'packages/hk/.claude/settings.json: claude/hooks-env-var-unavailable@2',
  'packages/hk/.claude/settings.json: claude/hooks-exec-form-command-spaces@2',
  'packages/hk/.claude/settings.json: claude/hooks-handler-field-ignored@2',
  'packages/hk/.claude/settings.json: claude/hooks-handler-field-unknown@1',
  'packages/hk/.claude/settings.json: claude/hooks-handler-type-event-support@2',
  'packages/hk/.claude/settings.json: claude/hooks-http-env-allowlist@2',
  'packages/hk/.claude/settings.json: claude/hooks-if-condition@2',
  'packages/hk/.claude/settings.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hk/.claude/settings.json: claude/hooks-matcher-deprecated-value@1',
  'packages/hk/.claude/settings.json: claude/hooks-matcher-enum@2',
  'packages/hk/.claude/settings.json: claude/hooks-matcher-mcp-name@2',
  'packages/hk/.claude/settings.json: claude/hooks-matcher-never-matches@2',
  'packages/hk/.claude/settings.json: claude/hooks-matcher-subagent-anchor@1',
  'packages/hk/.claude/settings.json: claude/hooks-matcher-syntax@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/dup/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/dup/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-script-exists@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-script-exists@2',
  'packages/hk/managed-settings.json: claude/hooks-script-exists@2',
  'packages/hk/managed-settings.json: claude/hooks-script-exists@2',
  'packages/hs/.claude/settings.json: claude/hooks-placeholder-quoted@1',
  'packages/hs/.claude/settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hs/loose/hooks/hooks.json: claude/hooks-prefer-exec-form@1',
  'packages/hs/managed-settings.d/10-a.json: claude/hooks-placeholder-quoted@1',
  'packages/hs/managed-settings.d/10-a.json: claude/hooks-prefer-exec-form@1',
  'packages/hs/managed-settings.json: claude/hooks-placeholder-quoted@1',
  'packages/hs/managed-settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hs/plugin/hooks/hooks.json: claude/hooks-prefer-exec-form@1',
  'packages/hx/.claude/settings.json: claude/hooks-placeholder-quoted@1',
  'packages/hx/.claude/settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hx/loose/hooks/hooks.json: claude/hooks-prefer-exec-form@1',
  'packages/hx/managed-settings.d/10-a.json: claude/hooks-placeholder-quoted@1',
  'packages/hx/managed-settings.d/10-a.json: claude/hooks-prefer-exec-form@1',
  'packages/hx/managed-settings.json: claude/hooks-placeholder-quoted@1',
  'packages/hx/managed-settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hx/ok/.claude/settings.json: claude/hooks-placeholder-quoted@1',
  'packages/hx/ok/.claude/settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hx/plugin/hooks/hooks.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hs/.claude/settings.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hs/.claude/settings.local.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hs/loose/hooks/hooks.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hs/managed-settings.d/10-a.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hs/managed-settings.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hs/plugin/hooks/hooks.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hx/.claude/settings.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hx/.claude/settings.local.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hx/loose/hooks/hooks.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hx/managed-settings.d/10-a.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hx/managed-settings.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hx/ok/.claude/settings.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hx/plugin/hooks/hooks.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.json: claude/hooks-matcher-unsupported-event@2',
  'packages/hk/.claude/settings.json: claude/hooks-powershell-placeholder@2',
  'packages/hk/.claude/settings.json: claude/hooks-prompt-on-permission-request@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-command-removed-cli-flag@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-config-schema@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-disabled-by-disableallhooks@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-env-var-unavailable@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-exec-form-command-spaces@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-handler-field-ignored@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-handler-field-unknown@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-handler-type-event-support@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-http-env-allowlist@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-if-condition@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-matcher-deprecated-value@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-matcher-enum@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-matcher-mcp-name@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-matcher-never-matches@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-matcher-subagent-anchor@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-matcher-syntax@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-matcher-unsupported-event@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-script-exists@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-powershell-placeholder@2',
  'packages/hk/.claude/settings.local.json: claude/hooks-prompt-on-permission-request@1',
  'packages/hk/.claude/skills/ev/SKILL.md: claude/hooks-event-name-known@2',
  'packages/hk/.claude/skills/ev/SKILL.md: claude/skill-description-present@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-command-removed-cli-flag@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-config-schema@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-env-var-unavailable@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-exec-form-command-spaces@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-handler-field-ignored@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-handler-field-unknown@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-handler-type-event-support@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-http-env-allowlist@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-if-condition@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-matcher-deprecated-value@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-matcher-enum@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-matcher-mcp-name@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-matcher-never-matches@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-matcher-subagent-anchor@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-matcher-syntax@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-matcher-unsupported-event@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-powershell-placeholder@2',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-prompt-on-permission-request@1',
  'packages/hk/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-command-removed-cli-flag@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-config-schema@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-env-var-unavailable@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-exec-form-command-spaces@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-handler-field-ignored@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-handler-field-unknown@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-handler-type-event-support@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-http-env-allowlist@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-if-condition@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-matcher-deprecated-value@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-matcher-enum@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-matcher-mcp-name@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-matcher-never-matches@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-matcher-subagent-anchor@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-matcher-syntax@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-matcher-unsupported-event@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-powershell-placeholder@2',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-prompt-on-permission-request@1',
  'packages/hk/managed-settings.json: claude/hooks-command-removed-cli-flag@2',
  'packages/hk/managed-settings.json: claude/hooks-config-schema@2',
  'packages/hk/managed-settings.json: claude/hooks-disabled-by-disableallhooks@2',
  'packages/hk/managed-settings.json: claude/hooks-env-var-unavailable@2',
  'packages/hk/managed-settings.json: claude/hooks-exec-form-command-spaces@2',
  'packages/hk/managed-settings.json: claude/hooks-handler-field-ignored@2',
  'packages/hk/managed-settings.json: claude/hooks-handler-field-unknown@1',
  'packages/hk/managed-settings.json: claude/hooks-handler-type-event-support@2',
  'packages/hk/managed-settings.json: claude/hooks-http-env-allowlist@2',
  'packages/hk/managed-settings.json: claude/hooks-if-condition@2',
  'packages/hk/managed-settings.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hk/managed-settings.json: claude/hooks-matcher-deprecated-value@1',
  'packages/hk/managed-settings.json: claude/hooks-matcher-enum@2',
  'packages/hk/managed-settings.json: claude/hooks-matcher-mcp-name@2',
  'packages/hk/managed-settings.json: claude/hooks-matcher-never-matches@2',
  'packages/hk/managed-settings.json: claude/hooks-matcher-subagent-anchor@1',
  'packages/hk/managed-settings.json: claude/hooks-matcher-syntax@2',
  'packages/hk/managed-settings.json: claude/hooks-matcher-unsupported-event@2',
  'packages/hk/managed-settings.json: claude/hooks-powershell-placeholder@2',
  'packages/hk/managed-settings.json: claude/hooks-prompt-on-permission-request@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-command-removed-cli-flag@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-config-schema@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-env-var-unavailable@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-exec-form-command-spaces@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-handler-field-ignored@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-handler-field-unknown@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-handler-type-event-support@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-http-env-allowlist@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-if-condition@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-matcher-bash-without-powershell@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-matcher-deprecated-value@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-matcher-enum@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-matcher-mcp-name@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-matcher-never-matches@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-matcher-subagent-anchor@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-matcher-syntax@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-matcher-unsupported-event@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-powershell-placeholder@2',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-prompt-on-permission-request@1',
  'packages/x/.claude/settings.json: claude/hooks-event-name-known@2',
  'packages/x/.claude/settings.local.json: claude/hooks-event-name-known@2',
  'packages/x/.claude/teams/x.md: claude/agent-teams-no-project-config@2',
  '.claude/skills/sp/.claude-plugin/plugin.json: claude/mcp-project-plugin-bundle@2',
  '.claude/skills/sp/.claude-plugin/plugin.json: claude/plugin-project-skills-dir-limits@2',
  '.claude/skills/sp/.claude-plugin/plugin.json: claude/plugin-project-skills-dir-limits@2',
  'packages/ppl/.claude/plugins/p/.claude-plugin/plugin.json: claude/plugin-no-project-plugins-dir@2',
  'plugins/cmd/.claude-plugin/plugin.json: claude/plugin-commands-dir-nonempty@2',
  'plugins/cmf/.claude-plugin/plugin.json: claude/plugin-commands-map-fields@1',
  'plugins/bsl/.claude-plugin/plugin.json: claude/plugin-path-no-backslash@1',
  'plugins/lfs/.claude-plugin/plugin.json: claude/plugin-no-git-lfs@2',
  'plugins/msk/.claude-plugin/plugin.json: claude/plugin-monitors-skill-exists@2',
  'plugins/msk2/monitors/monitors.json: claude/plugin-monitors-skill-exists@2',
  'plugins/loc/.claude-plugin/plugin.json: claude/plugin-manifest-location@2',
  'plugins/bare/agents/a.md: claude/plugin-path-var-braced@2',
  'plugins/bare/commands/c.md: claude/command-legacy-format@1',
  'plugins/bare/commands/c.md: claude/plugin-path-var-braced@2',
  'plugins/bare/commands/c.md: claude/skill-description-present@1',
  'plugins/bare/skills/s/SKILL.md: claude/plugin-path-var-braced@2',
  'plugins/bare/skills/s/SKILL.md: claude/skill-description-present@1',
  'plugins/env/.claude-plugin/plugin.json: claude/plugin-monitors-command-env@2',
  'plugins/env2/monitors/monitors.json: claude/plugin-monitors-command-env@2',
  'plugins/lock/.claude-plugin/plugin.json: claude/plugin-package-lockfile@2',
  'plugins/lc/package.json: claude/plugin-package-lifecycle-scripts@1',
  'plugins/lch/.claude-plugin/plugin.json: claude/plugin-package-lockfile-choice@1',
  'plugins/mq/.claude-plugin/plugin.json: claude/plugin-monitors-command-quote@1',
  'plugins/mq2/monitors/monitors.json: claude/plugin-monitors-command-quote@1',
  'plugins/th/themes/t.json: claude/plugin-themes-layout@1',
  'plugins/uca/.claude-plugin/plugin.json: claude/plugin-user-config-field-applicability@1',
  'plugins/ucf/.claude-plugin/plugin.json: claude/plugin-user-config-no-shell-fields@2',
  'plugins/ucf/.claude-plugin/plugin.json: claude/hooks-duplicate-handler@1',
  'plugins/ucf/.mcp.json: claude/plugin-user-config-no-shell-fields@2',
  'plugins/ucf/.mcp.json: claude/mcp-headershelper-path@1',
  'plugins/ucf/hooks/hooks.json: claude/plugin-user-config-no-shell-fields@2',
  'plugins/ucf/monitors/monitors.json: claude/plugin-user-config-no-shell-fields@2',
  'packages/cxd/plugins/dep/.claude-plugin/plugin.json: claude/plugin-dependencies-resolve@2',
  'packages/cxd/plugins/pkg/.claude-plugin/plugin.json: claude/plugin-npm-source-shrinkwrap@2',
  // `plugin-manifest-publish-metadata` reports each manifest of the trees, because none sets
  'packages/nai/.claude-plugin/marketplace.json: claude/marketplace-command-source@1',
  'packages/nai/plugins/user/.claude-plugin/plugin.json: claude/plugin-dependencies-not-auto-installed@1',
  // `plugin-manifest-publish-metadata` reports each manifest of the tree, because none sets
  // `homepage` and `repository` or has a README.md. It skips a plugin in `.claude/skills/<name>/`.
  ...SCHEMA_URL_TREES.map(([file]) => file)
    .filter(
      (file) =>
        file.endsWith('.claude-plugin/plugin.json') &&
        !/(^|\/)\.claude\/skills\/[^/]+\/\.claude-plugin\//.test(file),
    )
    .map((file) => `${file}: claude/plugin-manifest-publish-metadata@1`),
  ...(LINKS
    ? [
        'packages/l/site/plugins/m/.claude-plugin/plugin.json: claude/plugin-symlink-escapes-marketplace@2',
        'packages/l/site/plugins/n/.claude-plugin/plugin.json: claude/plugin-symlink-escapes-plugin@1',
      ]
    : []),
  'plugins/p/.claude-plugin/plugin.json: claude/hooks-event-name-known@2',
  'plugins/shadow/.claude-plugin/plugin.json: claude/plugin-default-dir-shadowed@2',
  'plugins/shadow/commands/c.md: claude/command-legacy-format@1',
  'plugins/shadow/commands/c.md: claude/skill-description-present@1',
  'plugins/set/.claude-plugin/plugin.json: claude/plugin-settings-single-source@2',
  'plugins/set/settings.json: claude/plugin-settings-agent-exists@1',
  'plugins/sen/agents/a.md: claude/plugin-user-config-sensitive-in-content@2',
  'plugins/sen/commands/c.md: claude/command-legacy-format@1',
  'plugins/sen/commands/c.md: claude/skill-description-present@1',
  'plugins/sen/skills/s/SKILL.md: claude/plugin-user-config-sensitive-in-content@2',
  'plugins/sen/skills/s/SKILL.md: claude/skill-description-present@1',
  'plugins/skl/.claude-plugin/plugin.json: claude/plugin-skill-dir-layout@2',
  'plugins/skl/.claude-plugin/plugin.json: claude/plugin-skills-key-redundant-default@1',
  'plugins/skl/skills/loose.md: claude/skill-file-layout@2',
  'plugins/p/SKILL.md: claude/skill-plugin-root-shadowed@2',
  'plugins/p/agents/ignored.md: claude/agent-plugin-ignored-fields@2',
  'plugins/p/agents/schema.md: claude/agent-frontmatter-schema@2',
  'plugins/p/agents/sub/n.md: claude/agent-plugin-ignored-fields@2',
  'plugins/p/commands/c.md: claude/command-legacy-format@1',
  'plugins/p/hooks/hooks.json: claude/hooks-event-name-known@2',
  'plugins/p/skills/s/SKILL.md: claude/skill-description-max-length@1',
  // The marketplace rules read `.claude-plugin/marketplace.json` only, and so do the marketplace
  // warnings. `marketplace-min-version` reports nothing with no `minVersion`.
  ...MARKETPLACE_RULES.filter((rule) => rule !== ESCAPE_RULE).map(
    (rule) => `.claude-plugin/marketplace.json: claude/${rule}@2`,
  ),
  ...MARKETPLACE_WARN_RULES.filter(
    (rule) =>
      rule !== LOCATION_RULE &&
      rule !== 'marketplace-min-version' &&
      rule !== 'marketplace-self-hosted-root-source',
  ).map((rule) => `.claude-plugin/marketplace.json: claude/${rule}@1`),
  // `marketplace-self-hosted-root-source` reads a marketplace beside a `plugin.json`.
  'packages/m/.claude-plugin/marketplace.json: claude/marketplace-self-hosted-root-source@1',
  // `marketplace-location` reads each `marketplace.json`, and reports the one out of its folder.
  'marketplace.json: claude/marketplace-location@1',
  'docs/marketplace.json: claude/marketplace-location@1',
  'packages/s/site/docs/marketplace.json: claude/marketplace-location@1',
  'packages/m/.claude-plugin/marketplace.json: claude/marketplace-name-reserved@2',
  ...(LINKS
    ? [
        'packages/s/site/.claude-plugin/marketplace.json: claude/marketplace-relative-source-escape-symlink@2',
      ]
    : []),
  // The settings rules read the settings files of a project, and no other settings file.
  ...['packages/mk/.claude/settings.json', 'packages/mk/.claude/settings.local.json'].flatMap(
    (file) => SETTINGS_RULES.map((rule) => `${file}: claude/${rule}@2`),
  ),
  // `settings-valid-json` reads the two project settings files, and no other settings file.
  'packages/vj/.claude/settings.json: claude/settings-valid-json@2',
  'packages/vj/.claude/settings.local.json: claude/settings-valid-json@2',
  // `settings-file-size` also reads the managed settings files, and no other file.
  ...[
    'packages/big/.claude/settings.json',
    'packages/big/.claude/settings.local.json',
    'packages/big/managed-settings.json',
    'packages/big/managed-settings.d/30-big.json',
  ].map((file) => `${file}: claude/settings-file-size@2`),
  // `settings-key-scope` reads the project and managed files. It reports a Managed key in the
  // project file, and a Global config key in a managed file. It makes no report on the rest.
  'packages/sc/.claude/settings.json: claude/settings-key-scope@2',
  'packages/sc/managed-settings.json: claude/settings-key-scope@2',
  // `settings-managed-file` reads the managed files. A project settings file is for
  // `settings-valid-json`.
  'packages/mf/managed-settings.json: claude/settings-managed-file@2',
  'packages/mf/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/mf/.claude/settings.local.json: claude/settings-valid-json@2',
  'packages/mf2/managed-settings.json: claude/settings-managed-file@2',
  'packages/mf3/managed-settings.json: claude/settings-managed-file@2',
  // `settings-removed-key` reads the project and managed files, and no other file.
  ...[
    'packages/rk/.claude/settings.json',
    'packages/rk/.claude/settings.local.json',
    'packages/rk/managed-settings.json',
    'packages/rk/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-removed-key@2`),
  'packages/rk/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-env-credential` reads the project and managed files, and no other file.
  ...[
    'packages/ec/.claude/settings.json',
    'packages/ec/.claude/settings.local.json',
    'packages/ec/managed-settings.json',
    'packages/ec/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-env-credential@2`),
  'packages/ec/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-env-value-format` reads the project and managed files, and no other file.
  ...[
    'packages/ef/.claude/settings.json',
    'packages/ef/.claude/settings.local.json',
    'packages/ef/managed-settings.json',
    'packages/ef/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-env-value-format@2`),
  'packages/ef/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-env-ignored-var` reads the project and managed files, and no other file. A managed
  // file reports a variable that is ignored in every file, and not one that is ignored in project
  // files only.
  ...[
    'packages/ei/.claude/settings.json',
    'packages/ei/.claude/settings.local.json',
    'packages/ei/managed-settings.json',
    'packages/ei/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-env-ignored-var@2`),
  'packages/ei/managed-settings.d/.30-hidden.json: claude/settings-managed-file@2',
  // `settings-project-value-ignored` reads the project files only.
  'packages/pv/.claude/settings.json: claude/settings-project-value-ignored@2',
  'packages/pv/.claude/settings.local.json: claude/settings-project-value-ignored@2',
  // `settings-known-marketplaces-policy-schema` reads the managed files, and no other file.
  'packages/kp/managed-settings.json: claude/settings-known-marketplaces-policy-schema@2',
  'packages/kp/managed-settings.d/10-a.json: claude/settings-known-marketplaces-policy-schema@2',
  'packages/kp/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // The bogus entry of `packages/kp` is an allowlist with no `skills-dir` entry.
  'packages/kp/managed-settings.json: claude/settings-strict-known-marketplaces-skills-dir@1',
  // `settings-plugin-suggestion-marketplaces-source` reads the merged source. A drop-in with a
  // `strictKnownMarketplaces` entry declares the name for the whole source.
  'packages/ps/managed-settings.json: claude/settings-plugin-suggestion-marketplaces-source@2',
  'packages/ps/managed-settings.d/10-a.json: claude/settings-plugin-suggestion-marketplaces-source@2',
  'packages/ps/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // The drop-in of `packages/ps2` lists a `github` source and no `skills-dir` entry.
  'packages/ps2/managed-settings.d/10-a.json: claude/settings-strict-known-marketplaces-skills-dir@1',
  // `settings-conflicting-keys` reads the project and managed files, and no other file.
  'packages/ck/.claude/settings.json: claude/settings-conflicting-keys@2',
  'packages/ck/.claude/settings.local.json: claude/settings-conflicting-keys@2',
  'packages/ck/managed-settings.json: claude/settings-conflicting-keys@2',
  'packages/ck/managed-settings.d/10-a.json: claude/settings-conflicting-keys@2',
  'packages/ck/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-model-value` reads the project and managed files, and no other file.
  'packages/mv/.claude/settings.json: claude/settings-model-value@2',
  'packages/mv/.claude/settings.local.json: claude/settings-model-value@2',
  'packages/mv/managed-settings.json: claude/settings-model-value@2',
  'packages/mv/managed-settings.d/10-a.json: claude/settings-model-value@2',
  'packages/mv/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-model-list` reads the project and managed files, and no other file.
  'packages/ml/.claude/settings.json: claude/settings-model-list@2',
  'packages/ml/.claude/settings.local.json: claude/settings-model-list@2',
  'packages/ml/managed-settings.json: claude/settings-model-list@2',
  // The `deniedModels` of this file has no floor, for `settings-managed-version-floor`.
  'packages/ml/managed-settings.json: claude/settings-managed-version-floor@1',
  'packages/ml/managed-settings.d/10-a.json: claude/settings-model-list@2',
  'packages/ml/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-skilloverrides-key` reads the project and managed files, and no other file. A
  // managed file reports a plugin skill key and not an alias key.
  'packages/so/.claude/settings.json: claude/settings-skilloverrides-key@2',
  'packages/so/.claude/settings.local.json: claude/settings-skilloverrides-key@2',
  'packages/so/managed-settings.json: claude/settings-skilloverrides-key@2',
  'packages/so/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-env-shadowed` reads the project and managed files, and no other file.
  'packages/es/.claude/settings.json: claude/settings-env-shadowed@2',
  'packages/es/.claude/settings.local.json: claude/settings-env-shadowed@2',
  'packages/es/managed-settings.json: claude/settings-env-shadowed@2',
  'packages/es/managed-settings.d/10-a.json: claude/settings-env-shadowed@2',
  'packages/es/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `hooks-script-exists` reads the project and managed files, and a `hooks.json` in a plugin.
  ...[
    'packages/hs/.claude/settings.json',
    'packages/hs/.claude/settings.local.json',
    'packages/hs/managed-settings.json',
    'packages/hs/managed-settings.d/10-a.json',
    'packages/hs/plugin/hooks/hooks.json',
  ].map((file) => `${file}: claude/hooks-script-exists@2`),
  'packages/hs/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `hooks-script-executable` reads the same files. The scripts `tools/run.sh`, `scripts/run.sh`,
  // `plugin/scripts/run.sh` and `loose/scripts/run.sh` have index mode `100644`. The script
  // `ok.sh` has `100755`.
  ...[
    'packages/hx/.claude/settings.json',
    'packages/hx/.claude/settings.local.json',
    'packages/hx/managed-settings.json',
    'packages/hx/managed-settings.d/10-a.json',
    'packages/hx/plugin/hooks/hooks.json',
  ].map((file) => `${file}: claude/hooks-script-executable@2`),
  'packages/hx/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `plugin-bin-executable` reads the manifest, and reports one file of its `bin/`.
  'packages/hx/plugin/.claude-plugin/plugin.json: claude/plugin-bin-executable@2',
  // `statusline-script-exists` reads the project and managed files, and no other file.
  ...[
    'packages/hx/sl/.claude/settings.json',
    'packages/hx/sl/.claude/settings.local.json',
    'packages/hx/sl/managed-settings.json',
    'packages/hx/sl/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/statusline-script-exists@2`),
  'packages/hx/sl/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `claude-md-local-untracked` reads a `CLAUDE.md`, and reports on its `CLAUDE.local.md`.
  'packages/gu/claude/bad/CLAUDE.md: claude/claude-md-local-untracked@1',
  'packages/gu/claude/loose/CLAUDE.md: claude/claude-md-local-untracked@1',
  // `memory-agent-memory-local-untracked` reads the local memory directory, and reports a tracked file.
  'packages/gu/mem/bad/.claude/agent-memory-local/reviewer/MEMORY.md: claude/memory-agent-memory-local-untracked@1',
  // `plugin-evals-results-gitignored` reads the manifest of a plugin that has an eval directory.
  'packages/gu/ev/bad/.claude-plugin/plugin.json: claude/plugin-evals-results-gitignored@1',
  // `plugin-evals-replay-committed` reports a pattern, and files that git does not track.
  'packages/gu/rp/ignored/.claude-plugin/plugin.json: claude/plugin-evals-replay-committed@1',
  'packages/gu/rp/loose/.claude-plugin/plugin.json: claude/plugin-evals-replay-committed@1',
  // `settings-local-untracked` reads the shared file, and reports on its `settings.local.json`.
  'packages/gu/set/bad/.claude/settings.json: claude/settings-local-untracked@1',
  // `settings-local-gitignored` reads the shared file. The pattern of the root covers the files
  // of the other areas. The repository `packages/hx` has no `.gitignore`.
  'packages/gu/set/open/.claude/settings.json: claude/settings-local-gitignored@1',
  ...[
    'packages/hx/.claude/settings.json',
    'packages/hx/ok/.claude/settings.json',
    'packages/hx/sl/.claude/settings.json',
    'packages/hx/sl/ok/.claude/settings.json',
  ].map((file) => `${file}: claude/settings-local-gitignored@1`),
  // The repository `packages/hx` tracks the local files of the hook and status line trees.
  'packages/hx/.claude/settings.json: claude/settings-local-untracked@1',
  'packages/hx/sl/.claude/settings.json: claude/settings-local-untracked@1',
  // `settings-enabled-plugins-external-source` reads `.claude/settings.json`. The marketplace in
  // `packages/mk` lists the plugin `fmt` with a `github` source.
  'packages/ex/.claude/settings.json: claude/settings-enabled-plugins-external-source@1',
  'packages/mk/.claude/settings.json: claude/settings-enabled-plugins-external-source@1',
  // `settings-extra-known-marketplaces-directory` reads `.claude/settings.json`.
  'packages/dr/.claude/settings.json: claude/settings-extra-known-marketplaces-directory@1',
  // `settings-marketplace-skip-lfs` reads the project and managed files, and no other file.
  ...[
    'packages/lf/.claude/settings.json',
    'packages/lf/.claude/settings.local.json',
    'packages/lf/managed-settings.json',
    'packages/lf/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-marketplace-skip-lfs@1`),
  'packages/lf/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-marketplace-key-alias` reads the project and managed files. `packages/ka2` holds
  // `allowedMarketplaces` beside its key in a project file: the key and the alias get one scope
  // report each, no alias report and no conflict report.
  ...[
    'packages/ka/.claude/settings.json',
    'packages/ka/.claude/settings.local.json',
    'packages/ka/managed-settings.json',
    'packages/ka/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-marketplace-key-alias@1`),
  'packages/ka/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  ...Array(2).fill('packages/ka2/.claude/settings.json: claude/settings-key-scope@2'),
  // `settings-marketplace-key-alias-conflict` reads the policy pair in the managed files.
  'packages/ac/managed-settings.json: claude/settings-marketplace-key-alias-conflict@2',
  'packages/ac/managed-settings.d/10-a.json: claude/settings-marketplace-key-alias-conflict@2',
  'packages/ac/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-known-marketplaces-pattern-anchored` reads the managed files, and no other file.
  'packages/pa/managed-settings.json: claude/settings-known-marketplaces-pattern-anchored@1',
  'packages/pa/managed-settings.d/10-a.json: claude/settings-known-marketplaces-pattern-anchored@1',
  'packages/pa/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-strict-known-marketplaces-skills-dir` reads the merged managed source.
  'packages/sd/managed-settings.json: claude/settings-strict-known-marketplaces-skills-dir@1',
  'packages/sd/managed-settings.d/10-a.json: claude/settings-strict-known-marketplaces-skills-dir@1',
  'packages/sd/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `claude-md-agents-md-variant` reads the two variant names and Markdown below `.agents/`.
  'packages/av/AGENTS.local.md: claude/claude-md-agents-md-variant@2',
  'packages/av/AGENTS.override.md: claude/claude-md-agents-md-variant@2',
  'packages/av/.agents/notes.md: claude/claude-md-agents-md-variant@2',
  'packages/av/.agents/skills/x/SKILL.md: claude/claude-md-agents-md-variant@2',
  // `claude-md-agents-md-shadowed` reads AGENTS.md and .claude/AGENTS.md, and no other file.
  'packages/sh/AGENTS.md: claude/claude-md-agents-md-shadowed@2',
  'packages/sh/.claude/AGENTS.md: claude/claude-md-agents-md-shadowed@2',
  'packages/ie/AGENTS.md: claude/claude-md-agents-md-shadowed@2',
  'packages/ie/.claude/AGENTS.md: claude/claude-md-agents-md-shadowed@2',
  // `rules-symlink-external-scoped` reads the rule files that are links out of the tree.
  ...(LINKS ? ['packages/rx/.claude/rules/scoped.md: claude/rules-symlink-external-scoped@2'] : []),
  // `claude-md-import-exists` reads CLAUDE.md, CLAUDE.local.md and AGENTS.md, and no other file.
  'packages/ie/CLAUDE.md: claude/claude-md-import-exists@2',
  'packages/ie/.claude/CLAUDE.md: claude/claude-md-import-exists@2',
  'packages/ie/CLAUDE.local.md: claude/claude-md-import-exists@2',
  'packages/ie/AGENTS.md: claude/claude-md-import-exists@2',
  'packages/ie/.claude/AGENTS.md: claude/claude-md-import-exists@2',
  // `claude-md-import-max-depth` reads CLAUDE.md, CLAUDE.local.md and AGENTS.md, and no other file.
  'packages/md/CLAUDE.md: claude/claude-md-import-max-depth@2',
  'packages/md/.claude/CLAUDE.md: claude/claude-md-import-max-depth@2',
  'packages/md/CLAUDE.local.md: claude/claude-md-import-max-depth@2',
  'packages/mda/AGENTS.md: claude/claude-md-import-max-depth@2',
  // `claude-md-max-lines` reads CLAUDE.md, CLAUDE.local.md and AGENTS.md, and the files they import.
  'packages/lm/CLAUDE.md: claude/claude-md-max-lines@1',
  'packages/lm/.claude/CLAUDE.md: claude/claude-md-max-lines@1',
  'packages/lm/CLAUDE.local.md: claude/claude-md-max-lines@1',
  'packages/lma/AGENTS.md: claude/claude-md-max-lines@1',
  'packages/lmi/CLAUDE.md: claude/claude-md-max-lines@1',
  // `rules-max-lines` reads Markdown below `.claude/rules/`, and no other file.
  'packages/rm/.claude/rules/long.md: claude/rules-max-lines@1',
  // `memory-index-max-size` reads the `MEMORY.md` of a subagent, and no other file.
  'packages/mi/.claude/agent-memory/rev/MEMORY.md: claude/memory-index-max-size@1',
  // `claude-md-import-external` reads CLAUDE.md files, and no other file.
  'packages/ix/CLAUDE.md: claude/claude-md-import-external@1',
  'packages/ix/.claude/CLAUDE.md: claude/claude-md-import-external@1',
  // `claude-md-symlink` reads the CLAUDE.md files that are links.
  ...(LINKS ? ['packages/cs/CLAUDE.md: claude/claude-md-symlink@1'] : []),
  // `rules-symlink-external` reads the rule files that are links out of the tree, and no scoped one.
  ...(LINKS ? ['packages/rx/.claude/rules/plain.md: claude/rules-symlink-external@1'] : []),
  // `memory-auto-memory-directory-committed` reads the two project files, and no managed file.
  'packages/ad/.claude/settings.json: claude/memory-auto-memory-directory-committed@1',
  'packages/ad/.claude/settings.local.json: claude/memory-auto-memory-directory-committed@1',
  // The tree of `memory-settings-schema` sets the key too, in the two project files.
  'packages/ms/.claude/settings.local.json: claude/memory-auto-memory-directory-committed@1',
  'packages/ms/ok/.claude/settings.json: claude/memory-auto-memory-directory-committed@1',
  // `claude-md-excludes-pattern` reads the project and managed files, and no other file.
  'packages/cx/.claude/settings.json: claude/claude-md-excludes-pattern@2',
  'packages/cx/.claude/settings.local.json: claude/claude-md-excludes-pattern@2',
  'packages/cx/managed-settings.json: claude/claude-md-excludes-pattern@2',
  'packages/cx/managed-settings.d/10-a.json: claude/claude-md-excludes-pattern@2',
  'packages/cx/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `rules-frontmatter-schema` reads Markdown below `.claude/rules/`, and no other file.
  'packages/rf/.claude/rules/globs.md: claude/rules-frontmatter-schema@2',
  'packages/rf/.claude/rules/sub/yaml.md: claude/rules-frontmatter-schema@2',
  'packages/rf/.claude/rules/late.md: claude/rules-frontmatter-schema@2',
  // `rules-paths-glob-valid` reads Markdown below `.claude/rules/`, and no other file.
  'packages/rg/.claude/rules/bracket.md: claude/rules-paths-glob-valid@2',
  // `rules-md-extension` reads every file below `.claude/rules/`, and no other file.
  'packages/re/.claude/rules/style.txt: claude/rules-md-extension@2',
  'packages/re/.claude/rules/sub/react.markdown: claude/rules-md-extension@2',
  'packages/re/.claude/rules/noextension: claude/rules-md-extension@2',
  // `memory-settings-schema` reads the project and managed files, and no other file.
  'packages/ms/.claude/settings.json: claude/memory-settings-schema@2',
  // `settings-schema` also reports the wrong type of `autoMemoryEnabled`.
  'packages/ms/.claude/settings.json: claude/settings-schema@2',
  'packages/ms/.claude/settings.local.json: claude/memory-settings-schema@2',
  'packages/ms/managed-settings.json: claude/memory-settings-schema@2',
  'packages/ms/managed-settings.d/10-a.json: claude/memory-settings-schema@2',
  'packages/ms/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-schema` reads the project and managed files, and no other file.
  ...[
    'packages/ss/.claude/settings.json',
    'packages/ss/.claude/settings.local.json',
    'packages/ss/managed-settings.json',
    'packages/ss/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-schema@2`),
  'packages/ss/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-deprecated-key` reads the project and managed files, and no other file.
  ...[
    'packages/dk/.claude/settings.json',
    'packages/dk/.claude/settings.local.json',
    'packages/dk/managed-settings.json',
    'packages/dk/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-deprecated-key@1`),
  'packages/dk/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-attribution-false` reads the two project files, and no managed file.
  ...['packages/af/.claude/settings.json', 'packages/af/.claude/settings.local.json'].map(
    (file) => `${file}: claude/settings-attribution-false@1`,
  ),
  // `settings-redundant-value` reads the project and managed files, and no other file.
  ...[
    'packages/rv/.claude/settings.json',
    'packages/rv/.claude/settings.local.json',
    'packages/rv/managed-settings.json',
    'packages/rv/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-redundant-value@1`),
  'packages/rv/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-project-autocontinue-off` reads the project and managed files. Only the Boolean
  // values in the managed files are silent.
  ...[
    'packages/au/.claude/settings.json',
    'packages/au/.claude/settings.local.json',
    'packages/au/managed-settings.json',
    'packages/au/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-project-autocontinue-off@1`),
  'packages/au/managed-settings.d/.30-hidden.json: claude/settings-managed-file@2',
  // `settings-schema-url` reports a `$schema` with another value, and each settings file with no
  // `$schema`. The first group below is the tree files with another value.
  ...['packages/su/.claude/settings.json', 'packages/su/managed-settings.json'].map(
    (file) => `${file}: claude/settings-schema-url@1`,
  ),
  'packages/su/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  ...SCHEMA_URL_MISSING.map((file) => `${file}: claude/settings-schema-url@1`),
  // `settings-outputstyle-resolves` reads the two project files, and no managed file.
  'packages/os/.claude/settings.json: claude/settings-outputstyle-resolves@2',
  'packages/os/.claude/settings.local.json: claude/settings-outputstyle-resolves@2',
  // `settings-env-deprecated-var` reads the project and managed files, and no other file.
  ...[
    'packages/dv/.claude/settings.json',
    'packages/dv/.claude/settings.local.json',
    'packages/dv/managed-settings.json',
    'packages/dv/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-env-deprecated-var@1`),
  'packages/dv/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-env-routing` reads the shared project file only. `settings-env-ignored-var` owns the
  // OpenTelemetry endpoint.
  'packages/er/.claude/settings.json: claude/settings-env-routing@1',
  'packages/er2/.claude/settings.json: claude/settings-env-ignored-var@2',
  // `settings-env-prompt-caching-off` reads the shared project file only.
  'packages/pc/.claude/settings.json: claude/settings-env-prompt-caching-off@1',
  // `settings-committed-helper-command` reads the shared project file only.
  'packages/ch/.claude/settings.json: claude/settings-committed-helper-command@1',
  // The git trees have a local file below the root of a repository, and a shared file with a
  // status line command.
  'packages/hx/sl/.claude/settings.json: claude/settings-committed-helper-command@1',
  'packages/hx/sl/ok/.claude/settings.json: claude/settings-committed-helper-command@1',
  'packages/hc2/.claude/settings.json: claude/settings-committed-helper-command@1',
  'packages/oa-home/.claude/settings.json: claude/settings-committed-helper-command@1',
  'packages/oa-size/.claude/settings.json: claude/settings-committed-helper-command@1',
  // `settings-local-location` reports the local file below the root of a repository.
  'packages/ll/pkg/.claude/settings.local.json: claude/settings-local-location@1',
  'packages/gu/set/bad/.claude/settings.local.json: claude/settings-local-location@1',
  'packages/gu/set/ok/.claude/settings.local.json: claude/settings-local-location@1',
  'packages/gu/set/ok/other/.claude/settings.local.json: claude/settings-local-location@1',
  'packages/hx/sl/.claude/settings.local.json: claude/settings-local-location@1',
  // `settings-webfetch-preflight-skip` reads the project files and the managed source. A rule in
  // the other file makes the key silent.
  ...[
    'packages/wf/.claude/settings.json',
    'packages/wf/.claude/settings.local.json',
    'packages/wf/managed-settings.json',
    'packages/wf/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-webfetch-preflight-skip@1`),
  'packages/wf/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-env-numeric-spelling` reports nothing in the presets, which set no `minVersion`.
  // `settings-env-value-format` owns a variable that has a form.
  'packages/numeric/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/numeric2/.claude/settings.json: claude/settings-env-value-format@2',
  // `settings-worktree-sparse-claude-dir` reads the project and managed files. A list with
  // `.claude` in the other file makes both files silent.
  ...[
    'packages/sparse/.claude/settings.json',
    'packages/sparse/.claude/settings.local.json',
    'packages/sparse/managed-settings.json',
    'packages/sparse/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-worktree-sparse-claude-dir@1`),
  'packages/sparse/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-footerlinks-pattern` reads the managed files. `settings-key-scope` reports the key in
  // the project file.
  'packages/footer/managed-settings.json: claude/settings-footerlinks-pattern@1',
  'packages/footer/managed-settings.d/10-a.json: claude/settings-footerlinks-pattern@1',
  'packages/footer/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/footer/.claude/settings.json: claude/settings-key-scope@2',
  // `settings-managed-value-form` reads the managed files.
  'packages/form/managed-settings.json: claude/settings-managed-value-form@1',
  'packages/form/managed-settings.d/10-a.json: claude/settings-managed-value-form@1',
  'packages/form/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-managed-version-floor` reads the managed files. `settings-key-scope` reports the key
  // in the project file.
  'packages/floor/managed-settings.json: claude/settings-managed-version-floor@1',
  'packages/floor/managed-settings.d/10-a.json: claude/settings-managed-version-floor@1',
  'packages/floor/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/floor/.claude/settings.json: claude/settings-key-scope@2',
  // `statusline-windows-path` reads the project and managed files.
  // `settings-committed-helper-command` reports the shared file too.
  ...[
    'packages/winpath/.claude/settings.json',
    'packages/winpath/.claude/settings.local.json',
    'packages/winpath/managed-settings.json',
    'packages/winpath/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/statusline-windows-path@1`),
  'packages/winpath/.claude/settings.json: claude/settings-committed-helper-command@1',
  'packages/winpath/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-global-only-file` reads the files of `packages/go`, and no other file.
  'packages/go/.claude/keybindings.json: claude/settings-global-only-file@2',
  'packages/go/.claude/themes/dracula.json: claude/settings-global-only-file@2',
  'packages/go/.claude.json: claude/settings-global-only-file@2',
  // The grammar rules read the settings files of a project, and no other settings file.
  ...[
    '.claude/settings.json',
    '.claude/settings.local.json',
    'packages/x/.claude/settings.json',
    'packages/x/.claude/settings.local.json',
  ].flatMap((file) =>
    [...GRAMMAR_RULES, 'permissions-skill-rule'].map((rule) => `${file}: claude/${rule}@2`),
  ),
  // The grammar rules also read a managed file and a drop-in, and no hidden drop-in.
  ...['packages/gr/managed-settings.json', 'packages/gr/managed-settings.d/10-a.json'].flatMap(
    (file) =>
      [...GRAMMAR_RULES, 'permissions-skill-rule'].map((rule) => `${file}: claude/${rule}@2`),
  ),
  'packages/gr/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `hooks-event-name-known` reads a managed file and a drop-in too.
  'packages/gr/managed-settings.json: claude/hooks-event-name-known@2',
  'packages/gr/managed-settings.d/10-a.json: claude/hooks-event-name-known@2',
  // The grammar rules also read the tool lists of a skill file. A subagent has none of that.
  ...GRAMMAR_RULES.filter((rule) => rule !== SETTINGS_ONLY).map(
    (rule) => `.claude/skills/grammar/SKILL.md: claude/${rule}@2`,
  ),
  '.claude/commands/allowed.md: claude/command-legacy-format@1',
  '.claude/commands/allowed.md: claude/permissions-unknown-tool@2',
  'plugins/p/commands/allowed.md: claude/command-legacy-format@1',
  'plugins/p/commands/allowed.md: claude/permissions-unknown-tool@2',
  '.claude/skills/broad/SKILL.md: claude/skill-allowed-tools-broad@2',
  '.claude/skills/skill-rule/SKILL.md: claude/permissions-skill-rule@2',
  '.claude/agents/tools.md: claude/agent-tools-known@2',
  'plugins/p/agents/tools.md: claude/agent-tools-known@2',
  '.claude/agents/unavailable.md: claude/agent-tools-unavailable@2',
  'packages/z/.claude/agents/boss.md: claude/agent-memory-auto-memory-off@2',
  'packages/z/.claude/agents/boss.md: claude/agent-model-forced@2',
  'packages/z/.claude/agents/boss.md: claude/agent-omit-claude-md-main@2',
  'packages/z/.claude/agents/dup1.md: claude/agent-name-unique@2',
  'packages/z/.claude/agents/dup2.md: claude/agent-name-unique@2',
  'packages/z/.claude/agents/preload.md: claude/agent-skills-preloadable@2',
  '.claude/agents/shadow.md: claude/agent-name-shadows-builtin@1',
  '.claude/agents/conditional.md: claude/agent-tools-conditional@1',
  'plugins/p/agents/conditional.md: claude/agent-tools-conditional@1',
  '.claude/agents/disallowed.md: claude/agent-disallowed-tools-scope@1',
  '.claude/agents/task-alias.md: claude/agent-tools-task-alias@1',
  '.claude/agents/inline.md: claude/agent-mcp-servers-inline-trust@1',
  // A plugin agent ignores `mcpServers`, so the trust rule is silent and the ignored-fields rule reports.
  'plugins/p/agents/inline.md: claude/agent-plugin-ignored-fields@2',
  '.claude/agents/manual.md: claude/agent-permission-mode-manual@1',
  // A plugin agent ignores `permissionMode`, so the manual rule is silent and the ignored-fields rule reports.
  'plugins/p/agents/manual.md: claude/agent-plugin-ignored-fields@2',
  '.claude/agents/scope.md: claude/agent-memory-scope-project@1',
  'plugins/p/agents/scope.md: claude/agent-memory-scope-project@1',
  'plugins/p/agents/clash-a.md: claude/agent-plugin-scoped-name-unique@1',
  'plugins/p/agents/clash-b.md: claude/agent-plugin-scoped-name-unique@1',
  '.claude/agents/review/deep/deep-manual.md: claude/agent-permission-mode-manual@1',
  '.claude/agents/review/deep/deep-scope.md: claude/agent-memory-scope-project@1',
  'plugins/p/agents/sub/d.md: claude/agent-plugin-scoped-name-unique@1',
  'plugins/p/agents/sub/e.md: claude/agent-plugin-scoped-name-unique@1',
  'packages/sh/pkg/.claude/agents/sub/deepdup.md: claude/agent-name-shadowing@1',
  // `ignored.md` and `inline.md` of the plugin are both named `i`.
  'plugins/p/agents/ignored.md: claude/agent-plugin-scoped-name-unique@1',
  'plugins/p/agents/inline.md: claude/agent-plugin-scoped-name-unique@1',
  'packages/sh/pkg/.claude/agents/layered.md: claude/agent-name-shadowing@1',
  'packages/sh/pkg/.claude/output-styles/layered.md: claude/output-style-name-unique@1',
  '.claude/output-styles/twin-a.md: claude/output-style-name-unique@1',
  '.claude/output-styles/twin-b.md: claude/output-style-name-unique@1',
  'plugins/p/output-styles/forced.md: claude/output-style-force-for-plugin@1',
  'plugins/p/output-styles/forced.md: claude/output-style-plugin-name-description@1',
  'plugins/p/output-styles/bare.md: claude/output-style-plugin-name-description@1',
  // The warn rules of #50, layer 1. `skill-description-present` also reports each file of the
  // earlier rules that has no `description`. The folder `fork` is the name of a built-in command.
  '.claude/commands/allowed.md: claude/skill-description-present@1',
  '.claude/commands/c.md: claude/skill-description-present@1',
  '.claude/commands/cbom.md: claude/command-legacy-format@1',
  '.claude/commands/ghost.md: claude/skill-description-present@1',
  '.claude/commands/cmeta.md: claude/command-legacy-format@1',
  '.claude/commands/cmeta.md: claude/skill-metadata-reserved-keys@1',
  '.claude/commands/model.md: claude/command-legacy-format@1',
  '.claude/commands/model.md: claude/skill-name-shadows-builtin@1',
  '.claude/commands/ns/c.md: claude/skill-description-present@1',
  '.claude/commands/schema.md: claude/skill-description-present@1',
  '.claude/skills/agent-ok/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/agent/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/bang/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/broad/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/fork/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/fork/SKILL.md: claude/skill-name-shadows-builtin@1',
  '.claude/skills/glob-ok/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/glob/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/grammar/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/meta/SKILL.md: claude/skill-metadata-reserved-keys@1',
  '.claude/skills/no-description/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/position/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/redundant/SKILL.md: claude/skill-invocation-redundant-fields@1',
  '.claude/skills/ref-ok/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/ref/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/schema/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/shadow/SKILL.md: claude/skill-name-shadows-builtin@1',
  '.claude/skills/skill-rule/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/synced/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/tools/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/twin-a/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/twin-b/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/unreachable/SKILL.md: claude/skill-description-present@1',
  '.claude/skills/vars/SKILL.md: claude/skill-description-present@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/skill-description-present@1',
  'packages/x/.claude/skills/twin/SKILL.md: claude/skill-description-present@1',
  'plugins/p/commands/allowed.md: claude/skill-description-present@1',
  'plugins/p/commands/c.md: claude/skill-description-present@1',
  'plugins/p/SKILL.md: claude/skill-description-present@1',
  'plugins/p/skills/synced/SKILL.md: claude/skill-description-present@1',
  'plugins/p/skills/vars/SKILL.md: claude/skill-description-present@1',
  'plugins/q/SKILL.md: claude/skill-description-present@1',
  // The warn rules of #50, layer 2. The folder `long` has 500 lines, and `short` has 499.
  '.claude/commands/cescape.md: claude/command-legacy-format@1',
  '.claude/commands/cescape.md: claude/skill-argument-escape@1',
  '.claude/skills/escape/SKILL.md: claude/skill-argument-escape@1',
  '.claude/skills/long/SKILL.md: claude/skill-max-lines@1',
  'plugins/q/SKILL.md: claude/skill-plugin-root-name@1',
  // The command files of the `off` skill rules of layers 3 and 4 are legacy files.
  'packages/bt/.claude/commands/cbig.md: claude/command-legacy-format@1',
  'packages/ir/.claude/commands/cbad.md: claude/command-legacy-format@1',
  'packages/ld/.claude/commands/cprice.md: claude/command-legacy-format@1',
  'packages/mo/.claude/commands/cmodel.md: claude/command-legacy-format@1',
  'packages/pw/commands/cbad.md: claude/command-legacy-format@1',
  'packages/pw/commands/cbad.md: claude/plugin-path-var-braced@2',
  'packages/pw/skills/bad/SKILL.md: claude/plugin-path-var-braced@2',
  'packages/se/.claude/commands/cpush.md: claude/command-legacy-format@1',
  // The `.mcp.json` rules read `.mcp.json` and the three paths under `.claude/`, and no other file.
  // The paths under `.claude/` get the location report only.
  ...[
    'mcp-server-name-reserved',
    'mcp-remote-url-empty',
    'mcp-hidden-whitespace',
    'mcp-timeout-min',
    'mcp-oauth-transport',
    'mcp-oauth-values',
    'mcp-authorization-header-with-oauth',
    'mcp-project-dir-default',
    'mcp-env-expansion-field',
    'mcp-credential-var-remote',
    'mcp-headershelper-credential-env',
    'mcp-anthropic-hosted-url',
  ].map((rule) => `packages/mc/.mcp.json: claude/${rule}@2`),
  'packages/mk2/.mcp.json: claude/mcp-json-servers-key@2',
  // The settings and approval rules of #16. The hidden drop-ins are for `settings-managed-file`.
  'packages/mcs/.claude/settings.json: claude/mcp-settings-mcpservers@2',
  'packages/mcs/.claude/settings.json: claude/settings-schema@2',
  'packages/mcs/.claude/settings.local.json: claude/settings-schema@2',
  'packages/mcs/managed-settings.json: claude/settings-schema@2',
  'packages/mcs/.claude/settings.local.json: claude/mcp-settings-mcpservers@2',
  'packages/pb/.claude/skills/p/.claude-plugin/plugin.json: claude/mcp-project-plugin-bundle@2',
  'packages/pb/.claude/skills/p/.claude-plugin/plugin.json: claude/plugin-project-skills-dir-limits@2',
  'packages/pb/.claude/skills/r/.claude-plugin/plugin.json: claude/mcp-project-plugin-bundle@2',
  'packages/pb/.claude/skills/r/.claude-plugin/plugin.json: claude/plugin-project-skills-dir-limits@2',
  'packages/tn/.claude/settings.json: claude/mcp-tool-name-format@2',
  'packages/tn/.claude/settings.local.json: claude/mcp-tool-name-format@2',
  'packages/tn/managed-settings.json: claude/mcp-tool-name-format@2',
  'packages/tn/managed-settings.d/10-a.json: claude/mcp-tool-name-format@2',
  'packages/tn/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/tn/.claude/skills/s/SKILL.md: claude/mcp-tool-name-format@2',
  'packages/tn/.claude/skills/s/SKILL.md: claude/skill-description-present@1',
  'packages/ma/.claude/settings.json: claude/mcp-approval-committed@2',
  'packages/ma2/.claude/settings.json: claude/mcp-approval-committed@2',
  'packages/dc/managed-settings.json: claude/mcp-disable-connectors-false@2',
  'packages/dc/managed-settings.d/10-a.json: claude/mcp-disable-connectors-false@2',
  'packages/dc/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/dc/.claude/settings.json: claude/settings-project-value-ignored@2',
  'packages/dc/.claude/settings.local.json: claude/settings-project-value-ignored@2',
  'packages/pe/.claude/settings.json: claude/mcp-policy-entry-schema@2',
  'packages/pe/.claude/settings.local.json: claude/mcp-policy-entry-schema@2',
  'packages/pe/managed-settings.json: claude/mcp-policy-entry-schema@2',
  'packages/pe/managed-settings.d/10-a.json: claude/mcp-policy-entry-schema@2',
  'packages/pe/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  ...['.claude/.mcp.json', '.claude/mcp.json', '.claude/config/mcp.json'].map(
    (file) => `packages/mu/${file}: claude/mcp-json-location@2`,
  ),
  // The plugin file has no wrapper. The URL rule skips the placeholder. The project directory
  // rule skips a plugin file.
  ...[
    'mcp-server-name-reserved',
    'mcp-hidden-whitespace',
    'mcp-timeout-min',
    'mcp-oauth-transport',
    'mcp-oauth-values',
    'mcp-authorization-header-with-oauth',
    'mcp-env-expansion-field',
    'mcp-credential-var-remote',
    'mcp-headershelper-credential-env',
    'mcp-anthropic-hosted-url',
  ].map((rule) => `plugins/p/.mcp.json: claude/${rule}@2`),
  // The LSP rules read `.lsp.json` at a plugin root. The socket rule reads an inline `lspServers`.
  'plugins/q/.lsp.json: claude/lsp-json-schema@2',
  'plugins/q/.lsp.json: claude/lsp-transport-socket@2',
  'plugins/lx/.claude-plugin/plugin.json: claude/lsp-transport-socket@2',
  // The warn rules of the server names, transport and headers. The project file holds every
  // fault. `mcp-headershelper-committed` reports both helpers. The plugin file gets the rules
  // that read a plugin. The three paths under `.claude/` get none.
  'packages/mc/.mcp.json: claude/mcp-headershelper-committed@1',
  'packages/mc/.mcp.json: claude/mcp-headershelper-committed@1',
  ...[
    'mcp-headershelper-path',
    'mcp-no-sse-transport',
    'mcp-server-name-anthropic-skills',
    'mcp-server-name-format',
  ].flatMap((rule) => [
    `packages/mc/.mcp.json: claude/${rule}@1`,
    `plugins/p/.mcp.json: claude/${rule}@1`,
    `plugins/ns/.claude-plugin/plugin.json: claude/${rule}@1`,
  ]),
  'packages/mc/.mcp.json: claude/mcp-stdio-relative-path@1',
  'packages/iu/.mcp.json: claude/mcp-insecure-url@1',
  'packages/ae/managed-settings.json: claude/mcp-allowlist-empty@1',
  'packages/ae/managed-settings.d/.10-hidden.json: claude/settings-managed-file@2',
  'packages/lv/managed-settings.json: claude/mcp-policy-literal-values@1',
  'packages/lv/managed-settings.d/.10-hidden.json: claude/settings-managed-file@2',
  'packages/sw/managed-settings.json: claude/mcp-policy-servername-weak@1',
  'packages/sw/managed-settings.d/.10-hidden.json: claude/settings-managed-file@2',
  // The managed policy rules read the main file and the drop-ins, and the secret rule reads the
  // committed project file.
  'packages/mad/managed-settings.json: claude/mcp-allowlist-servername-dead@2',
  'packages/mad/managed-settings.d/10-a.json: claude/mcp-allowlist-servername-dead@2',
  'packages/mad/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/me/managed-settings.json: claude/mcp-managed-servers-entry@2',
  'packages/me/managed-settings.d/10-a.json: claude/mcp-managed-servers-entry@2',
  'packages/me/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/cs/.claude/settings.json: claude/mcp-env-client-secret@2',
  'plugins/dn/.claude-plugin/plugin.json: claude/mcp-duplicate-server-name@2',
  'plugins/ts/skills/s/SKILL.md: claude/mcp-plugin-tool-name-scoped@2',
  'plugins/ts/commands/c.md: claude/mcp-plugin-tool-name-scoped@2',
  'plugins/ts/commands/c.md: claude/command-legacy-format@1',
  'plugins/ts/commands/c.md: claude/skill-description-present@1',
  'plugins/ts/skills/o/SKILL.md: claude/skill-description-present@1',
  'plugins/ts/skills/s/SKILL.md: claude/skill-description-present@1',
  'plugins/ts/agents/a.md: claude/mcp-plugin-tool-name-scoped@2',
  // The `off` rules report in `strict` only. These files get the reports of other rules.
  'packages/tk/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/tu/.claude/commands/c.md: claude/command-legacy-format@1',
  'packages/tu/.claude/commands/c.md: claude/skill-description-present@1',
  'packages/tu/.claude/skills/s/SKILL.md: claude/skill-description-present@1',
  'packages/tk/.claude/settings.json: claude/settings-schema@2',
  'packages/tk/.claude/settings.local.json: claude/settings-schema@2',
  'packages/tk/managed-settings.d/10-a.json: claude/settings-schema@2',
  'packages/rl/.mcp.json: claude/mcp-stdio-relative-path@1',
  'packages/an/.claude/settings.json: claude/mcp-approval-names-exist@2',
  'packages/an/.claude/settings.local.json: claude/mcp-approval-names-exist@2',
  'packages/an/.claude/settings.json: claude/mcp-approval-committed@2',
  'packages/mac/.claude/settings.json: claude/mcp-approval-conflict@2',
  'packages/mac/.claude/settings.json: claude/mcp-approval-committed@2',
  'packages/mac/managed-settings.d/10-a.json: claude/mcp-approval-conflict@2',
  'packages/mac/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/ao/.claude/settings.json: claude/mcp-allow-deny-overlap@2',
  'packages/ao/managed-settings.d/10-a.json: claude/mcp-allow-deny-overlap@2',
  'packages/ao/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  'packages/ao/managed-settings.json: claude/mcp-policy-servername-weak@1',
  'packages/ao/managed-settings.d/10-a.json: claude/mcp-policy-servername-weak@1',
  'packages/lc/.claude-plugin/marketplace.json: claude/lsp-extension-conflict@2',
  'packages/lc/marketplace.json: claude/marketplace-location@1',
  'plugins/ld/.claude-plugin/plugin.json: claude/lsp-duplicate-server-name@2',
  // The hooks warn rules of layer H5.
  'packages/dh/.claude/settings.json: claude/hooks-disable-all-override@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-filechanged-star-matcher@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-placeholder-quoted@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-sessionend-default-timeout@1',
  'packages/hk/.claude/settings.json: claude/hooks-filechanged-star-matcher@1',
  'packages/hk/.claude/settings.json: claude/hooks-placeholder-quoted@1',
  'packages/hk/.claude/settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/settings.json: claude/hooks-sessionend-default-timeout@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-filechanged-star-matcher@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-placeholder-quoted@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-sessionend-default-timeout@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-filechanged-star-matcher@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-placeholder-quoted@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-sessionend-default-timeout@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-filechanged-star-matcher@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-placeholder-quoted@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-sessionend-default-timeout@1',
  'packages/hk/managed-settings.json: claude/hooks-filechanged-star-matcher@1',
  'packages/hk/managed-settings.json: claude/hooks-placeholder-quoted@1',
  'packages/hk/managed-settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/managed-settings.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/managed-settings.json: claude/hooks-sessionend-default-timeout@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-filechanged-star-matcher@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-prefer-exec-form@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-agent-type-experimental@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-command-deprecated-cli-flag@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-worktree-create-without-remove@1',
  'packages/hk/.claude/settings.json: claude/hooks-agent-type-experimental@1',
  'packages/hk/.claude/settings.json: claude/hooks-command-deprecated-cli-flag@1',
  'packages/hk/.claude/settings.json: claude/hooks-worktree-create-without-remove@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-agent-type-experimental@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-command-deprecated-cli-flag@1',
  'packages/hk/.claude/settings.local.json: claude/hooks-worktree-create-without-remove@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-agent-type-experimental@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-command-deprecated-cli-flag@1',
  'packages/hk/.claude/skills/hk/SKILL.md: claude/hooks-worktree-create-without-remove@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-agent-type-experimental@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-command-deprecated-cli-flag@1',
  'packages/hk/managed-settings.d/10-a.json: claude/hooks-worktree-create-without-remove@1',
  'packages/hk/managed-settings.json: claude/hooks-agent-type-experimental@1',
  'packages/hk/managed-settings.json: claude/hooks-command-deprecated-cli-flag@1',
  'packages/hk/managed-settings.json: claude/hooks-worktree-create-without-remove@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-agent-type-experimental@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-command-deprecated-cli-flag@1',
  'packages/hk/plugin/hooks/hooks.json: claude/hooks-worktree-create-without-remove@1',
  'packages/dup/.claude-plugin/plugin.json: claude/hooks-duplicate-handler@1',
  'packages/dup/hooks/hooks.json: claude/hooks-duplicate-handler@1',
].sort()

// The reports of the `off` agent and marketplace rules. They appear in `strict` only, at `warn`.
// `task-alias.md` is an agent that no setting runs as the main thread, so its type list is
// ignored. The marketplace credential rule reads the project settings files and the marketplace,
// and no other file. The declared rule reads the two project settings files.
const STRICT_ONLY = [
  'packages/hs/.claude/settings.json: claude/hooks-committed-command-review@1',
  'packages/hs/loose/hooks/hooks.json: claude/hooks-committed-command-review@1',
  'packages/hs/plugin/hooks/hooks.json: claude/hooks-committed-command-review@1',
  'packages/hx/.claude/settings.json: claude/hooks-committed-command-review@1',
  'packages/hx/loose/hooks/hooks.json: claude/hooks-committed-command-review@1',
  'packages/hx/ok/.claude/settings.json: claude/hooks-committed-command-review@1',
  'packages/hx/plugin/hooks/hooks.json: claude/hooks-committed-command-review@1',
  ...STRICT_ONLY_EXPECTED,
  // The hooks rules of #10 report the `ucf` plugin hooks.
  'plugins/ucf/hooks/hooks.json: claude/hooks-command-path-variable@1',
  'plugins/ucf/hooks/hooks.json: claude/hooks-command-shell-safety@1',
  'plugins/ucf/hooks/hooks.json: claude/hooks-committed-command-review@1',
  'packages/hk/.claude/agents/hk.md: claude/hooks-agent-stop-event@1',
  '.claude/agents/task-alias.md: claude/agent-tools-agent-type-list@1',
  'packages/o/.claude/agents/skill-tool.md: claude/agent-tools-skill-for-preload@1',
  'packages/o/.claude/agents/model.md: claude/agent-model-value@1',
  'plugins/p/agents/model.md: claude/agent-model-value@1',
  'packages/o/.claude/agents/prompt.md: claude/agent-initial-prompt-main-only@1',
  'packages/o/.claude/agents/main.md: claude/agent-tools-agent-type-list@1',
  'packages/o/.claude/agents/typelist.md: claude/agent-tools-agent-type-list@1',
  'packages/o/.claude/agents/skills.md: claude/agent-skills-exist@1',
  'packages/o/.claude/agents/mcp-ref.md: claude/agent-mcp-servers-ref-exists@1',
  'packages/uh/.claude-plugin/marketplace.json: claude/marketplace-relative-source-url-hosted@1',
  'packages/hc/.claude-plugin/marketplace.json: claude/marketplace-headers-literal-credential@1',
  'packages/hc/.claude/settings.json: claude/marketplace-headers-literal-credential@1',
  'packages/hc/.claude/settings.local.json: claude/marketplace-headers-literal-credential@1',
  'packages/md/.claude/settings.json: claude/settings-enabled-plugins-marketplace-declared@1',
  'packages/md/.claude/settings.local.json: claude/settings-enabled-plugins-marketplace-declared@1',
  // The local file of `packages/so` enables `a@m`, and no file declares `m`.
  'packages/so/.claude/settings.local.json: claude/settings-enabled-plugins-marketplace-declared@1',
  // The `off` skill rules report the files below. Each of the six skills of the budget scope
  // reports, with its own share.
  ...['a', 'b', 'c', 'd', 'e', 'f'].map(
    (folder) => `packages/lb/.claude/skills/${folder}/SKILL.md: claude/skill-listing-budget@1`,
  ),
  'packages/bt/.claude/skills/big/SKILL.md: claude/skill-body-token-budget@1',
  'packages/bt/.claude/commands/cbig.md: claude/skill-body-token-budget@1',
  'packages/ld/.claude/skills/price/SKILL.md: claude/skill-literal-dollar@1',
  'packages/ld/.claude/commands/cprice.md: claude/skill-literal-dollar@1',
  'packages/pw/skills/bad/SKILL.md: claude/skill-plugin-path-vars@1',
  'plugins/bare/skills/s/SKILL.md: claude/skill-plugin-path-vars@1',
  'packages/ir/.claude/skills/bad/SKILL.md: claude/skill-inject-robustness@1',
  'packages/ir/.claude/commands/cbad.md: claude/skill-inject-robustness@1',
  'packages/se/.claude/skills/push/SKILL.md: claude/skill-side-effects-manual-only@1',
  'packages/se/.claude/commands/cpush.md: claude/skill-side-effects-manual-only@1',
  'packages/mo/.claude/skills/opus/SKILL.md: claude/skill-model-override@1',
  'packages/mo/.claude/commands/cmodel.md: claude/skill-model-override@1',
  'packages/lr/.claude/loop.md: claude/skill-loop-reference-invocable@1',
  // `claude-md-import-in-code-span` reads CLAUDE.md, CLAUDE.local.md and AGENTS.md, and no other file.
  // `claude-md-agents-md-prose-pointer` reads CLAUDE.md files, and no other file.
  'packages/pp/CLAUDE.md: claude/claude-md-agents-md-prose-pointer@1',
  'packages/pp/.claude/CLAUDE.md: claude/claude-md-agents-md-prose-pointer@1',
  // `claude-md-excludes-absolute-committed` reads the committed project file, and no other file.
  'packages/ea/.claude/settings.json: claude/claude-md-excludes-absolute-committed@1',
  'packages/cx/ok/.claude/settings.json: claude/claude-md-excludes-absolute-committed@1',
  // `memory-agent-memory-orphan` reads the `MEMORY.md` index, and no other file.
  'packages/ao/.claude/agent-memory/lone/MEMORY.md: claude/memory-agent-memory-orphan@1',
  // The staged fixture tree of `packages/gu` holds one index with no agent.
  'packages/gu/mem/project/.claude/agent-memory/reviewer/MEMORY.md: claude/memory-agent-memory-orphan@1',
  // `rules-paths-no-match` reads the rule files, and no other file.
  'packages/pn/.claude/rules/miss.md: claude/rules-paths-no-match@1',
  // `claude-md-location` reads every Markdown file, and reports the two places and names.
  'packages/lo/.claude/CLAUDE.local.md: claude/claude-md-location@1',
  'packages/lo/web/claude.md: claude/claude-md-location@1',
  // The staged fixture tree of `packages/gu` holds a `.claude/CLAUDE.local.md`.
  'packages/gu/claude/dot/.claude/CLAUDE.local.md: claude/claude-md-location@1',
  // `claude-md-html-comment-content` reads CLAUDE.md and CLAUDE.local.md, and no other file.
  'packages/hc/CLAUDE.md: claude/claude-md-html-comment-content@1',
  'packages/hc/.claude/CLAUDE.md: claude/claude-md-html-comment-content@1',
  'packages/hc/CLAUDE.local.md: claude/claude-md-html-comment-content@1',
  'packages/ic/CLAUDE.md: claude/claude-md-import-in-code-span@1',
  'packages/ic/.claude/CLAUDE.md: claude/claude-md-import-in-code-span@1',
  'packages/ic/CLAUDE.local.md: claude/claude-md-import-in-code-span@1',
  'packages/ica/AGENTS.md: claude/claude-md-import-in-code-span@1',
  // `memory-index-entry-format` reads the `MEMORY.md` index, and no other file.
  'packages/ent/.claude/agent-memory/rev/MEMORY.md: claude/memory-index-entry-format@1',
  // `memory-topic-frontmatter` reads the topic files of a subagent, and no other file.
  'packages/tf/.claude/agent-memory/rev/bad.md: claude/memory-topic-frontmatter@1',
  // `claude-md-guardrail-to-hook` reads CLAUDE.md, CLAUDE.local.md and the rule files.
  'packages/gh/CLAUDE.md: claude/claude-md-guardrail-to-hook@1',
  'packages/gh/.claude/CLAUDE.md: claude/claude-md-guardrail-to-hook@1',
  'packages/gh/CLAUDE.local.md: claude/claude-md-guardrail-to-hook@1',
  'packages/gh/.claude/rules/lock.md: claude/claude-md-guardrail-to-hook@1',
  // `claude-md-derivable-content` reads CLAUDE.md and CLAUDE.local.md, and no other file.
  'packages/dc/CLAUDE.md: claude/claude-md-derivable-content@1',
  'packages/dc/.claude/CLAUDE.md: claude/claude-md-derivable-content@1',
  'packages/dc/CLAUDE.local.md: claude/claude-md-derivable-content@1',
  // `claude-md-git-instructions` reads CLAUDE.md and the rule files, and no other file.
  'packages/gi/CLAUDE.md: claude/claude-md-git-instructions@1',
  'packages/gi/.claude/CLAUDE.md: claude/claude-md-git-instructions@1',
  'packages/gi/.claude/rules/git.md: claude/claude-md-git-instructions@1',
  // `claude-md-dangling-reference` reads CLAUDE.md, CLAUDE.local.md and the rule files.
  'packages/dr/CLAUDE.md: claude/claude-md-dangling-reference@1',
  'packages/dr/.claude/CLAUDE.md: claude/claude-md-dangling-reference@1',
  'packages/dr/CLAUDE.local.md: claude/claude-md-dangling-reference@1',
  'packages/dr/.claude/rules/a.md: claude/claude-md-dangling-reference@1',
  // The `off` settings rules read only the files of their own glob, so the decoy files report
  // nowhere.
  'packages/oa-agent/.claude/settings.json: claude/settings-agent-exists@1',
  'packages/oa-cost/.claude/settings.json: claude/settings-env-context-cost@1',
  'packages/oa-format/.claude/settings.json: claude/settings-env-format-heuristic@1',
  'packages/oa-format/managed-settings.json: claude/settings-env-format-heuristic@1',
  'packages/oa-secret/.claude/settings.json: claude/settings-env-secret-heuristic@1',
  'packages/oa-cap/.claude/settings.json: claude/settings-model-capability@1',
  'packages/oa-cap/managed-settings.json: claude/settings-model-capability@1',
  'packages/oa-pin/.claude/settings.json: claude/settings-model-pin-version@1',
  'packages/oa-pin/managed-settings.json: claude/settings-model-pin-version@1',
  'packages/ll/pkg/.claude/settings.json: claude/settings-nested-project-file@1',
  // The git trees hold project files below the root of a repository.
  'packages/gu/set/bad/.claude/settings.json: claude/settings-nested-project-file@1',
  'packages/gu/set/ok/.claude/settings.json: claude/settings-nested-project-file@1',
  'packages/gu/set/open/.claude/settings.json: claude/settings-nested-project-file@1',
  'packages/hx/ok/.claude/settings.json: claude/settings-nested-project-file@1',
  'packages/hx/sl/.claude/settings.json: claude/settings-nested-project-file@1',
  'packages/hx/sl/ok/.claude/settings.json: claude/settings-nested-project-file@1',
  'packages/oa-skill/.claude/settings.json: claude/settings-skilloverrides-unknown-skill@1',
  // The sparse paths of the `settings-worktree-sparse-claude-dir` fixtures are not in the tree.
  'packages/sparse/.claude/settings.json: claude/settings-worktree-paths@1',
  'packages/sparse/.claude/settings.local.json: claude/settings-worktree-paths@1',
  'packages/sparse2/.claude/settings.json: claude/settings-worktree-paths@1',
  'packages/mf2/managed-settings.d/10-m.json: claude/settings-managed-merge@1',
  'packages/oa-wt/.claude/settings.json: claude/settings-worktree-paths@1',
  'packages/oa-wt/.claude/settings.local.json: claude/settings-worktree-paths@1',
  'packages/oa-merge/managed-settings.d/10-a.json: claude/settings-managed-merge@1',
  'packages/oa-effort/managed-settings.json: claude/settings-managed-effort-cap@1',
  'packages/oa-home/.claude/settings.json: claude/statusline-home-path-shared@1',
  'packages/oa-size/.claude/settings.json: claude/statusline-script-terminal-size@1',
  'packages/oa-size/managed-settings.json: claude/statusline-script-terminal-size@1',
  // The reports of the `off` MCP rules.
  'packages/al/.mcp.json: claude/mcp-always-load-count@1',
  // The two servers of the bad project file that hold a literal header credential.
  'packages/mc/.mcp.json: claude/mcp-no-literal-secrets@1',
  'packages/mc/.mcp.json: claude/mcp-no-literal-secrets@1',
  'packages/sk/.mcp.json: claude/mcp-env-var-syntax@1',
  'packages/sk/.mcp.json: claude/mcp-no-literal-secrets@1',
  'packages/sk/managed-mcp.json: claude/mcp-no-literal-secrets@1',
  'packages/tk/.claude/settings.json: claude/mcp-env-var-numbers@1',
  'packages/tk/.claude/settings.json: claude/mcp-project-toggle-keys@1',
  'packages/tk/.claude/settings.local.json: claude/mcp-project-toggle-keys@1',
  'packages/tk/managed-settings.json: claude/mcp-env-var-numbers@1',
  'packages/tk/managed-settings.d/10-a.json: claude/mcp-project-toggle-keys@1',
  'packages/tu/.claude/commands/c.md: claude/mcp-tool-server-unknown@1',
  'packages/tu/.claude/settings.json: claude/mcp-tool-server-unknown@1',
  'packages/tu/.claude/settings.local.json: claude/mcp-tool-server-unknown@1',
  'packages/tu/.claude/skills/s/SKILL.md: claude/mcp-tool-server-unknown@1',
  // The `.lsp.json` files with no plugin root: the new ones, and one of the schema fixtures.
  'packages/ll/.lsp.json: claude/lsp-json-location@1',
  'packages/ll/.claude/.lsp.json: claude/lsp-json-location@1',
  'packages/lp/.lsp.json: claude/lsp-json-location@1',
  'packages/ek/.mcp.json: claude/mcp-env-var-default@1',
  'packages/ek/.mcp.json: claude/mcp-stdio-command-has-args@1',
  'packages/ek/.mcp.json: claude/mcp-unknown-keys@1',
  'plugins/rp/.mcp.json: claude/mcp-plugin-root-paths@1',
  // The shared fixtures `badMcp` and `badMcpServers` hold an unknown key. The plugin one also holds a
  // relative path.
  'packages/mc/.mcp.json: claude/mcp-unknown-keys@1',
  'plugins/p/.mcp.json: claude/mcp-plugin-root-paths@1',
  'plugins/p/.mcp.json: claude/mcp-unknown-keys@1',
  'plugins/ucs/.claude-plugin/plugin.json: claude/plugin-user-config-sensitive@1',
  'plugins/chs/.claude-plugin/plugin.json: claude/plugin-channel-server-stdio@1',
  'packages/pr/plugins/user/.claude-plugin/plugin.json: claude/plugin-dependencies-prerelease-range@1',
  'plugins/bsc/.claude-plugin/plugin.json: claude/plugin-bin-shadows-system-command@1',
  'packages/rsh/.claude-plugin/marketplace.json: claude/plugin-relevance-signal-hints@1',
  'packages/dnm/package.json: claude/plugin-dir-not-marketplace-root@1',
  'plugins/nsr/.claude-plugin/plugin.json: claude/plugin-no-state-in-plugin-root@1',
]

// The agent and output style rules of #9, in the order of the `modules` list. Each is an
// error. The team rule has one block for Markdown and one for JSON.
const AGENT_RULES = [
  'agent-frontmatter-valid',
  'agent-frontmatter-schema',
  'agent-plugin-ignored-fields',
  'agent-mcp-servers-schema',
  'agent-permission-mode-bypass',
  'agent-memory-grants-write',
  'agent-tools-known',
  'agent-tools-unavailable',
  'agent-name-unique',
  'agent-skills-preloadable',
  'agent-memory-auto-memory-off',
  'agent-omit-claude-md-main',
  'agent-model-forced',
  'agent-teams-no-project-config',
  'agent-teams-no-project-config',
  'output-style-frontmatter-valid',
  'output-style-frontmatter-schema',
]

// The agent and output style rules of #9 that are `warn`, in the order of the `modules` list.
// They follow the agent and output style rules that are errors.
const AGENT_WARN_RULES = [
  'agent-disallowed-tools-scope',
  'agent-field-min-version',
  'agent-mcp-servers-inline-trust',
  'agent-memory-scope-project',
  'agent-name-shadowing',
  'agent-name-shadows-builtin',
  'agent-no-bom',
  'agent-permission-mode-manual',
  'agent-plugin-scoped-name-unique',
  'agent-tools-conditional',
  'agent-tools-task-alias',
  'output-style-force-for-plugin',
  'output-style-name-unique',
  'output-style-plugin-name-description',
]

// The agent rules of #9 that are `off` in `recommended`, in the order of the `modules` list.
// `strict` turns each on at `warn`.
const AGENT_OFF_RULES = [
  'agent-initial-prompt-main-only',
  'agent-mcp-servers-ref-exists',
  'agent-model-value',
  'agent-skills-exist',
  'agent-tools-agent-type-list',
  'agent-tools-skill-for-preload',
  'agent-body-nonempty',
  'agent-description-proactive',
  'agent-descriptions-budget',
  'agent-name-kebab-case',
  'agent-teammate-ignored-fields',
]

// The last five of the list above. They take every Markdown file, because the manifest key
// `agents` of a plugin can name an agent file outside `agents/`. The rule asks where the file sits.
const DESCRIPTION_RULES = AGENT_OFF_RULES.slice(-5)

// The hooks rules of layer 1 of #10, in the order of the `modules` list, with the blocks of each.
// A rule of the hooks config has one JSON block and one Markdown block. Each is an error.
const HOOKS_JSON = [...PROJECT_FILES, ...MANAGED_FILES, '**/hooks/hooks.json']
const HOOKS_MARKDOWN = ['**/SKILL.md', '**/agents/**/*.md']
// `strictOnly` marks a rule that is `off` in recommended and `warn` in strict.
const HOOKS_RULES: { name: string; blocks: string[][]; severity?: 'warn'; strictOnly?: true }[] = [
  {
    name: 'hooks-agent-stop-event',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-agent-type-experimental',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
  {
    name: 'hooks-async-on-blocking-event',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-broad-auto-approve',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-command-deprecated-cli-flag',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
  {
    name: 'hooks-command-path-variable',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  { name: 'hooks-command-removed-cli-flag', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  {
    name: 'hooks-command-shell-safety',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-committed-command-review',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  { name: 'hooks-config-schema', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  { name: 'hooks-disable-all-override', blocks: [['**/.claude/settings.json']], severity: 'warn' },
  { name: 'hooks-disabled-by-disableallhooks', blocks: [[...PROJECT_FILES, ...MANAGED_FILES]] },
  {
    name: 'hooks-duplicate-handler',
    blocks: [['**/hooks/hooks.json', '**/.claude-plugin/plugin.json']],
    severity: 'warn',
  },
  { name: 'hooks-env-var-unavailable', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  { name: 'hooks-exec-form-command-spaces', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  {
    name: 'hooks-exec-form-shell-syntax',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-exec-form-windows-shim',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-filechanged-star-matcher',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
  { name: 'hooks-handler-field-ignored', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  { name: 'hooks-handler-field-unknown', blocks: [HOOKS_JSON, HOOKS_MARKDOWN], severity: 'warn' },
  { name: 'hooks-handler-type-event-support', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  { name: 'hooks-http-env-allowlist', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  {
    name: 'hooks-http-literal-secret',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  { name: 'hooks-if-condition', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  {
    name: 'hooks-if-dir-glob-depth',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-matcher-bash-without-powershell',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
  {
    name: 'hooks-matcher-deprecated-value',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
  { name: 'hooks-matcher-enum', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  { name: 'hooks-matcher-legacy-version', blocks: [HOOKS_JSON, HOOKS_MARKDOWN], severity: 'warn' },
  { name: 'hooks-matcher-mcp-name', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  {
    name: 'hooks-matcher-name-unresolved',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  { name: 'hooks-matcher-never-matches', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  { name: 'hooks-matcher-subagent-anchor', blocks: [HOOKS_JSON, HOOKS_MARKDOWN], severity: 'warn' },
  { name: 'hooks-matcher-syntax', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  {
    name: 'hooks-matcher-unanchored-regex',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  { name: 'hooks-matcher-unsupported-event', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  {
    name: 'hooks-multiple-updatedinput',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-no-standalone-file',
    blocks: [
      [
        '**/.claude/hooks.json',
        '**/.claude/hooks/hooks.json',
        '**/.claude-plugin/hooks.json',
        '**/.claude-plugin/hooks/hooks.json',
      ],
    ],
  },
  {
    name: 'hooks-output-blocking-exit-code',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-output-deprecated-fields',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-output-schema',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-output-size',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  { name: 'hooks-placeholder-quoted', blocks: [HOOKS_JSON, HOOKS_MARKDOWN], severity: 'warn' },
  { name: 'hooks-powershell-placeholder', blocks: [HOOKS_JSON, HOOKS_MARKDOWN] },
  { name: 'hooks-prefer-exec-form', blocks: [HOOKS_JSON, HOOKS_MARKDOWN], severity: 'warn' },
  {
    name: 'hooks-prompt-on-permission-request',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
  {
    name: 'hooks-ps1-needs-powershell-shell',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
  {
    name: 'hooks-script-shebang',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-sessionend-default-timeout',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
  {
    name: 'hooks-sessionstart-static-context',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-stop-loop-guard',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-timeout-units',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
    strictOnly: true,
  },
  {
    name: 'hooks-worktree-create-without-remove',
    blocks: [HOOKS_JSON, HOOKS_MARKDOWN],
    severity: 'warn',
  },
]

// The skill rules of #8, in the order of the `modules` list. Each is an error.
const NEW_RULES = [
  'skill-frontmatter-position',
  'skill-frontmatter-schema',
  'skill-fork-fields-require-context',
  'skill-invocation-unreachable',
  'skill-reserved-name',
  'skill-plugin-vars-outside-plugin',
  'skill-inject-bang-position',
  'skill-allowed-tools-ineffective',
  'skill-allowed-tools-broad',
  'skill-plugin-root-shadowed',
  'skill-file-layout',
  'skill-reference-exists',
  'skill-agent-exists',
  'skill-name-unique',
  'skill-paths-glob-valid',
]

// The trees of the description rules. The repository has a `.git` entry, as a real one has. A rule
// reads the files of a scope up to the repository root and no further.
const wide = `Use proactively. ${'x'.repeat(30000)}`
const agentFile = (name: string, description: string, fields = '', body = 'Body.\n') =>
  `---\nname: ${name}\ndescription: ${description}\n${fields}---\n\n${body}`
const OK = agentFile('ok-agent', 'Reviews code. Use proactively.')
const BARE = agentFile('Bare_Agent', 'Reviews code.', '', '')
// The file in `agents/` that the manifest of the plugin `q` leaves out. It sets `permissionMode`,
// which `agent-plugin-ignored-fields` reports in a plugin agent, so a report would show that the
// rule still sees the file as an agent.
const UNLISTED = agentFile('Bare_Agent', 'Reviews code.', 'permissionMode: plan\n', '')
const TEAM_FIELDS = 'skills:\n  - lint\nmcpServers:\n  - github\nbackground: true\n'
const DESCRIPTION_TREE: Record<string, string> = {
  '.git/HEAD': 'ref: refs/heads/main\n',
  // Local agents: one that passes each rule, and one that breaks three.
  '.claude/agents/ok.md': OK,
  '.claude/agents/bare.md': BARE,
  // Agent teams are on here, so the three fields of `team.md` report. The agent `team-ok.md`
  // sets none of them. The folder `quiet` sets the fields, and no settings file there turns teams on.
  'packages/teams/.claude/settings.json': JSON.stringify({
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' },
  }),
  'packages/teams/.claude/agents/team.md': agentFile('team', 'Use proactively.', TEAM_FIELDS),
  'packages/teams/.claude/agents/team-ok.md': agentFile('team-ok', 'Use proactively.'),
  'packages/quiet/.claude/agents/quiet.md': agentFile('quiet', 'Use proactively.', TEAM_FIELDS),
  // Two agents of one scope are together over 15,000 tokens. The scope `small` is not.
  'packages/big/.claude/agents/one.md': agentFile('one', wide),
  'packages/big/.claude/agents/two.md': agentFile('two', wide),
  'packages/small/.claude/agents/one.md': agentFile('one', 'Use proactively.'),
  // A plugin with the default folder, and a plugin whose manifest names its agent files. The
  // manifest replaces `agents/`, so `agents/unlisted.md` is no agent.
  'plugins/p/.claude-plugin/plugin.json': JSON.stringify({ name: 'p' }),
  'plugins/p/agents/ok.md': OK,
  'plugins/p/agents/bare.md': BARE,
  'plugins/q/.claude-plugin/plugin.json': JSON.stringify({
    name: 'q',
    agents: ['./custom/ok.md', './custom/bare.md'],
  }),
  'plugins/q/custom/ok.md': OK,
  'plugins/q/custom/bare.md': BARE,
  'plugins/q/agents/unlisted.md': UNLISTED,
}

// The reports of the description rules over `DESCRIPTION_TREE`, in `strict` only. A file with a
// bare agent breaks the three rules of the next three lines.
const BARE_REPORTS = (file: string) => [
  `${file}: claude/agent-body-nonempty@1`,
  `${file}: claude/agent-description-proactive@1`,
  `${file}: claude/agent-name-kebab-case@1`,
]
const DESCRIPTION_REPORTS = [
  ...BARE_REPORTS('.claude/agents/bare.md'),
  ...BARE_REPORTS('plugins/p/agents/bare.md'),
  ...BARE_REPORTS('plugins/q/custom/bare.md'),
  ...['skills', 'mcpServers', 'background'].map(
    () => 'packages/teams/.claude/agents/team.md: claude/agent-teammate-ignored-fields@1',
  ),
  'packages/big/.claude/agents/one.md: claude/agent-descriptions-budget@1',
  'packages/big/.claude/agents/two.md: claude/agent-descriptions-budget@1',
]

// The warn skill rules of #50, layer 1, in the order of the `modules` list.
const WARN_SKILL_RULES = [
  'skill-boolean-literal',
  'skill-description-present',
  'skill-invocation-redundant-fields',
  'skill-metadata-reserved-keys',
  'skill-name-shadows-builtin',
  'skill-no-bom',
]

// The warn skill rules of #50, layer 2, in the order of the `modules` list.
const PLUGIN_SKILL_RULES = [
  'skill-argument-escape',
  'skill-max-lines',
  'skill-plugin-name-prefix',
  'skill-plugin-root-name',
  'skill-shell-platform',
]

// The `off` skill rules of #50, layers 3 and 4, in the order of the `modules` list. `strict` turns
// each on at `warn`. Each reads a `SKILL.md` and the command files, except the two that
// `OFF_FILES` names.
const SKILL_OFF_RULES = [
  'skill-body-token-budget',
  'skill-inject-robustness',
  'skill-listing-budget',
  'skill-literal-dollar',
  'skill-loop-reference-invocable',
  'skill-model-override',
  'skill-plugin-path-vars',
  'skill-precedence-shadowing',
  'skill-side-effects-manual-only',
]
const OFF_FILES: Record<string, string[]> = {
  'skill-loop-reference-invocable': ['**/.claude/loop.md'],
  'skill-plugin-path-vars': ['**/SKILL.md'],
}

// The hooks rules that are `off` in recommended. A rule with a Markdown target has two blocks.
const HOOKS_OFF_RULES = HOOKS_RULES.filter(({ strictOnly }) => strictOnly).flatMap(
  ({ name, blocks }) => blocks.map(() => name),
)

// The `off` rules of `strict`, in the order of its blocks.
const OFF_RULES = [
  ...HOOKS_OFF_RULES,
  ...SKILL_OFF_RULES,
  ...AGENT_OFF_RULES,
  ...MARKETPLACE_OFF_RULES,
  ...MARKET_SETTINGS_OFF_RULES,
  ...MEMORY_OFF_RULES,
  ...SETTINGS_OFF_RULES.map(({ name }) => name),
  // A rule with a Markdown target has two blocks, so it appears twice.
  ...MCP_OFF_RULES.flatMap(({ name, markdown }) => (markdown ? [name, name] : [name])),
  ...PLUGIN_OFF_RULES.map(({ name }) => name),
]

let root = ''
isolateGitConfig()
let descriptionRoot = ''
let maxBytesRoot = ''
let mcpSizeRoot = ''
let outputSizeRoot = ''
// A folder next to the tree, for the files that links in the tree lead to.
let external = ''

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-'))
  external = `${root}-external`
  for (const [file, content] of Object.entries(TREE)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
  }
  const repo = path.join(root, GIT_REPO)
  for (const [file, content] of Object.entries(GIT_TREE)) {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    writeFileSync(path.join(repo, file), content)
  }
  stage(repo, Object.keys(GIT_TREE), GIT_EXECUTABLE)
  const gu = path.join(root, GU_REPO)
  const writeGu = (files: Record<string, string>) => {
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(gu, file)), { recursive: true })
      writeFileSync(path.join(gu, file), content)
    }
  }
  writeGu(GU_TREE)
  stage(gu, Object.keys(GU_TREE))
  // `stage` adds each file on the disk, so the untracked files come after it.
  writeGu(GU_LOOSE)
  descriptionRoot = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-description-'))
  for (const [file, content] of Object.entries(DESCRIPTION_TREE)) {
    mkdirSync(path.dirname(path.join(descriptionRoot, file)), { recursive: true })
    writeFileSync(path.join(descriptionRoot, file), content)
  }
  maxBytesRoot = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-max-bytes-'))
  for (const [file, content] of Object.entries(MAX_BYTES_TREE)) {
    mkdirSync(path.dirname(path.join(maxBytesRoot, file)), { recursive: true })
    writeFileSync(path.join(maxBytesRoot, file), content)
  }
  mcpSizeRoot = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-mcp-size-'))
  for (const [file, content] of Object.entries(MCP_SIZE_TREE)) {
    mkdirSync(path.dirname(path.join(mcpSizeRoot, file)), { recursive: true })
    writeFileSync(path.join(mcpSizeRoot, file), content)
  }
  outputSizeRoot = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-output-size-'))
  for (const [file, content] of Object.entries(OUTPUT_SIZE_TREE)) {
    mkdirSync(path.dirname(path.join(outputSizeRoot, file)), { recursive: true })
    writeFileSync(path.join(outputSizeRoot, file), content)
  }
  if (LINKS) {
    mkdirSync(path.join(root, 'packages/s/site/plugins'), { recursive: true })
    symlinkSync('../../shared/p', path.join(root, 'packages/s/site/plugins/p'))
    // `rules-symlink-external-scoped`: rule files that are links out of the tree, a scoped one and
    // one with no scope. The file `.git` makes `packages/rx` a repository.
    mkdirSync(external, { recursive: true })
    writeFileSync(path.join(external, 'scoped.md'), SCOPED_RULE)
    writeFileSync(path.join(external, 'plain.md'), '# Rule\n')
    // `claude-md-symlink`: a CLAUDE.md that is a link to a file in its folder.
    symlinkSync('notes.md', path.join(root, 'packages/cs/CLAUDE.md'))
    for (const name of ['scoped', 'plain']) {
      symlinkSync(
        path.join(external, `${name}.md`),
        path.join(root, `packages/rx/.claude/rules/${name}.md`),
      )
    }
    symlinkSync('../../../shared/s.txt', path.join(root, 'packages/l/site/plugins/m/shared.txt'))
    symlinkSync('../m/own.txt', path.join(root, 'packages/l/site/plugins/n/sibling.txt'))
  }
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(descriptionRoot, { recursive: true, force: true })
  rmSync(maxBytesRoot, { recursive: true, force: true })
  rmSync(mcpSizeRoot, { recursive: true, force: true })
  rmSync(outputSizeRoot, { recursive: true, force: true })
  rmSync(external, { recursive: true, force: true })
})

/** Each report over the tree, as `file: rule@severity`, sorted. */
async function reports(config: Linter.Config[], base = root): Promise<string[]> {
  const eslint = new ESLint({ cwd: base, overrideConfigFile: true, overrideConfig: config })
  const results = await eslint.lintFiles(['.'])
  return results
    .flatMap((r) =>
      r.messages.map(
        (m) =>
          `${path.relative(base, r.filePath).split(path.sep).join('/')}: ${m.ruleId}@${m.severity}`,
      ),
    )
    .sort()
}

describe('configs', () => {
  it('names one block for each rule in recommended, at its severity', () => {
    expect(plugin.configs.recommended.map((c) => [c.name, c.rules])).toEqual([
      [
        'claude/recommended/skill-description-max-length',
        { 'claude/skill-description-max-length': 'warn' },
      ],
      ['claude/recommended/command-legacy-format', { 'claude/command-legacy-format': 'warn' }],
      ['claude/recommended/hooks-event-name-known', { 'claude/hooks-event-name-known': 'error' }],
      ['claude/recommended/hooks-event-name-known', { 'claude/hooks-event-name-known': 'error' }],
      ...HOOKS_RULES.filter(({ strictOnly }) => !strictOnly).flatMap(({ name, blocks, severity }) =>
        blocks.map(() => [
          `claude/recommended/${name}`,
          { [`claude/${name}`]: severity ?? 'error' },
        ]),
      ),
      ...NEW_RULES.map((rule) => [`claude/recommended/${rule}`, { [`claude/${rule}`]: 'error' }]),
      ...WARN_SKILL_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'warn' },
      ]),
      ...PLUGIN_SKILL_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'warn' },
      ]),
      ...AGENT_RULES.map((rule) => [`claude/recommended/${rule}`, { [`claude/${rule}`]: 'error' }]),
      ...AGENT_WARN_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'warn' },
      ]),
      ...TOOL_LIST_BLOCKS.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...MARKETPLACE_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...MARKETPLACE_WARN_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'warn' },
      ]),
      ...SETTINGS_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...SCOPE_RULES.map(({ name, severity = 'error' }) => [
        `claude/recommended/${name}`,
        { [`claude/${name}`]: severity },
      ]),
      ...UNTRACKED_RULES.map(({ name }) => [
        `claude/recommended/${name}`,
        { [`claude/${name}`]: 'warn' },
      ]),
      ...MARKET_SETTINGS_RULES.filter(({ severity }) => severity !== 'off').map(
        ({ name, severity }) => [`claude/recommended/${name}`, { [`claude/${name}`]: severity }],
      ),
      ...MEMORY_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...MEMORY_WARN_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'warn' },
      ]),
      ...MCP_RULES.flatMap(({ name, markdown, severity }) =>
        (markdown ? [name, name] : [name]).map((block) => [
          `claude/recommended/${block}`,
          { [`claude/${block}`]: severity ?? 'error' },
        ]),
      ),
      ...PLUGIN_RULES.map(({ name, severity = 'error' }) => [
        `claude/recommended/${name}`,
        { [`claude/${name}`]: severity },
      ]),
    ])
  })

  // `strict` keeps each rule of `recommended` at its severity, and adds each `off` rule at `warn`.
  it('gives strict the rules of recommended, and each off rule at warn', () => {
    const rulesOf = (config: Linter.Config[]) => config.map((c) => c.rules)
    const isOff = (rules: Linter.Config['rules']) =>
      OFF_RULES.some((rule) => rules?.[`claude/${rule}`] !== undefined)
    const strict = rulesOf(plugin.configs.strict)
    expect(strict.filter((rules) => !isOff(rules))).toEqual(rulesOf(plugin.configs.recommended))
    expect(strict.filter(isOff)).toEqual(OFF_RULES.map((rule) => ({ [`claude/${rule}`]: 'warn' })))
    expect(plugin.configs.strict.map((c) => c.name)).toEqual([
      'claude/strict/skill-description-max-length',
      'claude/strict/command-legacy-format',
      'claude/strict/hooks-event-name-known',
      'claude/strict/hooks-event-name-known',
      ...HOOKS_RULES.flatMap(({ name, blocks }) => blocks.map(() => `claude/strict/${name}`)),
      ...NEW_RULES.map((rule) => `claude/strict/${rule}`),
      ...WARN_SKILL_RULES.map((rule) => `claude/strict/${rule}`),
      ...PLUGIN_SKILL_RULES.map((rule) => `claude/strict/${rule}`),
      ...SKILL_OFF_RULES.map((rule) => `claude/strict/${rule}`),
      ...AGENT_RULES.map((rule) => `claude/strict/${rule}`),
      ...AGENT_WARN_RULES.map((rule) => `claude/strict/${rule}`),
      ...AGENT_OFF_RULES.map((rule) => `claude/strict/${rule}`),
      ...TOOL_LIST_BLOCKS.map((rule) => `claude/strict/${rule}`),
      ...MARKETPLACE_RULES.map((rule) => `claude/strict/${rule}`),
      ...MARKETPLACE_WARN_RULES.map((rule) => `claude/strict/${rule}`),
      ...MARKETPLACE_OFF_RULES.map((rule) => `claude/strict/${rule}`),
      ...SETTINGS_RULES.map((rule) => `claude/strict/${rule}`),
      ...SCOPE_RULES.map(({ name }) => `claude/strict/${name}`),
      ...UNTRACKED_RULES.map(({ name }) => `claude/strict/${name}`),
      ...MARKET_SETTINGS_RULES.map(({ name }) => `claude/strict/${name}`),
      ...MEMORY_RULES.map((rule) => `claude/strict/${rule}`),
      ...MEMORY_WARN_RULES.map((rule) => `claude/strict/${rule}`),
      ...MEMORY_OFF_RULES.map((rule) => `claude/strict/${rule}`),
      ...SETTINGS_OFF_RULES.map(({ name }) => `claude/strict/${name}`),
      ...MCP_RULES.flatMap(({ name, markdown }) =>
        (markdown ? [name, name] : [name]).map((block) => `claude/strict/${block}`),
      ),
      ...MCP_OFF_RULES.flatMap(({ name, markdown }) =>
        (markdown ? [name, name] : [name]).map((block) => `claude/strict/${block}`),
      ),
      ...PLUGIN_RULES.map(({ name }) => `claude/strict/${name}`),
      ...PLUGIN_OFF_RULES.map(({ name }) => `claude/strict/${name}`),
    ])
  })

  it('turns each off agent rule on in strict only, on the agent files', () => {
    for (const rule of AGENT_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${rule}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${rule}`)
      const files = DESCRIPTION_RULES.includes(rule) ? ['**/*.md'] : ['**/agents/**/*.md']
      expect(blocks.map((c) => [c.language, c.files])).toEqual([['markdown/gfm', files]])
    }
  })

  it('turns each off MCP rule on in strict only, on the files that it reads', () => {
    for (const { name, files, markdown } of MCP_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${name}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${name}`)
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        ['json/json', files],
        ...(markdown ? [['markdown/gfm', markdown]] : []),
      ])
    }
  })

  it('gives the team rule one Markdown block and one JSON block', () => {
    const blocks = plugin.configs.recommended.filter(
      (c) => c.name === 'claude/recommended/agent-teams-no-project-config',
    )
    expect(blocks.map((c) => [c.language, c.files])).toEqual([
      ['markdown/gfm', ['**/.claude/teams/**/*.md']],
      ['json/json', ['**/.claude/teams/**/*.json']],
    ])
  })

  it('gives each tool-list rule one JSON block and one Markdown block', () => {
    for (const rule of [...GRAMMAR_RULES, 'permissions-skill-rule'].filter(
      (r) => r !== SETTINGS_ONLY,
    )) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${rule}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        ['json/json', [...PROJECT_FILES, ...MANAGED_FILES]],
        ['markdown/gfm', ['**/SKILL.md', '**/commands/**/*.md']],
      ])
    }
  })

  it('gives the settings-only grammar rule one JSON block for the project and managed files', () => {
    const blocks = plugin.configs.recommended.filter(
      (c) => c.name === `claude/recommended/${SETTINGS_ONLY}`,
    )
    expect(blocks.map((c) => [c.language, c.files])).toEqual([
      ['json/json', [...PROJECT_FILES, ...MANAGED_FILES]],
    ])
  })

  it('gives each marketplace rule one JSON block for .claude-plugin/marketplace.json', () => {
    for (const rule of MARKETPLACE_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${rule}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        ['json/json', ['**/.claude-plugin/marketplace.json']],
      ])
    }
  })

  it('gives each marketplace warning one JSON block for its files', () => {
    for (const rule of MARKETPLACE_WARN_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${rule}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        [
          'json/json',
          [rule === LOCATION_RULE ? '**/marketplace.json' : '**/.claude-plugin/marketplace.json'],
        ],
      ])
    }
  })

  it('reports a feature above the option minVersion of the version rule only', async () => {
    const withOption: Linter.Config = {
      files: ['**/.claude-plugin/marketplace.json'],
      rules: { 'claude/marketplace-min-version': ['warn', { minVersion: '2.1.0' }] },
    }
    const found = (await reports([...plugin.configs.recommended, withOption])).filter((line) =>
      line.includes('marketplace-min-version'),
    )
    // The `archive` source, the `command` source and the `headersHelper` of the bad marketplace,
    // the `archive` source and the `headers` of the credential marketplace, and the `command`
    // source of the marketplace in `packages/nai`.
    expect(found).toEqual([
      ...Array(3).fill('.claude-plugin/marketplace.json: claude/marketplace-min-version@1'),
      ...Array(2).fill(
        'packages/hc/.claude-plugin/marketplace.json: claude/marketplace-min-version@1',
      ),
      'packages/nai/.claude-plugin/marketplace.json: claude/marketplace-min-version@1',
    ])
  }, 30_000)

  it('turns each off marketplace rule on in strict only, on the files that it reads', () => {
    for (const rule of MARKETPLACE_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${rule}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${rule}`)
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        [
          'json/json',
          rule === CREDENTIAL_RULE
            ? ['**/.claude-plugin/marketplace.json', ...PROJECT_FILES]
            : ['**/.claude-plugin/marketplace.json'],
        ],
      ])
    }
  })

  it('turns each off skill rule on in strict only, on the files that it reads', () => {
    for (const rule of SKILL_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${rule}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${rule}`)
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        ['markdown/gfm', OFF_FILES[rule] ?? ['**/SKILL.md', '**/commands/**/*.md']],
      ])
    }
  })

  it('gives each settings rule one JSON block for the two project settings files', () => {
    for (const rule of SETTINGS_RULES.filter((r) => r !== CONFLICT_RULE)) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${rule}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        ['json/json', ['**/.claude/settings.json', '**/.claude/settings.local.json']],
      ])
    }
  })

  it('gives the conflict rule one JSON block for the project and managed files', () => {
    const blocks = plugin.configs.recommended.filter(
      (c) => c.name === `claude/recommended/${CONFLICT_RULE}`,
    )
    expect(blocks.map((c) => [c.language, c.files])).toEqual([
      ['json/json', [...PROJECT_FILES, ...MANAGED_FILES]],
    ])
  })

  it('gives each marketplace settings rule of K3 one JSON block for its files', () => {
    for (const { name, files, severity } of MARKET_SETTINGS_RULES) {
      // The `off` rule is in `strict` only.
      const config = severity === 'off' ? plugin.configs.strict : plugin.configs.recommended
      const prefix = severity === 'off' ? 'strict' : 'recommended'
      const blocks = config.filter((c) => c.name === `claude/${prefix}/${name}`)
      expect(blocks.map((c) => [c.language, c.files])).toEqual([['json/json', files]])
    }
  })

  it('turns each off marketplace settings rule on in strict only', () => {
    expect(MARKET_SETTINGS_OFF_RULES).toEqual(['settings-enabled-plugins-marketplace-declared'])
    for (const rule of MARKET_SETTINGS_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${rule}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${rule}`)
      expect(blocks.map((c) => c.rules)).toEqual([{ [`claude/${rule}`]: 'warn' }])
    }
  })

  it('gives each hooks rule a JSON block, and a Markdown block for the config rules', () => {
    for (const { name, blocks, strictOnly } of HOOKS_RULES) {
      const found = (strictOnly ? plugin.configs.strict : plugin.configs.recommended).filter(
        (c) => c.name === `claude/${strictOnly ? 'strict' : 'recommended'}/${name}`,
      )
      expect(found.map((c) => c.files)).toEqual(blocks)
      expect(found.map((c) => c.language)).toEqual(
        blocks.map((_, i) => (i === 0 ? 'json/json' : 'markdown/gfm')),
      )
    }
  })

  it('gives hooks-event-name-known a JSON block that adds plugin.json, and a Markdown block', () => {
    const found = plugin.configs.recommended.filter(
      (c) => c.name === 'claude/recommended/hooks-event-name-known',
    )
    expect(found.map((c) => [c.language, c.files])).toEqual([
      ['json/json', [...HOOKS_JSON, '**/.claude-plugin/plugin.json']],
      ['markdown/gfm', HOOKS_MARKDOWN],
    ])
  })

  it('gives each rule of the scope layer one JSON block for its files', () => {
    for (const { name, files } of SCOPE_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${name}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([['json/json', files]])
    }
  })

  it('gives each rule that asks git one block with its language and files', () => {
    for (const { name, language, files } of UNTRACKED_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${name}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([[language, files]])
    }
  })

  it('gives each rule of the plugin layout layer one block for its files', () => {
    for (const { name, files, language = 'json/json' } of PLUGIN_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${name}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([[language, files]])
    }
  })

  it('gives each MCP rule one JSON block for its files, and one Markdown block if it has a second target', () => {
    for (const { name, files, markdown, language } of MCP_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${name}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        [language ?? 'json/json', files],
        ...(markdown ? [['markdown/gfm', markdown]] : []),
      ])
    }
  })

  // The run starts a `git` process for each file that a git rule reads, so it needs more than the
  // default time on a busy machine.
  // The tree holds files of 4 MiB for the size rule, so these two runs need more than 5 seconds
  // on a busy machine.
  it('gives each rule of the memory layer one block for its own language and files', () => {
    const blocks = (rule: string) =>
      plugin.configs.recommended
        .filter((c) => c.name === `claude/recommended/${rule}`)
        .map((c) => [c.language, c.files])
    expect(blocks('claude-md-agents-md-shadowed')).toEqual([['markdown/gfm', ['**/AGENTS.md']]])
    expect(blocks('claude-md-agents-md-variant')).toEqual([
      ['markdown/gfm', ['**/AGENTS.local.md', '**/AGENTS.override.md', '**/.agents/**/*.md']],
    ])
    expect(blocks('claude-md-excludes-pattern')).toEqual([
      ['json/json', [...PROJECT_FILES, ...MANAGED_FILES]],
    ])
    expect(blocks('claude-md-import-exists')).toEqual([
      ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/AGENTS.md']],
    ])
    expect(blocks('claude-md-import-max-depth')).toEqual([
      ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/AGENTS.md']],
    ])
    expect(blocks('claude-md-max-bytes')).toEqual([
      ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md']],
    ])
    expect(blocks('memory-settings-schema')).toEqual([
      ['json/json', [...PROJECT_FILES, ...MANAGED_FILES]],
    ])
    // The tree has no report for this rule. ESLint stops with an error at a link that leads
    // nowhere, as a link to a network path does here, before any rule runs.
    expect(blocks('memory-symlink-network-target')).toEqual([
      ['markdown/gfm', ['**/CLAUDE.md', '**/.claude/rules/**/*.md']],
    ])
    for (const rule of ['rules-frontmatter-schema', 'rules-paths-glob-valid']) {
      expect(blocks(rule)).toEqual([['markdown/gfm', ['**/.claude/rules/**/*.md']]])
    }
    expect(blocks('rules-symlink-external-scoped')).toEqual([
      ['markdown/gfm', ['**/.claude/rules/**/*.md']],
    ])
    expect(blocks('claude-md-import-external')).toEqual([['markdown/gfm', ['**/CLAUDE.md']]])
    expect(blocks('claude-md-max-lines')).toEqual([
      ['markdown/gfm', ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/AGENTS.md']],
    ])
    expect(blocks('claude-md-symlink')).toEqual([['markdown/gfm', ['**/CLAUDE.md']]])
    expect(blocks('memory-auto-memory-directory-committed')).toEqual([['json/json', PROJECT_FILES]])
    expect(blocks('memory-index-max-size')).toEqual([
      ['markdown/gfm', ['**/.claude/agent-memory/*/MEMORY.md']],
    ])
    for (const rule of ['rules-max-lines', 'rules-symlink-external']) {
      expect(blocks(rule)).toEqual([['markdown/gfm', ['**/.claude/rules/**/*.md']]])
    }
    expect(blocks('rules-md-extension')).toEqual([
      ['markdown/gfm', ['**/.claude/rules/**/*.*', '**/.claude/rules/**/!(*.*)']],
    ])
  })

  it('turns each off memory rule on in strict only, on the files that it reads', () => {
    for (const rule of MEMORY_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${rule}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${rule}`)
      expect(blocks.map((c) => [c.language, c.files])).toEqual([MEMORY_OFF_BLOCKS[rule]])
    }
  })

  it('turns each off settings rule on in strict only, on the files that it reads', () => {
    for (const { name, files } of SETTINGS_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${name}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${name}`)
      expect(blocks.map((c) => [c.language, c.files])).toEqual([['json/json', files]])
    }
  })

  it('turns each off plugin rule on in strict only, on the files that it reads', () => {
    for (const { name, files } of PLUGIN_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${name}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${name}`)
      expect(blocks.map((c) => [c.language, c.files])).toEqual([['json/json', files]])
    }
  })

  it('recommended reports each rule on its own files, at its own severity', async () => {
    expect(await reports(plugin.configs.recommended)).toEqual(EXPECTED)
  }, 30_000)

  it('reports the version rules on their files once minVersion is set', async () => {
    const options = ['warn', { minVersion: '2.1.0' }]
    const config = [
      ...plugin.configs.recommended,
      {
        files: ['**/agents/**/*.md'],
        rules: { 'claude/agent-no-bom': options, 'claude/agent-field-min-version': options },
      },
    ] as Linter.Config[]
    const found = (await reports(config)).filter((report) => !EXPECTED.includes(report))
    expect(found).toEqual([
      '.claude/agents/bom.md: claude/agent-no-bom@1',
      // The alias `manual` needs a newer Claude Code than the `minVersion` of this test.
      '.claude/agents/manual.md: claude/agent-field-min-version@1',
      '.claude/agents/review/deep/deep-manual.md: claude/agent-field-min-version@1',
      '.claude/agents/versions.md: claude/agent-field-min-version@1',
      'packages/z/.claude/agents/boss.md: claude/agent-field-min-version@1',
      'plugins/p/agents/bom.md: claude/agent-no-bom@1',
      'plugins/p/agents/versions.md: claude/agent-field-min-version@1',
    ])
  }, 30_000)

  // The five description rules take every Markdown file and every agent file of the tree reports
  // for most of them, so `DESCRIPTION_TREE` tests them. This run leaves their reports out.
  it('strict reports the files of recommended, and those of the off rules', async () => {
    const isDescription = (report: string) =>
      DESCRIPTION_RULES.some((rule) => report.includes(`: claude/${rule}@`))
    const all = await reports(plugin.configs.strict)
    expect(all.filter((report) => !isDescription(report))).toEqual(
      [...EXPECTED, ...STRICT_ONLY].sort(),
    )
    // The glob of these rules is `**/*.md`. The tree holds skills, commands, a plugin skill and
    // `docs/agents/*.md`, which are no agent files. Each report must be on an agent file.
    const own = all.filter(isDescription)
    expect(own.length).toBeGreaterThan(0)
    for (const report of own) {
      expect(report).toMatch(
        /^(?:packages\/[\w/]+\/)?\.claude\/agents\/|^plugins\/(?:p|ts|bare|sen)\/agents\//,
      )
    }
  }, 30_000)

  it('strict reports the description rules on a tree of its own, and recommended does not', async () => {
    const blocks = plugin.configs.strict.filter((c) =>
      DESCRIPTION_RULES.some((rule) => c.name === `claude/strict/${rule}`),
    )
    expect(blocks).toHaveLength(DESCRIPTION_RULES.length)
    expect(await reports(blocks, descriptionRoot)).toEqual([...DESCRIPTION_REPORTS].sort())
    // The manifest of `q` replaces `agents/`, so the rules of A1 to A3 are silent on `unlisted.md`
    // too: `agent-plugin-ignored-fields` would report its `permissionMode` in a plugin agent.
    // The manifest of `q` also replaces `agents/`, so `plugin-default-dir-shadowed` reports it.
    expect(await reports(plugin.configs.recommended, descriptionRoot)).toEqual([
      'plugins/p/.claude-plugin/plugin.json: claude/plugin-manifest-publish-metadata@1',
      'plugins/q/.claude-plugin/plugin.json: claude/plugin-default-dir-shadowed@2',
      'plugins/q/.claude-plugin/plugin.json: claude/plugin-manifest-publish-metadata@1',
    ])
  }, 30_000)
  it('reports the max-bytes rule on the files that it reads, on a tree of its own', async () => {
    // The override sets a small `max` and keeps the severity of the preset.
    const withLimit = (preset: Linter.Config[]) =>
      [
        ...preset,
        {
          files: ['**/CLAUDE.md', '**/CLAUDE.local.md'],
          rules: { 'claude/claude-md-max-bytes': ['error', { max: MAX_BYTES_LIMIT }] },
        },
      ] as Linter.Config[]
    expect(await reports(withLimit(plugin.configs.recommended), maxBytesRoot)).toEqual(
      MAX_BYTES_REPORTS,
    )
    expect(await reports(withLimit(plugin.configs.strict), maxBytesRoot)).toEqual(MAX_BYTES_REPORTS)
  }, 30_000)
  it('reports the .mcp.json size rule on a tree of its own', async () => {
    // The override sets a small `max` and keeps the severity of the preset.
    const config = [
      ...plugin.configs.recommended,
      {
        files: ['**/.mcp.json'],
        rules: { 'claude/mcp-json-file-size': ['error', { max: MCP_SIZE_LIMIT }] },
      },
    ] as Linter.Config[]
    expect(await reports(config, mcpSizeRoot)).toEqual([
      'packages/mbig/.mcp.json: claude/mcp-json-file-size@2',
    ])
  }, 30_000)
  it('reports the hooks output size rule on a tree of its own, in strict only', async () => {
    // The rule is `off` in recommended. The override sets a small limit and the severity of strict.
    const withLimit = (preset: Linter.Config[]) =>
      [
        ...preset,
        {
          files: ['**/.claude/settings.json'],
          rules: { 'claude/hooks-output-size': ['warn', { maxOutputChars: OUTPUT_SIZE_LIMIT }] },
        },
      ] as Linter.Config[]
    expect(await reports(plugin.configs.recommended, outputSizeRoot)).toEqual([])
    expect(await reports(withLimit(plugin.configs.strict), outputSizeRoot)).toEqual([
      'packages/osz/.claude/settings.json: claude/hooks-committed-command-review@1',
      'packages/osz/.claude/settings.json: claude/hooks-output-size@1',
    ])
  }, 30_000)
  it('reports the two option rules on their own files once an option turns them on', async () => {
    const shell = '---\ndescription: d\nshell: bash\n---\n\n!`date`\n'
    const files: Record<string, string> = {
      '.claude/skills/s/SKILL.md': shell,
      '.claude/commands/c.md': shell,
      'notes/x.md': shell,
      'plugins/p/.claude-plugin/plugin.json': '{"name": "p"}',
      'plugins/p/skills/prefixed/SKILL.md': '---\nname: p:prefixed\ndescription: d\n---\n',
      'plugins/p/commands/c.md': '---\nname: p:c\ndescription: d\n---\n',
    }
    // The options go into the shipped blocks, so each rule keeps its own `files`.
    const OPTIONS: Record<string, object> = {
      'claude/skill-shell-platform': { platforms: ['windows-no-git-bash'] },
      'claude/skill-plugin-name-prefix': { minVersion: '2.1.230' },
    }
    const dir = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-'))
    try {
      for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
        writeFileSync(path.join(dir, file), content)
      }
      const eslint = new ESLint({
        cwd: dir,
        overrideConfigFile: true,
        overrideConfig: [
          ...plugin.configs.recommended.map((block): Linter.Config => {
            const rules: Linter.RulesRecord = {}
            for (const [id, level] of Object.entries(block.rules ?? {})) {
              const given = OPTIONS[id]
              rules[id] = given
                ? [level as Linter.RuleSeverity, given]
                : (level as Linter.RuleEntry)
            }
            return { ...block, rules }
          }),
        ],
      })
      const results = await eslint.lintFiles(['.'])
      const found = results
        .flatMap((r) =>
          r.messages
            .filter(
              (m) =>
                m.ruleId === 'claude/skill-shell-platform' ||
                m.ruleId === 'claude/skill-plugin-name-prefix',
            )
            .map((m) => `${path.relative(dir, r.filePath).split(path.sep).join('/')}: ${m.ruleId}`),
        )
        .sort()
      expect(found).toEqual([
        '.claude/commands/c.md: claude/skill-shell-platform',
        '.claude/skills/s/SKILL.md: claude/skill-shell-platform',
        'plugins/p/skills/prefixed/SKILL.md: claude/skill-plugin-name-prefix',
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30_000)

  it('reports the two budget rules on their own files once an option sets a small limit', async () => {
    const skill = '---\ndescription: d\n---\n\nfive!\n'
    const files: Record<string, string> = {
      '.claude/skills/s/SKILL.md': skill,
      '.claude/commands/c.md': skill,
      'notes/x.md': skill,
      'plugins/p/.claude-plugin/plugin.json': '{"name": "p"}',
      'plugins/p/skills/s/SKILL.md': skill,
    }
    // The options go into the shipped `strict` blocks, so each rule keeps its own `files`.
    const OPTIONS: Record<string, object> = {
      'claude/skill-listing-budget': { max: 1 },
      'claude/skill-body-token-budget': { max: 1 },
    }
    const dir = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-'))
    try {
      for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
        writeFileSync(path.join(dir, file), content)
      }
      const eslint = new ESLint({
        cwd: dir,
        overrideConfigFile: true,
        overrideConfig: plugin.configs.strict.map((block): Linter.Config => {
          const rules: Linter.RulesRecord = {}
          for (const [id, level] of Object.entries(block.rules ?? {})) {
            const given = OPTIONS[id]
            rules[id] = given ? [level as Linter.RuleSeverity, given] : (level as Linter.RuleEntry)
          }
          return { ...block, rules }
        }),
      })
      const results = await eslint.lintFiles(['.'])
      const found = results
        .flatMap((r) =>
          r.messages
            .filter((m) => Object.keys(OPTIONS).includes(m.ruleId ?? ''))
            .map((m) => `${path.relative(dir, r.filePath).split(path.sep).join('/')}: ${m.ruleId}`),
        )
        .sort()
      expect(found).toEqual([
        '.claude/commands/c.md: claude/skill-body-token-budget',
        '.claude/commands/c.md: claude/skill-listing-budget',
        '.claude/skills/s/SKILL.md: claude/skill-body-token-budget',
        '.claude/skills/s/SKILL.md: claude/skill-listing-budget',
        'plugins/p/skills/s/SKILL.md: claude/skill-body-token-budget',
        'plugins/p/skills/s/SKILL.md: claude/skill-listing-budget',
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports the precedence rule on the project folder once an option names a skill', async () => {
    const skill = '---\ndescription: d\n---\n'
    const files: Record<string, string> = {
      '.claude/skills/deploy/SKILL.md': skill,
      '.claude/skills/other/SKILL.md': skill,
      '.claude/commands/ship.md': skill,
      'packages/web/.claude/skills/deploy/SKILL.md': skill,
      'plugins/p/.claude-plugin/plugin.json': '{"name": "p"}',
      'plugins/p/skills/deploy/SKILL.md': skill,
      'notes/deploy.md': skill,
    }
    // The option goes into the shipped `strict` block, so the rule keeps its own `files`.
    const rule = 'claude/skill-precedence-shadowing'
    const dir = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-'))
    try {
      // The project folder is the `.claude/` folder in the root of the repository.
      mkdirSync(path.join(dir, '.git'))
      for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
        writeFileSync(path.join(dir, file), content)
      }
      const eslint = new ESLint({
        cwd: dir,
        overrideConfigFile: true,
        overrideConfig: plugin.configs.strict.map((block): Linter.Config => {
          const level = block.rules?.[rule]
          return level === undefined
            ? block
            : {
                ...block,
                rules: {
                  [rule]: [level as Linter.RuleSeverity, { personalNames: ['deploy', 'ship'] }],
                },
              }
        }),
      })
      const results = await eslint.lintFiles(['.'])
      const found = results
        .flatMap((r) =>
          r.messages
            .filter((m) => m.ruleId === rule)
            .map((m) => `${path.relative(dir, r.filePath).split(path.sep).join('/')}: ${m.ruleId}`),
        )
        .sort()
      expect(found).toEqual([
        `.claude/commands/ship.md: ${rule}`,
        `.claude/skills/deploy/SKILL.md: ${rule}`,
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30_000)
})
