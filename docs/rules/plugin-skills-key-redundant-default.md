---
type: Reference
description: The ESLint rule claude/plugin-skills-key-redundant-default, which reports an entry of the skills key in plugin.json that names the default skills directory, because the key adds to the default scan, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-skills-key-redundant-default`

Do not list the default skills directory in the `skills` key of a plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

Each component key of `plugin.json` replaces its default location, adds to it, or merges with
it. The `skills` key adds to the default: Claude Code still scans the `skills/` directory, and
the listed directories load beside it.[^combine] An entry that names `skills/` again points at a
directory that the scan already covers.

`claude plugin validate` does not report such an entry (checked on Claude Code 2.1.296).

The rule reads the `skills` key of the manifest. It reports each entry whose path, resolved from
the plugin root, is the `skills/` directory of the plugin. So `./skills`, `./skills/`, `skills`
and `./skills//` are all reported. The report is on the entry. When the key appears twice, the
rule reads the last one, as `JSON.parse` does.

The rule reads the spelling of the path. It does not follow a link, and it does not check that
the directory exists. The rule makes no report in these cases:

- The entry names the plugin root (`.` or `./`) or a folder of another name. The docs allow
  both in the key.[^fields]
- The entry names one skill folder inside `skills/`, such as `./skills/review`. The docs say
  that an entry can be one folder with a `SKILL.md`, so the entry is not the default
  directory.[^table]
- The value of `skills` is not a string or an array. An element that is not a string is skipped.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

Fail: `"skills": ["./skills/", "./extra-skills/"]`.

Pass: `"skills": ["./extra-skills/"]`, or no `skills` key.

## Options

None.

## Sources

[^combine]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
[^fields]: [Plugin manifest reference: Path-only fields](https://code.claude.com/docs/en/plugins/manifest-reference#path-only-fields)
[^table]: [Plugin manifest reference: Fields](https://code.claude.com/docs/en/plugins/manifest-reference#fields)
