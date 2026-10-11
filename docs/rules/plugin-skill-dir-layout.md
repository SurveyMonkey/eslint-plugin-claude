---
type: Reference
description: The ESLint rule claude/plugin-skill-dir-layout, which reports a loose Markdown file in a skills directory that the skills key of plugin.json names, because Claude Code finds a skill only as a folder with a SKILL.md.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-skill-dir-layout`

Put each skill of a listed skills directory in a folder, in a file named `SKILL.md`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

A plugin keeps each skill in its own folder, as `<name>/SKILL.md`.[^standard] The `skills` key of
`plugin.json` lists more directories to scan for skills. Each one is a directory of
`<name>/SKILL.md` folders, or one folder that holds `SKILL.md` directly.[^fields] A loose `.md`
file in a listed directory is not a skill folder. Claude Code does not find it as a
skill.[^components]

The rule reads the `skills` value of a manifest: a path, or an array of paths. For each path, it
lists the directory. It reports once for each loose `.md` file, on the path string, in name order.
The message names the file and the path, and gives the folder where the file belongs.

The rule makes no report in these cases:

- The directory is a default skills directory: the `skills/` directory of the plugin, or a
  `.claude/skills/` directory. The rule [`skill-file-layout`](skill-file-layout.md) reports a loose
  file there, so a second report would repeat it. The rule compares the real path of the directory.
  So `./skills/`, `./x/../skills` and a link to `skills/` are all default directories.
- The file is a `skill.md` in `skills/<name>/`, and the folder has no `SKILL.md`. The rule
  `skill-file-layout` reports the letter case of that file.
- The path is the plugin root, as `.` or `./`. The root holds files that are no skills, such as a
  README.
- The directory holds a `SKILL.md` itself. It is one skill, and its other files belong to it.
- The file is a `README.md`, in any letter case. It does not claim to be a skill.
- The file is a `.md` link whose target is not there, is out of the repository, or is a folder.
  The rule cannot see such a file.
- The path is not a string, is not there, names a file, or leaves the plugin root. The rules for
  paths report such a path.
- The rule cannot see the plugin or the directory. The plugin root can be unseen. The real path of
  `.claude-plugin/`, of `plugin.json` or of the directory can be out of the repository. The
  manifest can fail to parse. The rule can fail to list the directory. A path with a link that
  has no target is a path that the rule cannot see.

The rule checks only the files directly in the directory. In a directory outside `skills/<name>/`,
it reports a `skill.md` of the wrong letter case as a loose file.

`claude plugin validate` reports a `skills` entry that names a file.[^validate] The cited docs list
no `claude plugin validate` message for a loose file in a listed directory.

Fail: `"skills": ["./extra-skills/"]` with `extra-skills/deploy.md`.

Pass: `"skills": ["./extra-skills/"]` with `extra-skills/deploy/SKILL.md`.

## Options

None.

## Sources

[^standard]: [Plugin manifest reference: Standard layout](https://code.claude.com/docs/en/plugins/manifest-reference#standard-layout)
[^fields]: [Plugin manifest reference: Fields](https://code.claude.com/docs/en/plugins/manifest-reference#fields)
[^components]: [Add components to a plugin: Skills](https://code.claude.com/docs/en/plugins/components#skills)
[^validate]: [Troubleshoot plugins: claude plugin validate reports errors](https://code.claude.com/docs/en/plugins/troubleshooting#claude-plugin-validate-reports-errors)
