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

const long = 'a'.repeat(1537)
// The plugin variables, escaped so that the template literal keeps them as text.
const pluginRoot = `\${CLAUDE_PLUGIN_ROOT}`
const pluginData = `\${CLAUDE_PLUGIN_DATA}`
const badHooks = JSON.stringify({ hooks: { preToolUse: [] } })
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

// One entry with a `command` source and a `version`, a `headersHelper` that starts with a
// relative path, and `hooks` as a path, under a reserved name with no `owner`. A second entry has
// a `github` source with a bad `repo`, and a third has a relative `source` with no `./`. A fourth
// entry is named `renamed`, and its source `plugins/p` has a `plugin.json` that is named `p`. A
// fifth entry has a relative `source` to a directory that is not there. A sixth entry sets a
// `version` that `plugins/m/.claude-plugin/plugin.json` sets too, and an `mcpServers`. A seventh
// entry sets `strict` to `false` and `skills`, and its source has a `plugin.json`. An eighth entry
// sets `hooks` for `Stop`, and its `plugin.json` does too. A ninth entry has the marketplace root as
// its `source`, and lists one of the two skills under `skills/`. A tenth entry
// sets a `commands` path with `..`.
const badMarketplace = JSON.stringify({
  name: 'claude-code-plugins',
  plugins: [
    {
      name: 'a',
      source: { source: 'command', command: 'my-tool claude-plugin-path' },
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

// One string value of 2 MiB makes a file over the limit of the size rule.
const big = JSON.stringify({ a: 'x'.repeat(2097152) })

// One byte over the 4 MiB that Claude Code loads from a CLAUDE.md file. An HTML comment is
// the cheapest text for the Markdown parser.
// A rule file that sets a scope.
const SCOPED_RULE = '---\npaths:\n  - "src/**/*.ts"\n---\n# Rule\n'
// A file of 201 lines, one over the limit of the line rules.
const LONG = 'x\n'.repeat(201)
const bigMarkdown = `<!--${'x'.repeat(4194305 - 7)}-->`

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
  // One bad marketplace file with each fault of the marketplace rules, one in a
  // nested directory, and the same content where no rule reads it.
  '.claude-plugin/marketplace.json': badMarketplace,
  'packages/m/.claude-plugin/marketplace.json': JSON.stringify({
    name: 'inline',
    owner: { name: 'm' },
    plugins: [],
  }),
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
  // The CLAUDE.md, rules and memory rules of #13. `claude-md-max-bytes`: a CLAUDE.md file over
  // 4 MiB in each place that Claude Code reads one. The same text where it reads none: a Markdown
  // file with a near name, `AGENTS.md`, and a rule file (a size rule for rules is not this one).
  'packages/mb/CLAUDE.md': bigMarkdown,
  'packages/mb/.claude/CLAUDE.md': bigMarkdown,
  'packages/mb/CLAUDE.local.md': bigMarkdown,
  'packages/mb/docs/CLAUDE-notes.md': bigMarkdown,
  'packages/mb/AGENTS.md': bigMarkdown,
  'packages/mb/.claude/rules/CLAUDE.md': bigMarkdown,
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
  'packages/ex/.claude/settings.json': '{"claudeMdExcludes": ["packages/web/**"]}',
  'packages/ex/.claude/settings.local.json': '{"claudeMdExcludes": ["*/CLAUDE.md", "**/ok/**"]}',
  'packages/ex/managed-settings.json': '{"claudeMdExcludes": ["a/**"]}',
  'packages/ex/managed-settings.d/10-a.json': '{"claudeMdExcludes": ["b/**"]}',
  'packages/ex/managed-settings.d/.20-hidden.json': '{"claudeMdExcludes": ["c/**"]}',
  'packages/ex/managed-settings.d/30-b.txt': '{"claudeMdExcludes": ["d/**"]}',
  'packages/ex/managed-settings.d/sub/40-c.json': '{"claudeMdExcludes": ["e/**"]}',
  'packages/ex/.vscode/settings.json': '{"claudeMdExcludes": ["f/**"]}',
  'packages/ex/ok/.claude/settings.json': '{"claudeMdExcludes": ["**/web/**", "/abs/CLAUDE.md"]}',
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
}

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
const SCOPE_RULES = [
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
]

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
  'packages/x/.claude/settings.json: claude/hooks-event-name-known@2',
  'packages/x/.claude/settings.local.json: claude/hooks-event-name-known@2',
  'packages/x/.claude/teams/x.md: claude/agent-teams-no-project-config@2',
  'plugins/p/.claude-plugin/plugin.json: claude/hooks-event-name-known@2',
  'plugins/p/SKILL.md: claude/skill-plugin-root-shadowed@2',
  'plugins/p/agents/ignored.md: claude/agent-plugin-ignored-fields@2',
  'plugins/p/agents/schema.md: claude/agent-frontmatter-schema@2',
  'plugins/p/agents/sub/n.md: claude/agent-plugin-ignored-fields@2',
  'plugins/p/commands/c.md: claude/command-legacy-format@1',
  'plugins/p/hooks/hooks.json: claude/hooks-event-name-known@2',
  'plugins/p/skills/s/SKILL.md: claude/skill-description-max-length@1',
  // The marketplace rules read `.claude-plugin/marketplace.json` only.
  ...MARKETPLACE_RULES.filter((rule) => rule !== ESCAPE_RULE).map(
    (rule) => `.claude-plugin/marketplace.json: claude/${rule}@2`,
  ),
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
  // `settings-plugin-suggestion-marketplaces-source` reads the merged source. A drop-in with a
  // `strictKnownMarketplaces` entry declares the name for the whole source.
  'packages/ps/managed-settings.json: claude/settings-plugin-suggestion-marketplaces-source@2',
  'packages/ps/managed-settings.d/10-a.json: claude/settings-plugin-suggestion-marketplaces-source@2',
  'packages/ps/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
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
  // `claude-md-agents-md-variant` reads the two variant names and Markdown below `.agents/`.
  'packages/av/AGENTS.local.md: claude/claude-md-agents-md-variant@2',
  'packages/av/AGENTS.override.md: claude/claude-md-agents-md-variant@2',
  'packages/av/.agents/notes.md: claude/claude-md-agents-md-variant@2',
  'packages/av/.agents/skills/x/SKILL.md: claude/claude-md-agents-md-variant@2',
  // `claude-md-agents-md-shadowed` reads AGENTS.md and .claude/AGENTS.md, and no other file.
  'packages/sh/AGENTS.md: claude/claude-md-agents-md-shadowed@2',
  'packages/sh/.claude/AGENTS.md: claude/claude-md-agents-md-shadowed@2',
  'packages/mb/AGENTS.md: claude/claude-md-agents-md-shadowed@2',
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
  'packages/ex/.claude/settings.json: claude/claude-md-excludes-pattern@2',
  'packages/ex/.claude/settings.local.json: claude/claude-md-excludes-pattern@2',
  'packages/ex/managed-settings.json: claude/claude-md-excludes-pattern@2',
  'packages/ex/managed-settings.d/10-a.json: claude/claude-md-excludes-pattern@2',
  'packages/ex/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
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
  'packages/ms/.claude/settings.local.json: claude/memory-settings-schema@2',
  'packages/ms/managed-settings.json: claude/memory-settings-schema@2',
  'packages/ms/managed-settings.d/10-a.json: claude/memory-settings-schema@2',
  'packages/ms/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `claude-md-max-bytes` reads CLAUDE.md and CLAUDE.local.md, and no other file.
  'packages/mb/CLAUDE.md: claude/claude-md-max-bytes@2',
  'packages/mb/.claude/CLAUDE.md: claude/claude-md-max-bytes@2',
  'packages/mb/CLAUDE.local.md: claude/claude-md-max-bytes@2',
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
].sort()

// The reports of the `off` rules of #13. They appear in `strict` only, at `warn`.
const STRICT_ONLY = [
  // `claude-md-import-in-code-span` reads CLAUDE.md, CLAUDE.local.md and AGENTS.md, and no other file.
  // `claude-md-agents-md-prose-pointer` reads CLAUDE.md files, and no other file.
  'packages/pp/CLAUDE.md: claude/claude-md-agents-md-prose-pointer@1',
  'packages/pp/.claude/CLAUDE.md: claude/claude-md-agents-md-prose-pointer@1',
  // `claude-md-excludes-absolute-committed` reads the committed project file, and no other file.
  'packages/ea/.claude/settings.json: claude/claude-md-excludes-absolute-committed@1',
  'packages/ex/ok/.claude/settings.json: claude/claude-md-excludes-absolute-committed@1',
  // `memory-agent-memory-orphan` reads the `MEMORY.md` index, and no other file.
  'packages/ao/.claude/agent-memory/lone/MEMORY.md: claude/memory-agent-memory-orphan@1',
  // `rules-paths-no-match` reads the rule files, and no other file.
  'packages/pn/.claude/rules/miss.md: claude/rules-paths-no-match@1',
  // `claude-md-location` reads every Markdown file, and reports the two places and names.
  'packages/lo/.claude/CLAUDE.local.md: claude/claude-md-location@1',
  'packages/lo/web/claude.md: claude/claude-md-location@1',
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

let root = ''
// A folder next to the tree, for the files that links in the tree lead to.
let external = ''

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-'))
  external = `${root}-external`
  for (const [file, content] of Object.entries(TREE)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
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
  }
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(external, { recursive: true, force: true })
})

/** Each report over the tree, as `file: rule@severity`, sorted. */
async function reports(config: Linter.Config[]): Promise<string[]> {
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: config })
  const results = await eslint.lintFiles(['.'])
  return results
    .flatMap((r) =>
      r.messages.map(
        (m) =>
          `${path.relative(root, r.filePath).split(path.sep).join('/')}: ${m.ruleId}@${m.severity}`,
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
      ...NEW_RULES.map((rule) => [`claude/recommended/${rule}`, { [`claude/${rule}`]: 'error' }]),
      ...AGENT_RULES.map((rule) => [`claude/recommended/${rule}`, { [`claude/${rule}`]: 'error' }]),
      ...TOOL_LIST_BLOCKS.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...MARKETPLACE_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...SETTINGS_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...SCOPE_RULES.map(({ name }) => [
        `claude/recommended/${name}`,
        { [`claude/${name}`]: 'error' },
      ]),
      ...MEMORY_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...MEMORY_WARN_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'warn' },
      ]),
    ])
  })

  // `strict` keeps each rule of `recommended` at its severity, and adds each `off` rule at `warn`.
  it('gives strict the rules of recommended, and each off rule at warn', () => {
    const rulesOf = (config: Linter.Config[]) => config.map((c) => c.rules)
    const isOff = (rules: Linter.Config['rules']) =>
      MEMORY_OFF_RULES.some((rule) => rules?.[`claude/${rule}`] !== undefined)
    const strict = rulesOf(plugin.configs.strict)
    expect(strict.filter((rules) => !isOff(rules))).toEqual(rulesOf(plugin.configs.recommended))
    expect(strict.filter(isOff)).toEqual(
      MEMORY_OFF_RULES.map((rule) => ({ [`claude/${rule}`]: 'warn' })),
    )
    expect(plugin.configs.strict.map((c) => c.name)).toEqual([
      'claude/strict/skill-description-max-length',
      'claude/strict/command-legacy-format',
      'claude/strict/hooks-event-name-known',
      ...NEW_RULES.map((rule) => `claude/strict/${rule}`),
      ...AGENT_RULES.map((rule) => `claude/strict/${rule}`),
      ...TOOL_LIST_BLOCKS.map((rule) => `claude/strict/${rule}`),
      ...MARKETPLACE_RULES.map((rule) => `claude/strict/${rule}`),
      ...SETTINGS_RULES.map((rule) => `claude/strict/${rule}`),
      ...SCOPE_RULES.map(({ name }) => `claude/strict/${name}`),
      ...MEMORY_RULES.map((rule) => `claude/strict/${rule}`),
      ...MEMORY_WARN_RULES.map((rule) => `claude/strict/${rule}`),
      ...MEMORY_OFF_RULES.map((rule) => `claude/strict/${rule}`),
    ])
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

  it('gives each settings rule one JSON block for the two project settings files', () => {
    for (const rule of SETTINGS_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${rule}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        ['json/json', ['**/.claude/settings.json', '**/.claude/settings.local.json']],
      ])
    }
  })

  it('gives each rule of the scope layer one JSON block for its files', () => {
    for (const { name, files } of SCOPE_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${name}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([['json/json', files]])
    }
  })

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

  it('recommended reports each rule on its own files, at its own severity', async () => {
    expect(await reports(plugin.configs.recommended)).toEqual(EXPECTED)
  }, 60000)

  it('strict reports the files of recommended, and those of the off rules', async () => {
    expect(await reports(plugin.configs.strict)).toEqual([...EXPECTED, ...STRICT_ONLY].sort())
  }, 60000)
})
