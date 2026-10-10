---
type: Reference
description: The ESLint rule claude/settings-skilloverrides-key, which reports a skillOverrides key that names a plugin skill (plugin:skill), and a key that is the alias of a bundled skill (review, checkup, proactive) in a project or local settings file, because Claude Code does not apply either entry.
owner: brianespinosa
created: 2026-10-09
related_issues: [14]
stale_after: 2027-04-09
generated:
  by: claude-code
  at: 2026-10-09T00:00:00Z
---

# `settings-skilloverrides-key`

Do not set a `skillOverrides` key that Claude Code does not apply.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`skillOverrides` maps a skill name to `on`, `name-only`, `user-invocable-only` or `off`.[^key]
Claude Code applies an entry to the skill of that name. Two kinds of key reach no skill. The
report is on the key.

### A plugin skill key

"Plugin skills are not affected by `skillOverrides`. Manage those through `/plugin` instead."[^skills]
A plugin skill has the name `plugin-name:skill-name`.[^names] A name with a colon has other
sources. A command in a subfolder of `.claude/commands/` is `frontend:component`. A nested skill
whose directory name clashes with another skill is `apps/web:deploy`.[^names] The rule cannot tell
these from a plugin skill by the key alone. So the rule reports a key with a colon only when the
text before the first colon is a plugin that `enabledPlugins` of the same file turns on. The
rule does not see a plugin that another file enables. The synced namespace `anthropic-skills:`
names no plugin, so it gets no report.

### A bundled alias key

In user, project and local settings, "Claude Code matches entries against skill names only".[^skills] An entry for `review` there applies to a skill named `review`. It does not reach the bundled `/code-review` through its `/review` alias. In managed settings, a key under an alias applies to the skill behind it. The same is true in a file that a `--settings` flag passes.[^skills]

| Alias key | Bundled skill |
|-----------|---------------|
| `review` | `code-review` |
| `checkup` | `doctor` |
| `proactive` | `loop` |

The list is in `src/data/settings-keys.ts`. It holds the aliases of the rows that the
[commands reference](https://code.claude.com/docs/en/commands#all-commands) marks as a bundled
skill. No footnote cites that page, because its table is large and changes with most releases.
The rule reports an alias key in a project file and in a local file. It makes no report in a
managed file or a drop-in, where the key applies.

If the repository has a skill named `review`, the key applies to that skill. The rule makes no
report when `.claude/skills/<alias>`, `.claude/commands/<alias>` or `.claude/commands/<alias>.md`
exists next to the settings file. It cannot see a skill of the user or of a plugin. In that case,
name the skill in the key, or disable the rule for that line.

### What the rule does not check

- A key that names no skill. The rule cannot tell a typo from a skill of another place.
- A plugin that another file enables, and a skill of the user.
- The value of an entry. `settings-schema` is for it.
- A `--settings` file that a script passes. The file is not in a known place.
- A hidden file in `managed-settings.d/`. Claude Code ignores it.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does. An entry with
a `null` value is removed, so the rule makes no report on it.

Fail, in `.claude/settings.json`:

```json
{
  "skillOverrides": {
    "formatter:lint": "off",
    "review": "off"
  },
  "enabledPlugins": { "formatter@acme-tools": true }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "skillOverrides": {
    "code-review": "off",
    "deploy": "name-only"
  }
}
```

## Sources

[^key]: [All settings: skillOverrides](https://code.claude.com/docs/en/settings-reference#skilloverrides)
[^skills]: [Extend Claude with skills: Override skill visibility from settings](https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings)
[^names]: [Extend Claude with skills: How a skill gets its command name](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
