---
type: Reference
description: The ESLint rule claude/claude-md-git-instructions, off in recommended and warn in strict, which reports a CLAUDE.md or rule file that sets commit or pull request rules when the project .claude/settings.json does not set includeGitInstructions to false, because the built-in git instructions of Claude Code then compete with those rules.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-git-instructions`

Turn off the built-in git instructions when a CLAUDE.md sets commit or pull request rules.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/CLAUDE.md`, `**/.claude/rules/**/*.md` |

The rule is `off` in `recommended`.

## Rule details

Claude Code adds its own commit and pull request instructions. The docs say that when your
CLAUDE.md sets commit or pull request rules, you turn the built-in ones off with the setting
`includeGitInstructions`, and set the attribution text with `attribution`.[^compete] The variable
`CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` set to `1` removes them too, and it takes precedence over the
setting.[^variable] The two sets of instructions can disagree, and then Claude can follow either one.

The rule reports a `CLAUDE.md`, a `.claude/CLAUDE.md` or a rule file when both of these are true:

- A paragraph or a heading has a sentence that names a git topic and has an instruction cue. The
  topics are, for example, a commit message, style, format or title, `Conventional Commits`, a pull request, a
  PR title, description, body or template, `gh pr create`, `git commit`, `Co-Authored-By`,
  `Signed-off-by` and `squash`. The cues are words such as `must`, `should`, `always`, `never`,
  `use`, `write`, `follow`, `include`, `keep`, `add` and `run`.
- The project settings do not set `includeGitInstructions` to `false`, and do not set
  `env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` to `1`.

The rule reports once for each file, on the first such sentence. It reads the file
`.claude/settings.json` of the folder that holds the instruction file, and of each folder above it,
up to the repository root. For a file in a `.claude` folder, the first folder is the one that holds
`.claude`. One file that sets the key to `false`, or the variable to `1`, is enough. The variable
silences the rule even when `includeGitInstructions` is `true`.

The rule makes no report in these cases:

- The sentence is in a fenced block, an indented code block or an HTML comment.
- The sentence has no cue, or names no git topic. `Run npm test before you commit` is not a git
  rule.
- A settings file in the chain cannot be read: the JSON does not parse, the top level is not an
  object, the read fails, or the path is a link that leads nowhere or out of the repository. That
  file can hold the key.
- The file is a `CLAUDE.local.md`, an `AGENTS.md` or any other file.

The rule is a heuristic, and it reads only part of the places that can set the key. A user file
(`~/.claude/settings.json`) can set it, and so can the local file `.claude/settings.local.json`.
The rule reads neither. The user file is out of the repository. So the rule can report on a
repository whose users have turned the instructions off by their own settings. It also reads
words, so a sentence can match that does not set a rule.

Fail:

```markdown
Write commit messages in the imperative mood.
```

Pass, with this in `.claude/settings.json`:

```json
{ "includeGitInstructions": false }
```

## Sources

[^compete]: [How Claude remembers your project: Claude isn't following my CLAUDE.md](https://code.claude.com/docs/en/memory#claude-isnt-following-my-claude-md)
[^variable]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
