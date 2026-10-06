---
type: Reference
description: The ESLint rule claude/agent-name-unique, which reports each local subagent file whose name is also the name of another file under the same .claude/agents directory, subfolders included.
owner: brianespinosa
created: 2026-10-05
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-05T00:00:00Z
---

# `agent-name-unique`

Give each local agent its own name.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/agents/**/*.md` |

## Rule details

The `name` field gives a subagent its identity. The folder path of the file does not.[^scope]
If two files under one `.claude/agents/` directory have the same `name`, Claude Code loads only
one of them. The file system read order decides which one. The docs give no precedence.[^scope]

The rule reports on each file of a duplicate, not only on the second file. A rule that lints one
file cannot know the order of the files. The report is on the `name` value. The message lists the
other files, by their path below `agents/`.

The rule compares names as exact strings. The docs say nothing about letter case or spaces in a
subagent name. It reads the other files from the disk. It reads each `.md` file below
`.claude/agents/`, at any depth. It reads no file out of the repository. The repository is the
first directory at or above `.claude/` that has a `.git` entry. The rule follows a link to a
directory once. It does not follow a link whose real path is out of the repository. A `.claude` that is such a
link gives no report.

The rule does not check these cases:

- A plugin agent. The rule reports on local agents only.
- The same name in two nested `.claude/agents/` directories. Claude Code uses the definition
  closest to the current directory, so that is not an error.[^scope]
- The same name in a plugin, in `~/.claude/agents/`, or in managed settings. Those sources have
  a priority order, and the rule cannot see all of them.[^scope]
- A file with no `name`, an empty `name`, or a `name` that is not a string. Such a file has no
  name to compare. [`agent-frontmatter-schema`](agent-frontmatter-schema.md) reports a wrong type.

The rule makes no report that rests on a file that it cannot read. A read can fail for a reason
other than a missing file, such as a permission error. An agent file that the rule cannot read, or
whose frontmatter does not parse, has no name to compare. A folder that the rule cannot list gives
fewer files. That can hide a duplicate and cannot add one. The rule adds no message for this case.

Fail, `.claude/agents/a.md` and `.claude/agents/review/b.md` with `name: reviewer`:

```markdown
---
name: reviewer
description: Review code
---
```

Pass: the two files with `name: reviewer` and `name: code-reviewer`.

## Options

None.

## Sources

[^scope]: [Create custom subagents: Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)
