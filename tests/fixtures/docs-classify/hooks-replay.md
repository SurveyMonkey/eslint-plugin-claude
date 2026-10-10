# Hooks reference

## Hook lifecycle

Hooks fire at specific points during a session.

#### Common fields

These fields apply to all hook types:

| Field | Required | Description |
| :- | :- | :- |
| `type` | yes | `"command"`, `"http"`, `"mcp_tool"`, `"prompt"`, or `"agent"` |
| `if` | no | Permission rule syntax to filter when this hook runs, such as `"Bash(git *)"` or `"Edit(*.ts)"`. The hook command only runs if the tool call matches the pattern. See the [Bash matching table](#bash-if-matching) below for how Bash patterns evaluate against subcommands, `$()`, and backticks. Only evaluated on tool events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, and `PermissionDenied`. On other events, a hook with `if` set never runs. Uses the same syntax as [permission rules](/docs/en/permissions) |
| `timeout` | no | Seconds before canceling. Claude Code doesn't enforce it on a command hook you run with [`async: true`](#run-hooks-in-the-background). Defaults: 600 for `command`, `http`, and `mcp_tool`; 30 for `prompt`; 60 for `agent`. Claude Code lowers the `command`, `http`, and `mcp_tool` default to 30 on [`UserPromptSubmit`](#userpromptsubmit), [`PreModelSwitch`](#premodelswitch), and [`PostModelSwitch`](#postmodelswitch), and to 10 on [`MessageDisplay`](#messagedisplay). [`SessionEnd`](#sessionend) hooks share a 1.5-second budget; if your settings set a longer per-hook `timeout`, Claude Code raises the budget to match, up to 60 seconds |
| `statusMessage` | no | Custom spinner message displayed while the hook runs |
| `once` | no | If `true`, Claude Code removes the hook after its first successful run. A run that fails, blocks with exit code 2, or times out leaves the hook in place, so it runs again on the next matching event. Only honored for hooks declared in [skill frontmatter](#hooks-in-skills-and-agents); ignored in settings files and agent frontmatter |

The `if` field holds exactly one permission rule. There is no `&&`, `||`, or list syntax for combining rules; to apply multiple conditions, define a separate hook handler for each.

In an `if` condition for a file tool, a single-segment directory pattern like `"Edit(src/**)"` matches only the `src` directory in the working directory and the files under it. To match a directory named `src` at any depth, write `"Edit(**/src/**)"`. Before v2.1.214, `"Edit(src/**)"` matched a directory named `src` at any depth under the working directory.

<span id="bash-if-matching" />For Bash patterns, whether your hook command runs depends on the shape of the pattern and the Bash command Claude is invoking. Leading `VAR=value` assignments are stripped before matching.

| `if` pattern | Bash command | Hook runs? | Why |
| :- | :- | :- | :- |
| `Bash(git *)` | `FOO=bar git push` | yes | leading assignments are stripped; `git push` matches |
| `Bash(git *)` | `npm test && git push` | yes | each subcommand is checked; `git push` matches |
| `Bash(rm *)` | `echo $(rm -rf /)` | yes | commands inside `$()` and backticks are checked; `rm -rf /` matches |
| `Bash(rm *)` | `echo $(date)` | no | no subcommand matches `rm *` |
| `Bash(git push *)` | `echo $(date)` | yes | patterns that specify more than the command name run the hook anyway on `$()`, backticks, or `$VAR` |

When Claude Code can't determine which commands the Bash input runs, it runs your hook regardless of the pattern. Because the `if` filter is best-effort, use the [permission system](/docs/en/permissions) rather than a hook to enforce a hard allow or deny.

#### Command hook fields

In addition to the [common fields](#common-fields), command hooks accept these fields:

| Field | Required | Description |
| :- | :- | :- |
| `command` | yes | Shell command to execute. With `args`, the executable to spawn directly. See [Exec form and shell form](#exec-form-and-shell-form) |
| `args` | no | Argument list. When present, `command` is resolved as an executable and spawned directly with `args` as the argument vector, with no shell involved. See [Exec form and shell form](#exec-form-and-shell-form) |
| `async` | no | If `true`, runs in the background without blocking. See [Run hooks in the background](#run-hooks-in-the-background) |
| `asyncRewake` | no | If `true`, runs in the background and wakes Claude on exit code 2. The hook's stderr, or stdout if stderr is empty, is shown to Claude as a [system reminder](/docs/en/glossary#system-reminder) so it can react to a long-running background failure |
| `shell` | no | Shell to use for this hook. Accepts `"bash"` or `"powershell"`. Defaults to `"bash"`, or to `"powershell"` on Windows when Git Bash isn't installed. Setting `"powershell"` runs the command via PowerShell on Windows. Does not require `CLAUDE_CODE_USE_POWERSHELL_TOOL` since hooks spawn PowerShell directly. Ignored when `args` is set |
| `onFailure` | no | What happens to the action when the hook fails: `"continue"`, the default, or `"block"`. See [Block the action when a hook fails](#block-the-action-when-a-hook-fails). Requires Claude Code v2.1.295 or later |

<a id="exec-form-and-shell-form" />

#### HTTP hook fields

In addition to the [common fields](#common-fields), HTTP hooks accept these fields:

| Field | Required | Description |
| :- | :- | :- |
| `url` | yes | URL to send the POST request to |
| `headers` | no | Additional HTTP headers as key-value pairs. Values support environment variable interpolation using `$VAR_NAME` or `${VAR_NAME}` syntax. Only variables listed in `allowedEnvVars` are resolved |
| `allowedEnvVars` | no | List of environment variable names that may be interpolated into header values. References to unlisted variables are replaced with empty strings. Required for any env var interpolation to work |
| `onFailure` | no | What happens to the action when the hook fails: `"continue"`, the default, or `"block"`. See [Block the action when a hook fails](#block-the-action-when-a-hook-fails). Requires Claude Code v2.1.295 or later |

Claude Code sends the hook's [JSON input](#hook-input-and-output) as the POST request body with `Content-Type: application/json`. The response body uses the same [JSON output format](#json-output) as command hooks.

Error handling differs from command hooks; see [HTTP response handling](#http-response-handling).

This example sends `PreToolUse` events to a local validation service, authenticating with a token from the `MY_TOKEN` environment variable:

```json theme={null}
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8080/hooks/pre-tool-use",
            "timeout": 30,
            "headers": {
              "Authorization": "Bearer $MY_TOKEN"
            },
            "allowedEnvVars": ["MY_TOKEN"]
          }
        ]
      }
    ]
  }
}
```

#### Other exit codes

When your hook exits with a code other than 0 or 2 and prints plain text or nothing to stdout, the run is a [non-blocking error](#exit-code-output). You see a `<hook name> hook error` notice in the transcript with `Failed with non-blocking status code:` and the first line of your hook's stderr. For example, when a `PreToolUse` hook on `Bash` prints `something broke` to stderr and exits 1, the `PreToolUse:Bash hook error` notice carries this line:

```text theme={null}
Failed with non-blocking status code: something broke
```

To capture the full stderr rather than its first line, enable [debug logging](#debug-hooks).

A hook that can't start is a non-blocking error too. In shell form, when the script path doesn't exist or isn't executable, the shell exits with a code like 127 and the notice carries the interpreter's message, for example `Failed with non-blocking status code: /bin/sh: /path/to/hook.sh: No such file or directory`. When you set up a policy hook, watch for this notice on its first run, because a mistyped path in `settings.json` means the hook never runs. To block the action instead, set [`onFailure: "block"`](#block-the-action-when-a-hook-fails).

<Warning>
  Without valid JSON on stdout, Claude Code treats exit code 1 as a non-blocking error, even though 1 is the conventional Unix failure code. If your hook is meant to enforce a policy, use `exit 2`.
</Warning>

#### PreToolUse decision control

`PreToolUse` hooks can control whether a tool call proceeds. Unlike other hooks that use a top-level `decision` field, PreToolUse returns its decision inside a `hookSpecificOutput` object. This gives it richer control: four outcomes (allow, deny, ask, or defer) plus the ability to modify tool input before execution.

| Field | Description |
| :- | :- |
| `permissionDecision` | `"allow"` skips the permission prompt, except for the [actions no mode auto-approves](/docs/en/permission-modes#actions-no-mode-auto-approves) and for `AskUserQuestion` and `ExitPlanMode`, which need [`updatedInput` paired with it](#allow-with-updatedinput). `"deny"` prevents the tool call. `"ask"` prompts the user to confirm. `"defer"` exits gracefully so the tool can be resumed later. [Deny and ask rules](/docs/en/permissions#manage-permissions) are still evaluated regardless of what the hook returns |
| `permissionDecisionReason` | For `"ask"`, shown to the user but not Claude. For `"deny"`, shown to Claude. For `"allow"` and `"defer"`, written to the [debug log](#debug-hooks) only |
| `updatedInput` | Modifies the tool's input parameters before execution. Replaces the entire input object, so include unchanged fields alongside modified ones. Claude Code evaluates permission rules and a Bash command's [auto-background eligibility](/docs/en/tools-reference#foreground-commands-that-move-to-the-background) against the input your hook returns, not the input Claude sent. Combine with `"allow"` to auto-approve, or `"ask"` to show the modified input to the user. For `"defer"`, ignored |
| `additionalContext` | String added to Claude's context alongside the tool result. Ignored when `permissionDecision` is `"defer"`. See [Add context for Claude](#add-context-for-claude) |

When multiple PreToolUse hooks return different decisions, precedence is `deny` > `defer` > `ask` > `allow`.

A hook that blocks by exiting 2 routes the same way as `"deny"`: Claude sees the stderr message as the denial reason.

When a hook returns `"ask"`, the permission prompt displayed to the user includes a label identifying where the hook came from: `[settings]` for a hook from any settings file or from agent frontmatter, `[plugin:<name>]` for a plugin's hook, or `[skill]` for a hook from skill frontmatter. This helps users understand which configuration source is requesting confirmation.

A hook's `"ask"` also forces a permission prompt in [auto mode](/docs/en/permission-modes#eliminate-prompts-with-auto-mode): the classifier can still deny the tool call, but it can't approve the call silently. Before v2.1.211, the classifier could approve a Bash command running outside the [sandbox](/docs/en/sandboxing) without showing the prompt the hook requested; the classifier still applied its own safety rules to that command, and a hook `"deny"` was always honored.

```json theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "My reason here",
    "updatedInput": {
      "field_to_modify": "new value"
    },
    "additionalContext": "Current environment: production. Proceed with caution."
  }
}
```

<span id="allow-with-updatedinput" />

In [non-interactive mode](/docs/en/headless) with the `-p` flag, Claude Code offers `AskUserQuestion` and `ExitPlanMode` only when the run has a [permission host](/docs/en/headless#turn-off-permission-prompts-in-unattended-runs) to receive the prompt, such as an Agent SDK `canUseTool` callback. These tools require user interaction. Returning `permissionDecision: "allow"` together with `updatedInput` satisfies that requirement: the hook reads the tool's input from stdin, collects the answer through your own UI, and returns it in `updatedInput` so the tool runs without prompting. Returning `"allow"` alone is not sufficient for these tools. For `AskUserQuestion`, echo back the original `questions` array and add an [`answers`](#askuserquestion) object mapping each question's text to the chosen answer.

As of v2.1.199, an MCP tool whose server marks it with [`_meta["anthropic/requiresUserInteraction"]`](/docs/en/mcp#require-approval-for-a-specific-tool) is stricter: a hook can't skip its approval prompt with `"allow"`, with or without `updatedInput`, because Claude Code can't confirm the hook collected the interaction the tool needs.

<Note>
  PreToolUse previously used top-level `decision` and `reason` fields, but these are deprecated for this event. Use `hookSpecificOutput.permissionDecision` and `hookSpecificOutput.permissionDecisionReason` instead. The deprecated values `"approve"` and `"block"` map to `"allow"` and `"deny"` respectively. Other events like PostToolUse and Stop continue to use top-level `decision` and `reason` as their current format.
</Note>
