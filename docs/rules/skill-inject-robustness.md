---
type: Reference
description: The ESLint rule claude/skill-inject-robustness, which reports an injected command in a skill or command file that no allowed-tools Bash rule matches, that uses a relative script path, that is a check script with no fallback, or that prints a placeholder, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-inject-robustness`

Make the injected commands of a skill robust.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | load | `**/SKILL.md`, `**/commands/**/*.md` |

The rule is `off` in `recommended`. The rule is a heuristic: it reads each command as text.

## Rule details

A skill can run a command when it loads, with `` !`command` `` or a ```` ```! ```` block. A failed
command aborts the whole skill invocation, and Claude never sees the skill content.[^fails] The
rule reports four faults. Each report is on the code span or on the fence.

- `unmatched`: no `allowed-tools` Bash rule matches the command. Injected commands never prompt.
  Outside auto mode, a command whose permission check does not return allow aborts the
  invocation. `allowed-tools` pre-approves a command.[^permission]
- `relativePath`: a script path that depends on the working directory. Commands run in the
  current directory of the session shell, and that directory moves when Claude runs `cd`. The docs
  say to use `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PROJECT_DIR}` in paths that must resolve the same
  way every time.[^run]
- `checkExit`: the last command is a check script, and it has no fallback. With the default
  `bash` shell, any non-zero exit code is a failure. The docs say to append `|| true` to a command
  that exits non-zero by design. A check script that exits 1 on a finding is an
  example.[^fails]
- `nested`: the command text has `` !` ``. Claude Code inserts the output of a command as plain
  text. It does not scan the output for another placeholder.[^inject] So a command cannot print a
  placeholder for a later pass to expand.

A command is one of two things. It is the code span after `!` at the start of a line or after
whitespace. Or it is the text of a fence with the info string `!`. A placeholder in another place
stays literal text. [`skill-inject-bang-position`](skill-inject-bang-position.md) reports it, and
the rule skips it.

### How the rule reads a command

The rule splits a command at `&&`, `||`, `;`, `|`, `|&`, `&` and a line break. These are the
separators that the permissions page names.[^compound] A separator in a quoted string does not
split. A separator in a redirection such as `2>&1` does not split. A line break after a backslash
does not split.

For `unmatched`, each subcommand needs a rule. A rule matches the whole subcommand. A `*` stands
for any text. A ` *` at the end, as the only `*`, also matches the bare command. `:*` at the end is
the same as ` *`.[^wildcard]

A bare `Bash` or `Bash(*)` matches every command. The rule reads the
`allowed-tools` field only, as a string or a YAML list. It does not read `disallowed-tools` or a
settings file.

The rule skips a subcommand in these cases:

- Its first word is `ls`, `cat`, `echo`, `pwd`, `head`, `tail`, `grep`, `find`, `wc`, `which`,
  `diff`, `stat`, `du` or `cd`. The permissions page says that the set of read-only commands
  includes these names.[^readonly] The page does not list the whole set. So the rule skips only
  the names that the page gives, with any flags.

  The page says that `cd` is read-only only in the working directory. It says that a write-capable
  flag, such as `find -delete`, can prompt. The rule skips these too, so it can miss a real
  fault.
- It is `true` or `:`. These are the no-ops of a fallback such as `|| true`.
- Its first word is `git`. The page says only that "read-only forms of `git`" are in the set. The
  rule cannot tell them from the other forms.
- It starts with a wrapper that Claude Code strips before it matches a rule. The wrappers are
  `timeout`, `time`, `nice`, `nohup`, `stdbuf`, `command`, `builtin`, `noglob` and
  `xargs`.[^compound] The rule does not strip them.
- It starts with a variable assignment such as `NODE_ENV=test`. Claude Code strips only
  known-safe variables, so the rule can miss a real fault here.[^compound]
- It is a word that ends a block: `fi`, `done` or `esac`. It can also be a `for` head, a test that
  starts with `[`, or a `)` or `}` that ends a group. The rule drops a comment line before it splits the
  text.

The rule drops some words from the start of a subcommand, and judges the rest. These are `if`,
`then`, `else`, `elif`, `do`, `while`, `until`, `!`, `(` and `{`. They also include the head of a
`case` and the pattern of a `case` arm. A block word alone on its line leaves nothing to judge. A command inside a block is judged
like any other command.

The rule makes no `unmatched` report in these cases:

- The frontmatter does not parse, so the rule does not know the rules.
- The `shell` key is `powershell`. The commands can then need `PowerShell` rules. The `checkExit`
  report is also off, because `|| true` is a Bash form.

The rule does report when the skill has no `allowed-tools` and the command is not read-only. A
`permissions.allow` rule in a settings file also allows a command, and the rule does not read
settings. Use the option `allow` for these rules, or turn the rule on where the team keeps its
rules in `allowed-tools`.

For `relativePath`, the rule looks at one path of each subcommand. The path is the program when it
has a `/`. Or it is the first argument of `bash`, `sh`, `zsh`, `node`, `python`, `python3`, `ruby`
or `perl`. That argument must be no flag, and it must have a `/` or a script extension.

A path that starts with `/`, `~` or `$` is not relative. A `${CLAUDE_PLUGIN_ROOT}` path passes here. An
unbraced plugin variable is for [`skill-plugin-path-vars`](skill-plugin-path-vars.md).

For `checkExit`, the rule looks at the last subcommand that is not a word that ends a block, such as `fi`.
Its script path must have a file name with the word `check`, `lint`, `verify` or `validate`. The
word must not be part of a longer word, so `checker.sh` and `recheck.sh` pass. A check script
passes when `|| true`, `|| :`, a pipe or another command follows it. The last subcommand sets the
exit code. The rule cannot tell which other scripts exit with 1, so it does not check them.

## Options

`allow` is a list of permission rules. It has the grammar of `allowed-tools`, for example
`Bash(npm *)`. The rule treats each Bash rule in the list as allowed, as if every skill named it
in `allowed-tools`. A string that is not a Bash rule has no effect. The list has unique, non-empty
strings.

The default is an empty list. Copy the Bash rules of the user settings here, because the
rule reads no settings file.[^permission]

## Examples

Fail:

````markdown
---
allowed-tools: Bash(gh *)
---

- Tests: !`npm test`
- Lint: !`./scripts/check.sh`
````

Pass:

````markdown
---
allowed-tools: Bash(gh *), Bash(npm *), Bash(${CLAUDE_SKILL_DIR}/scripts/check.sh)
---

- Tests: !`npm test`
- Lint: !`${CLAUDE_SKILL_DIR}/scripts/check.sh || true`
````

The rule checks a `SKILL.md` in a project and in a plugin, and a command file. It makes no report
for a plugin root that it cannot see.

## Sources

[^fails]: [Extend Claude with skills: When an injected command fails](https://code.claude.com/docs/en/skills#when-an-injected-command-fails)
[^permission]: [Extend Claude with skills: Permission checks on injected commands](https://code.claude.com/docs/en/skills#permission-checks-on-injected-commands)
[^run]: [Extend Claude with skills: How injected commands run](https://code.claude.com/docs/en/skills#how-injected-commands-run)
[^inject]: [Extend Claude with skills: Inject dynamic context](https://code.claude.com/docs/en/skills#inject-dynamic-context)
[^compound]: [Configure permissions: Compound commands](https://code.claude.com/docs/en/permissions#compound-commands)
[^wildcard]: [Configure permissions: Wildcard patterns](https://code.claude.com/docs/en/permissions#wildcard-patterns)
[^readonly]: [Configure permissions: Read-only commands](https://code.claude.com/docs/en/permissions#read-only-commands)
