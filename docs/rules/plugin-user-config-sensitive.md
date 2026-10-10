---
type: Reference
description: The ESLint rule claude/plugin-user-config-sensitive, which reports a userConfig option for a token or a password that does not set sensitive, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-user-config-sensitive`

Set `sensitive` on a `userConfig` option for a token or a password.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude-plugin/plugin.json` |

## Rule details

The docs say to set `"sensitive": true` for a token or a password. Claude Code then masks the input
and keeps the value in secure storage, and not in `settings.json`.[^components][^field] The rule
reports an option that has the word `token` or `password` in its key or in its `title`, and does not
set `sensitive`.

The test is a heuristic, so the rule is `off` in `recommended`. It matches whole words. The words of
a key or a title end at a character that is not an ASCII letter or digit, and at a change from
lower case to upper case. So `api_token`, `botToken`, `APIToken` and `Admin Password` match.
`tokenizer` and `passwordless` do not. A plural, such as `tokens`, matches.

The docs name a token and a password only. The rule does not check `secret` or `api_key`. An option
that holds an API key can still set `sensitive`, but no docs text asks for it.

The report is on the key of the option. The rule reads the top-level `userConfig` and the
`userConfig` of each channel, which has the same shape.[^channels]

The rule makes no report in these cases:

- The option sets `sensitive`, with any value. A `false` is a choice of the author.
- The option is not an object.
- The option has a `type` other than `string`, such as `number`, `boolean`, `file` or `directory`.
  `sensitive` masks text, so a count such as `max_tokens` is not a secret.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin root,
  of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Fail: `"api_token": { "type": "string", "title": "API token", "description": "d" }`.

Pass: the same option with `"sensitive": true`, or `"tokenizer": { ... }`.

A `title` that is not a string adds no word. The key is still checked.

## Sources

[^components]: [Add components to a plugin: Ask the user for configuration values](https://code.claude.com/docs/en/plugins/components#user-configuration)
[^field]: [Plugin manifest reference: User configuration](https://code.claude.com/docs/en/plugins/manifest-reference#user-configuration)
[^channels]: [Plugin manifest reference: Channels](https://code.claude.com/docs/en/plugins/manifest-reference#channels)
