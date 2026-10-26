---
type: Reference
description: The ESLint rule claude/hooks-skill-source-limit, which reports each skill with a frontmatter hook in a project .claude directory or plugin whose skills declare more than 1,024 hooks, or more than 16,384 matcher characters.
owner: brianespinosa
created: 2026-10-25
related_issues: [562]
stale_after: 2027-04-25
generated:
  by: claude-code
  at: 2026-10-25T00:00:00Z
---

# claude/hooks-skill-source-limit

📝 Keep the skill hooks of one source within the limits of Claude Code.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| limit | `**/SKILL.md` |

## Rule details

In Claude Code v2.1.304 or later, each source of skills has its own limit for each session. The
skills of one source can register at most 1,024 hooks. The matchers of those hooks can total at
most 16,384 characters. A matcher with several hooks under it counts once for each hook. A skill
past a limit runs with none of its frontmatter hooks, and Claude Code shows no error. The debug
log has the text `registers none of its hooks`.[^limits]

The rule adds up the frontmatter hooks of each `SKILL.md` of one source:

- A source is one `.claude/` directory, with its `skills/` folder, or one plugin, with its
  `skills/` folder.
- A hook is each handler object in the `hooks` list of a matcher group.
- The matcher characters of a group are the length of its `matcher` string, one time for each
  hook in the group. A group with no string `matcher` adds no characters. The length is the
  JavaScript string length, so a character out of the Basic Multilingual Plane counts as two.

The rule reports when the source has more than 1,024 hooks, or more than 16,384 matcher
characters. A source at exactly 1,024 hooks and 16,384 characters gets no report. Each limit
has its own message, and a skill past both gets two reports.

Claude Code adds the hooks of a skill when you or Claude invoke it, so both totals build up skill
by skill.[^limits] The order of invocation decides which skill goes past the limit, and the
files do not show that order. So the rule reports on each skill of the source that declares at
least one hook. A skill with no hook loses nothing, and gets no report. The report is on the
`hooks` key of the frontmatter.

The rule uses the text in the editor for the file that it lints, and the files on disk for the
other skills of the source.

### What the rule does not check

- The personal skills folder `~/.claude/skills/`. It is a source of its own, and it is out of the
  repository.
- The plugin-root `SKILL.md`. It loads only when the plugin has no `skills/` folder.
- The skills that a `skills` key of `plugin.json` adds. The rule reads the `skills/` folder only.
- A nested `.claude/skills/` folder, such as `packages/web/.claude/skills/`, counts as a source of
  its own. The docs do not say if Claude Code adds it to the project source.
- Command files. The docs give hooks to skills and subagents only.
- The frontmatter of a skill on disk that does not parse. Such a skill registers no hooks, so it
  adds nothing. A `SKILL.md` that the rule cannot read also adds nothing. It can only add to the
  total, so a report never rests on it.
- The plugin-only lock of `strictPluginOnlyCustomization`. It is a managed setting at run time.

Fail, when the other skills of the `.claude/` directory declare 1,024 hooks:

```yaml
---
name: secure-operations
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh"
---
```

Pass, when the other skills of the `.claude/` directory declare 1,023 hooks or fewer.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/hooks-skill-source-limit': 'warn'
```

## Sources

[^limits]: [Hooks reference: Limits on skill hooks](https://code.claude.com/docs/en/hooks#limits-on-skill-hooks)
