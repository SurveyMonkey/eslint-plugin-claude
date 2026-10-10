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
].sort()

// The reports of the `off` agent rules. They appear in `strict` only, at `warn`. `task-alias.md`
// is an agent that no setting runs as the main thread, so its type list is ignored.
const STRICT_ONLY = [
  '.claude/agents/task-alias.md: claude/agent-tools-agent-type-list@1',
  'packages/o/.claude/agents/skill-tool.md: claude/agent-tools-skill-for-preload@1',
  'packages/o/.claude/agents/model.md: claude/agent-model-value@1',
  'plugins/p/agents/model.md: claude/agent-model-value@1',
  'packages/o/.claude/agents/prompt.md: claude/agent-initial-prompt-main-only@1',
  'packages/o/.claude/agents/main.md: claude/agent-tools-agent-type-list@1',
  'packages/o/.claude/agents/typelist.md: claude/agent-tools-agent-type-list@1',
  'packages/o/.claude/agents/skills.md: claude/agent-skills-exist@1',
  'packages/o/.claude/agents/mcp-ref.md: claude/agent-mcp-servers-ref-exists@1',
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
isolateGitConfig()

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-'))
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
      ...SETTINGS_RULES.map((rule) => [
        `claude/recommended/${rule}`,
        { [`claude/${rule}`]: 'error' },
      ]),
      ...SCOPE_RULES.map(({ name }) => [
        `claude/recommended/${name}`,
        { [`claude/${name}`]: 'error' },
      ]),
      ...UNTRACKED_RULES.map(({ name }) => [
        `claude/recommended/${name}`,
        { [`claude/${name}`]: 'warn' },
      ]),
    ])
  })

  // `strict` keeps each rule of `recommended` at its severity, and adds each `off` rule at `warn`.
  it('gives strict the rules of recommended, and each off rule at warn', () => {
    const rulesOf = (config: Linter.Config[]) => config.map((c) => c.rules)
    const isOff = (rules: Linter.Config['rules']) =>
      AGENT_OFF_RULES.some((rule) => rules?.[`claude/${rule}`] !== undefined)
    const strict = rulesOf(plugin.configs.strict)
    expect(strict.filter((rules) => !isOff(rules))).toEqual(rulesOf(plugin.configs.recommended))
    expect(strict.filter(isOff)).toEqual(
      AGENT_OFF_RULES.map((rule) => ({ [`claude/${rule}`]: 'warn' })),
    )
    expect(plugin.configs.strict.map((c) => c.name)).toEqual([
      'claude/strict/skill-description-max-length',
      'claude/strict/command-legacy-format',
      'claude/strict/hooks-event-name-known',
      ...NEW_RULES.map((rule) => `claude/strict/${rule}`),
      ...AGENT_RULES.map((rule) => `claude/strict/${rule}`),
      ...AGENT_WARN_RULES.map((rule) => `claude/strict/${rule}`),
      ...AGENT_OFF_RULES.map((rule) => `claude/strict/${rule}`),
      ...TOOL_LIST_BLOCKS.map((rule) => `claude/strict/${rule}`),
      ...MARKETPLACE_RULES.map((rule) => `claude/strict/${rule}`),
      ...SETTINGS_RULES.map((rule) => `claude/strict/${rule}`),
      ...SCOPE_RULES.map(({ name }) => `claude/strict/${name}`),
      ...UNTRACKED_RULES.map(({ name }) => `claude/strict/${name}`),
    ])
  })

  it('turns each off agent rule on in strict only, on the agent files', () => {
    for (const rule of AGENT_OFF_RULES) {
      expect(plugin.configs.recommended.some((c) => c.name?.endsWith(`/${rule}`))).toBe(false)
      const blocks = plugin.configs.strict.filter((c) => c.name === `claude/strict/${rule}`)
      expect(blocks.map((c) => [c.language, c.files])).toEqual([
        ['markdown/gfm', ['**/agents/**/*.md']],
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

  it('gives each rule that asks git one block with its language and files', () => {
    for (const { name, language, files } of UNTRACKED_RULES) {
      const blocks = plugin.configs.recommended.filter(
        (c) => c.name === `claude/recommended/${name}`,
      )
      expect(blocks.map((c) => [c.language, c.files])).toEqual([[language, files]])
    }
  })

  // The run starts a `git` process for each file that a git rule reads, so it needs more than the
  // default time on a busy machine.
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
  })

  it('strict reports the files of recommended, and those of the off rules', async () => {
    expect(await reports(plugin.configs.strict)).toEqual([...EXPECTED, ...STRICT_ONLY].sort())
  }, 30_000)
})
