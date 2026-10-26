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
past a limit runs with none of its frontmatter hooks. The debug log has the text
`registers none of its hooks`.[^limits]

The rule adds up the frontmatter hooks of each `SKILL.md` of one source:

- A source is one `.claude/` directory, with its `skills/` folder, or one plugin, with its
  `skills/` folder.
- A hook is each handler object in the `hooks` list of a matcher group. Claude Code skips an
  event name that it does not know, so the hooks under that name add nothing.[^lifecycle] The
  rule uses the event list of `hooks-event-name-known`, without its `additionalEvents` option.
- The matcher characters of a group are the length of its `matcher` string, one time for each
  hook in the group. A group with no string `matcher` adds no characters.
- The length is the JavaScript string length. So a character out of the Basic Multilingual Plane
  counts as two. The docs do not say how Claude Code counts a character.
- Claude Code loads a project skill once when several folder links point at it.[^symlinks] So
  the rule counts that skill once. The docs say that plugin skills handle links in another way.
  A probe of Claude Code 2.1.310 loads a plugin skill and a folder link to it as one skill. So
  the rule also counts that skill once in a plugin.

The rule reports when the source has more than 1,024 hooks, or more than 16,384 matcher
characters. A source at exactly 1,024 hooks and 16,384 characters gets no report. Each limit
has its own message, and a skill past both gets two reports.

A probe on Claude Code 2.1.310 agrees with the limit. A project skill with 1,024 hooks gives
`Registered 1024 hooks` in the debug log. A skill with 1,025 hooks gives `registers none of its
hooks and grants no tools`. The docs do not say that the skill grants no tools, so the message
names the hooks only.

Both totals build up skill by skill, as you or Claude invoke the skills.[^limits] The order of
invocation decides which skill goes past the limit, and the files do not show that order. So the
rule reports on each skill of the source that declares at least one hook. Thus the rule can
report a skill that no order takes past the limit.

A skill with no hook loses nothing, and gets no report. A skill with no matcher characters
cannot take the character total past the limit, so it gets no matcher report. The report is on
the `hooks` key of the frontmatter.

The rule uses the text in the editor for the file that it lints. It uses the files on disk for
the other skills of the source.

### What the rule does not check

- The personal skills folder `~/.claude/skills/`. It is a source of its own, and it is out of the
  repository.
- The plugin-root `SKILL.md`. It loads only when the plugin has no `skills/` folder and no
  `skills` key. The rule does not count it.
- Command files. A file in `.claude/commands/` takes the skill frontmatter, with `hooks`. The
  docs name skills only in the limit, so the rule does not count the hooks of a command.
- The skills that a `skills` key of `plugin.json` adds. The rule reads the `skills/` folder only.
- A nested `.claude/skills/` folder as part of the project source. The rule counts a folder such
  as `packages/web/.claude/skills/` as a source of its own. The docs do not say if Claude Code
  adds it to the project source.
- The frontmatter of a skill on disk that does not parse. Such a skill registers no hooks, so it
  adds nothing. A `SKILL.md` that the rule cannot read also adds nothing. Its hooks can only make
  the total larger, so a report never rests on that file.
- A skill folder or `SKILL.md` that links out of the repository. It adds nothing to the total.
- A skill with a `PreToolUse` hook entry that does not load, such as an unknown `type`. Claude
  Code 2.1.310 then loads none of the hooks of that skill. The rule still counts each handler
  object of the skill.
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

## Options

<!-- begin auto-generated rule options list -->

| Name              | Description                                                   | Type    | Default |
| :---------------- | :------------------------------------------------------------ | :------ | :------ |
| `maxHooks`        | The most frontmatter hooks in the skills of one source.       | Integer | `1024`  |
| `maxMatcherChars` | The most matcher characters in the skill hooks of one source. | Integer | `16384` |

<!-- end auto-generated rule options list -->

```js
'claude/hooks-skill-source-limit': ['warn', { maxHooks: 512, maxMatcherChars: 8192 }]
```

The docs give the two limits, and name no setting that moves them. So the schema refuses a
larger value. At another value, the message names the value as the configured limit. It does
not say that Claude Code stops there.

## Sources

[^limits]: [Hooks reference: Limits on skill hooks](https://code.claude.com/docs/en/hooks#limits-on-skill-hooks)
[^lifecycle]: [Hooks reference: Hook lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle)
[^symlinks]: [Extend Claude with skills: Choose where skills load](https://code.claude.com/docs/en/skills#choose-where-skills-load)
