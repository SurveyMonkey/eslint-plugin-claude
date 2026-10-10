---
type: Reference
description: The ESLint rule claude/permissions-dead-allow, which reports an allow rule that a deny or ask rule of the same settings source covers, because Claude Code checks deny, then ask, then allow, and the allow rule never applies.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-dead-allow`

Do not write an `allow` rule that a `deny` or `ask` rule covers.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

Claude Code checks the rules in this order: `deny`, then `ask`, then `allow`. The first match decides, and the
specificity of a rule does not change the order.[^order] A `deny` rule for `Bash(aws *)` blocks `Bash(aws s3 ls)`, and an
`allow` rule cannot make an exception. An `ask` rule that matches the call also prompts, although a narrower `allow` rule matches it too.
So an `allow` rule that a `deny` or `ask` rule covers never applies.

The rule reports the `allow` entry. The message names the rule that covers it and the list of that rule.

### What counts as covered

- A bare tool name in `deny` or `ask` covers every `allow` rule of that tool (`deny: ["Bash"]` covers `Bash(npm test)`).[^all]
- For `Bash`, `Monitor` and `PowerShell`, `Tool(*)` is the same as the bare name.[^all] The rule reads the form `Tool(*)` for
  these tools only.
- For these tools, a command pattern covers an `allow` rule when it matches every command that the `allow` rule matches.
  `Bash(npm *)` covers `Bash(npm test)`, `Bash(npm run *)` and `Bash(npm)`. A final ` *` that is the only wildcard also matches
  the bare command, and `:*` at the end is a final ` *`. White space between words does not matter.
- For every other tool, the specifiers must be equal.

### Limits

The rule reads the text of the rules, so these cases get no report:

- A wildcard in the middle of a pattern that covers a wider pattern (`Bash(git log *)` with `Bash(git log * main)`).
- A path rule, a `WebFetch` domain rule or an MCP rule that covers another by pattern (`Read(./src/**)` with `Read(./src/a.ts)`).
  Only an equal specifier counts.
- A tool-name glob such as `mcp__*` in `deny`. `permissions-deny-all-tools` is the rule for it.
- A compound command, a hook, a mode or a rule in a file that the repository does not hold, such as the user file.

The same rule twice in `allow` and `deny` is a dead `allow` rule, and the rule reports it. `permissions-duplicate-rule` is the
rule for the same rule twice in one list.

### One source

The rule adds up the lists of one source. For a project file, the source is the pair `.claude/settings.json` and
`.claude/settings.local.json`. For a managed file, the source is `managed-settings.json` with the files of
`managed-settings.d/`. A `deny` rule in a project file does not cover an `allow` rule in a managed file, and the rule reads no
managed file for a project file. A file that the rule cannot read adds nothing. The rule reports on the files that it reads.[^precedence]
A `deny` rule in a user file can cover an `allow` rule too. The repository does not hold that file.

Fail, in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Bash(npm test)"],
    "deny": ["Bash"]
  }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Bash(npm test)"],
    "deny": ["Bash(rm *)"]
  }
}
```

## Options

None.

## Sources

[^order]: [Configure permissions: Manage permissions](https://code.claude.com/docs/en/permissions#manage-permissions)
[^all]: [Configure permissions: Match all uses of a tool](https://code.claude.com/docs/en/permissions#match-all-uses-of-a-tool)
[^precedence]: [Configure permissions: Settings precedence](https://code.claude.com/docs/en/permissions#settings-precedence)
