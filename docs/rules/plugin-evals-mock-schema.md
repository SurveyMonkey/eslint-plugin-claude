---
type: Reference
description: The ESLint rule claude/plugin-evals-mock-schema, which reports an eval mock file with a type other than fixed or agent, an error key on an agent mock, or an abort_when key on a fixed mock, because the docs allow each key with one type only.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/plugin-evals-mock-schema

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/mocks/*/*.md` |

## Rule details

An eval run can answer the MCP tool calls of a plugin from mock files, one file for each tool, in
`mocks/<server>/<tool>.md`. The frontmatter of a mock file takes four keys, and `_server.md` also takes `tools`.[^files]

- `type` is `fixed` or `agent`. The default is `fixed`.
- `expect` guards the input of a call.
- `error` is `false` by default. The docs list it as "`fixed` only".
- `abort_when` is unset by default. The docs list it as "`agent` only".

The rule reports these faults:

- A `type` that is not `fixed` or `agent`, on the value. The rule then reads no other key.
- `error: true` on a mock with `type: agent`, on the key.
- `abort_when` on a mock that is `fixed`, on the key. A mock with no `type` is `fixed`, except `_server.md`.

The rule does not report `error: false` or an empty `error`, because they have no effect. It does not
read `expect`.

The file `_server.md` is one agent mock that answers several tools. Its `tools` key lists them.[^files]
The docs call it "a single `type: agent` mock". So a `_server.md` with no `type` is an `agent` mock,
and the rule reports `error: true` in it. A `type` that the file sets wins. Any other file with no
`type` is `fixed`.

### Which files the rule reads

The glob is `**/mocks/*/*.md`. The rule reads a file only when it sits directly in a server directory
`mocks/<server>/`, in a case or in the eval directory of a plugin. The eval directory is `evals/`, or
the path in `experimental.evals` of the manifest.[^dir] The rule finds the plugin by the nearest
`.claude-plugin/plugin.json` above the file. The walk stops at the repository root. The rule makes no
report in these cases:

- The file is in `mocks/.replay/`, which holds the saved answers of agent mocks, or in a folder
  below the server directory, such as `fixtures/`.
- The `mocks/` directory is in a folder that is no case, and not the eval directory.
- The frontmatter block does not parse, or it is not a map.
- The rule cannot see the plugin. The plugin root, the manifest, or the eval directory can be
  missing, or out of the repository (ADR 001, Decision 14). The manifest can fail to parse.
- The repository has no `.git` entry at or above the file. The walk then checks the folder of
  the file only.

`claude plugin validate` passes a mock with these faults (checked on Claude Code 2.1.296).

Fail: a mock with `type: agent` and `error: true`.

Pass: a mock with `type: fixed` and `error: true`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-evals-mock-schema': 'error'
```

## Sources

[^files]: [Test plugins with evals: Mock files](https://code.claude.com/docs/en/plugin-evals#mock-files)
[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
