---
type: Reference
description: The ESLint rule claude/marketplace-name-reserved, which reports a marketplace.json name that Claude Code reserves, a spelling of one of the 19 Anthropic marketplace names, a package-manager name, and a name that starts with claudeai-, with the allowOfficial option.
owner: brianespinosa
created: 2026-10-06
related_issues: [12]
stale_after: 2027-04-06
generated:
  by: claude-code
  at: 2026-10-06T00:00:00Z
---

# `marketplace-name-reserved`

Do not give a marketplace a name that Claude Code reserves.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

Claude Code refuses a marketplace name that it reserves.[^reserved] The rule reads the top-level
`name`. When a file has two `name` keys, the rule reads the last one, as `JSON.parse` does. It
reports the name in these cases:

- **Anthropic names.** The name is one of the 19 official, community and plugin directory names.
  Claude Code reserves them unless the marketplace comes from a `github` or `git` source under
  `github.com/anthropics/`.[^reserved][^untrusted] The rule reads no source and no git remote. Use
  the `allowOfficial` option for such a repository.
- **Another spelling.** The name differs from one of those 19 names only by one trailing dot, or
  by a symbol other than an underscore in place of a hyphen. `claude.code.plugins` counts as
  `claude-code-plugins`.[^reserved][^spelling] The rule reads a symbol as an ASCII punctuation
  character. The letters must match, because the docs give no case folding for these names.
  `allowOfficial` does not silence this report.
- **Internal names.** The name is `inline`, `builtin`, `skills-dir`, `synced` or
  `claude-plugin-test`. Claude Code uses the first four for plugins that do not come
  from a marketplace. The docs also reserve the last.[^reserved]
- **Package-manager names.** The name is `npm`, `pip`, `uv`, `cargo`, `github` or `gh`, in any letter
  case.[^reserved]
- **The `claudeai-` prefix.** Claude Code reserves it for marketplaces that claude.ai
  hosts.[^reserved] The rule matches the prefix in lowercase only, as the docs write it.

The lists are in `src/data/marketplace-reserved-names.ts`, as of Claude Code 2.1.288.

The docs also reserve a name that impersonates an official marketplace, such as
`official-claude-plugins`, and a name with a non-ASCII character. The docs give no test for an
impersonating name, so the rule does not check these.[^reserved] The docs do not say which
reserved names the spelling check covers. The rule checks the 19 Anthropic names only. The rule
does not check a `name` that is not a string. That value is a fault for `marketplace-schema`.

`claude plugin validate` also reports the internal names and the package-manager names as
errors.[^validation] The docs say that the exact official names pass validation, and that Claude
Code refuses them when a user adds the marketplace.[^add] The docs do not say whether validate
reports a spelling or the `claudeai-` prefix. So the rule reports the official names, which
validate does not.

Fail:

```json
{ "name": "claude-code-plugins", "owner": { "name": "Acme" }, "plugins": [] }
```

Pass:

```json
{ "name": "acme-tools", "owner": { "name": "Acme" }, "plugins": [] }
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allowOfficial` | `false` | Set `true` to accept the 19 Anthropic names. Use it in a repository under `github.com/anthropics/`. |

```js
'claude/marketplace-name-reserved': ['error', { allowOfficial: true }]
```

The rule reads no git remote, so the user sets the option. `allowOfficial` silences the 19 names
only. It does not silence a spelling, an internal name, a package-manager name or the prefix. The
`recommended` and `strict` configs set no option.

## Sources

[^reserved]: [Marketplace reference: Reserved names](https://code.claude.com/docs/en/plugins/marketplace-reference#reserved-names)
[^untrusted]: [Error reference: Marketplace is registered from an untrusted source](https://code.claude.com/docs/en/errors#marketplace-is-registered-from-an-untrusted-source)
[^spelling]: [Error reference: Marketplace name is another spelling of a reserved name](https://code.claude.com/docs/en/errors#marketplace-name-is-another-spelling-of-a-reserved-name)
[^add]: [Create a marketplace: Problems that surface when you add or install](https://code.claude.com/docs/en/plugins/create-marketplace#problems-that-surface-when-you-add-or-install)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
