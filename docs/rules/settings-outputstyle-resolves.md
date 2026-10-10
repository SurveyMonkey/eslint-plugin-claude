---
type: Reference
description: The ESLint rule claude/settings-outputstyle-resolves, which reports an outputStyle value in a project or local settings file that is no built-in style and no style file in .claude/output-styles/, because Claude Code compares the value with case and uses the Default style.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-outputstyle-resolves`

Name an output style that Claude Code can load in `outputStyle`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The value of `outputStyle` is case-sensitive. A value that matches no style name exactly gives the
Default style. An example is `explanatory`.[^change] So a wrong name has no effect.

The rule accepts a value that is one of these:

- A built-in name: `default`, `Proactive`, `Concise`, `Explanatory` or `Learning`.[^change]
- The name of a custom style. A custom style is a Markdown file in `.claude/output-styles/`.
  Its name is the file name without `.md`. The `name` field of its frontmatter can set another
  name.[^create] The rule accepts both names.
- A name in the option `allow`.

The report is on the value. When the value matches a known name in a different letter case,
the message gives the name to write.

### Where the rule looks

Claude Code loads project styles from every `.claude/output-styles/` directory between the working
directory and the repository root.[^create] The rule reads the `.claude/output-styles/` directory
of the project that holds the settings file. It also reads that directory in each directory above
the project, up to the repository root. A folder below `output-styles/` counts. A file that is not Markdown does
not.

The rule makes no report when it cannot see a style. It reads no file out of the repository.
These cases give no report. A link leads out of the repository. The rule cannot read a directory.
The rule cannot read a style file.

A style from a user directory (`~/.claude/output-styles/`), from a plugin, or from a managed
policy is not in the repository. Name such a style in the option `allow`.

### Options

| Option | Type | Default | Meaning |
|--------|------|---------|---------|
| `allow` | array of strings | `[]` | Style names to accept, such as a user style or a plugin style |

### What the rule does not check

- A managed file. The row for this rule names no managed file. A managed file applies to every
  project on a machine, so the project styles that it can name are not in the repository that
  holds the file. The rule cannot show that a style is absent.
- A value that is not a string. `settings-schema` reports it.
- The frontmatter of a style file. The `output-style-frontmatter-*` rules check it.

When a file has two `outputStyle` keys, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/settings.local.json`:

```json
{
  "outputStyle": "explanatory"
}
```

Pass:

```json
{
  "outputStyle": "Explanatory"
}
```

## Sources

[^change]: [Output styles: Change your output style](https://code.claude.com/docs/en/output-styles#change-your-output-style)
[^create]: [Output styles: Create a custom output style](https://code.claude.com/docs/en/output-styles#create-a-custom-output-style)
