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
const big = JSON.stringify({ language: 'x'.repeat(2097152) })

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
  'packages/ad/.claude/settings.json': '{"includeCoAuthoredBy": false}',
  'packages/ad/.claude/settings.local.json': '{"voiceEnabled": true}',
  'packages/ad/managed-settings.json': '{"disableArtifact": true}',
  'packages/ad/managed-settings.d/10-a.json': '{"includeCoAuthoredBy": true}',
  'packages/ad/managed-settings.d/.20-hidden.json': '{"voiceEnabled": true}',
  'packages/ad/managed-settings.d/30-b.txt': '{"voiceEnabled": true}',
  'packages/ad/managed-settings.d/sub/40-c.json': '{"voiceEnabled": true}',
  'packages/ad/.vscode/settings.json': '{"voiceEnabled": true}',
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
  'packages/ac/.claude/settings.json': '{"autoContinueAtUsageLimit": false}',
  'packages/ac/.claude/settings.local.json': '{"autoContinueAtUsageLimit": true}',
  'packages/ac/managed-settings.json': '{"autoContinueAtUsageLimit": "no"}',
  'packages/ac/managed-settings.d/10-a.json': '{"autoContinueAtUsageLimit": 0}',
  'packages/ac/managed-settings.d/20-ok.json': '{"autoContinueAtUsageLimit": false}',
  'packages/ac/managed-settings.d/.30-hidden.json': '{"autoContinueAtUsageLimit": 0}',
  'packages/ac/managed-settings.d/40-c.txt': '{"autoContinueAtUsageLimit": 0}',
  'packages/ac/managed-settings.d/sub/50-d.json': '{"autoContinueAtUsageLimit": 0}',
  'packages/ac/.vscode/settings.json': '{"autoContinueAtUsageLimit": 0}',
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
  'packages/hc/.claude/settings.json': '{"apiKeyHelper": "/bin/key.sh"}',
  'packages/hc/.claude/settings.local.json': '{"apiKeyHelper": "/bin/key.sh"}',
  'packages/hc/managed-settings.json': '{"apiKeyHelper": "/bin/key.sh"}',
  'packages/hc/managed-settings.d/10-a.json': '{"awsAuthRefresh": "aws sso login"}',
  'packages/hc/.vscode/settings.json': '{"apiKeyHelper": "/bin/key.sh"}',
  'packages/hc2/.claude/settings.json':
    '{"statusLine": {"type": "command", "command": "~/status.sh"}}',
  // `settings-local-location` reads the local file in a repository with a `.git`: the file below
  // the root is a fault, and the file at the root is not.
  'packages/ll/.git/HEAD': 'ref: refs/heads/main\n',
  'packages/ll/.claude/settings.local.json': '{}',
  'packages/ll/pkg/.claude/settings.local.json': '{}',
  'packages/ll/pkg/.claude/settings.json': '{}',
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
]

// `settings-schema-url` reports each settings file that is a JSON object with no `$schema`. The
// tree has many such files, so the list is computed from the tree. A project file, a managed file
// and a drop-in that is not hidden are settings files. The other files of the tree are not.
const SETTINGS_FILE =
  /(^|\/)(\.claude\/settings(\.local)?\.json|managed-settings\.json|managed-settings\.d\/[^./][^/]*\.json)$/
const SCHEMA_URL_MISSING = Object.entries(TREE)
  .filter(([file, content]) => {
    const data: unknown = SETTINGS_FILE.test(file) ? JSON.parse(content) : null
    return typeof data === 'object' && data !== null && !Array.isArray(data) && !('$schema' in data)
  })
  .map(([file]) => file)

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
    'packages/ad/.claude/settings.json',
    'packages/ad/.claude/settings.local.json',
    'packages/ad/managed-settings.json',
    'packages/ad/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-deprecated-key@1`),
  'packages/ad/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
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
    'packages/ac/.claude/settings.json',
    'packages/ac/.claude/settings.local.json',
    'packages/ac/managed-settings.json',
    'packages/ac/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-project-autocontinue-off@1`),
  'packages/ac/managed-settings.d/.30-hidden.json: claude/settings-managed-file@2',
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
  'packages/hc/.claude/settings.json: claude/settings-committed-helper-command@1',
  'packages/hc2/.claude/settings.json: claude/settings-committed-helper-command@1',
  // `settings-local-location` reports the local file below the root of a repository.
  'packages/ll/pkg/.claude/settings.local.json: claude/settings-local-location@1',
  // `settings-webfetch-preflight-skip` reads the project files and the managed source. A rule in
  // the other file makes the key silent.
  ...[
    'packages/wf/.claude/settings.json',
    'packages/wf/.claude/settings.local.json',
    'packages/wf/managed-settings.json',
    'packages/wf/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-webfetch-preflight-skip@1`),
  'packages/wf/managed-settings.d/.20-hidden.json: claude/settings-managed-file@2',
  // `settings-env-numeric-spelling` reads the project and managed files. `settings-env-value-format`
  // owns a variable that has a form.
  ...[
    'packages/numeric/.claude/settings.json',
    'packages/numeric/.claude/settings.local.json',
    'packages/numeric/managed-settings.json',
    'packages/numeric/managed-settings.d/10-a.json',
  ].map((file) => `${file}: claude/settings-env-numeric-spelling@1`),
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

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-'))
  for (const [file, content] of Object.entries(TREE)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
  }
  if (LINKS) {
    mkdirSync(path.join(root, 'packages/s/site/plugins'), { recursive: true })
    symlinkSync('../../shared/p', path.join(root, 'packages/s/site/plugins/p'))
  }
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

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
      ...SCOPE_RULES.map(({ name, severity = 'error' }) => [
        `claude/recommended/${name}`,
        { [`claude/${name}`]: severity },
      ]),
    ])
  })

  // No rule is off in recommended yet, so strict holds the same rules.
  it('gives strict the same rules and severities as recommended today', () => {
    const rulesOf = (config: Linter.Config[]) => config.map((c) => c.rules)
    expect(rulesOf(plugin.configs.strict)).toEqual(rulesOf(plugin.configs.recommended))
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

  // CI runners are slow, so the two tests that run ESLint get 30 s in place of the 5 s default.
  it('recommended reports each rule on its own files, at its own severity', async () => {
    expect(await reports(plugin.configs.recommended)).toEqual(EXPECTED)
  }, 30_000)

  it('strict reports the same files as recommended today', async () => {
    expect(await reports(plugin.configs.strict)).toEqual(EXPECTED)
  }, 30_000)
})
