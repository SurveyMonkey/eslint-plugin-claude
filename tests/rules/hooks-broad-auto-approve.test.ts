// A hook can answer a permission prompt. `PermissionRequest` returns `decision.behavior: "allow"`, and
// `PreToolUse` returns `permissionDecision: "allow"`. The hooks guide says: "Keep the matcher as narrow as
// possible. Matching on `.*` or leaving the matcher empty would auto-approve every tool permission prompt"
// (https://code.claude.com/docs/en/hooks-guide#auto-approve-specific-permission-prompts). A `setMode` entry
// can switch the session to `bypassPermissions`
// (https://code.claude.com/docs/en/hooks#permission-update-entries). A script output is not in the file, so
// the rule reads the JSON that the inline command text holds.
import { describe, expect, it } from 'vitest'
import { command, FILES, frontmatter, hooks, markdownIds, settings } from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-broad-auto-approve'
const allowRequest =
  'echo \'{"hookSpecificOutput": {"hookEventName": "PermissionRequest", "decision": {"behavior": "allow"}}}\''
const allowTool =
  'echo \'{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}\''
const bypass =
  'echo \'{"hookSpecificOutput": {"decision": {"behavior": "deny", "updatedPermissions": [{"type": "setMode", "mode": "bypassPermissions", "destination": "session"}]}}}\''

const ids = (
  event: string,
  line: string,
  matcher?: unknown,
  fields: Record<string, unknown> = {},
  file = FILES.project,
) =>
  lintJson(
    name,
    settings(hooks(event, [command({ command: line, ...fields })], matcher)),
    file,
  ).map((message) => message.messageId)

describe(`${name}: an allow decision`, () => {
  it.fails('reports PermissionRequest allow under an omitted, empty, star or dot-star matcher', () => {
    for (const matcher of [undefined, '', '*', '.*']) {
      expect(ids('PermissionRequest', allowRequest, matcher), String(matcher)).toEqual(['allow'])
    }
  })

  it.fails('reports PreToolUse allow under a broad matcher', () => {
    for (const matcher of [undefined, '', '*', '.*']) {
      expect(ids('PreToolUse', allowTool, matcher), String(matcher)).toEqual(['allow'])
    }
  })

  it.fails('reads the decision in exec form and with escaped quotes', () => {
    expect(
      lintJson(
        name,
        settings(
          hooks(
            'PreToolUse',
            [{ type: 'command', command: 'printf', args: ['{"permissionDecision":"allow"}'] }],
            '*',
          ),
        ),
        FILES.project,
      ),
    ).toHaveLength(1)
    expect(ids('PreToolUse', 'echo {\\"permissionDecision\\":\\"allow\\"}', '*')).toEqual(['allow'])
  })

  it.fails('names the event in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PermissionRequest', [command({ command: allowRequest })])),
      FILES.project,
    )
    expect(message?.message).toBe(
      'This PermissionRequest hook allows the call under a matcher that matches every tool. It approves every prompt, including file writes and shell commands. Narrow the matcher to the tools that you trust.',
    )
  })

  it.fails('is silent under a narrow matcher', () => {
    for (const matcher of ['Bash', 'ExitPlanMode', 'Edit|Write', '^Bash$']) {
      expect(ids('PermissionRequest', allowRequest, matcher), matcher).toEqual([])
      expect(ids('PreToolUse', allowTool, matcher), matcher).toEqual([])
    }
  })

  it.fails('is silent when the handler sets an if condition', () => {
    expect(ids('PreToolUse', allowTool, '*', { if: 'Bash(git status)' })).toEqual([])
  })

  it.fails('is silent for the allow of the other event, and for deny', () => {
    expect(ids('PermissionRequest', allowTool, '*')).toEqual([])
    expect(ids('PreToolUse', allowRequest, '*')).toEqual([])
    expect(ids('PreToolUse', allowTool.replace('allow', 'deny'), '*')).toEqual([])
    expect(ids('PostToolUse', allowTool, '*')).toEqual([])
  })

  it.fails('is silent for a matcher that is no string', () => {
    expect(ids('PreToolUse', allowTool, ['*'])).toEqual([])
  })
})

describe(`${name}: setMode`, () => {
  it.fails('reports a setMode entry to bypassPermissions under any matcher', () => {
    expect(ids('PermissionRequest', bypass, 'Bash')).toEqual(['bypass'])
    expect(ids('PermissionRequest', bypass)).toEqual(['bypass'])
  })

  it.fails('reports one message for a broad allow that also sets the mode', () => {
    const both = `${allowRequest} ${bypass}`
    expect(ids('PermissionRequest', both, '*')).toEqual(['bypass'])
  })

  it.fails('names the mode in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PermissionRequest', [command({ command: bypass })], 'Bash')),
      FILES.project,
    )
    expect(message?.message).toBe(
      'This hook sets the permission mode to bypassPermissions with a setMode entry. It turns off the permission prompts of the session, if the session can use that mode.',
    )
  })

  it.fails('is silent for another mode and for a mode key of another name', () => {
    expect(
      ids('PermissionRequest', bypass.replace('bypassPermissions', 'acceptEdits'), 'Bash'),
    ).toEqual([])
    expect(ids('PermissionRequest', 'echo defaultMode bypassPermissions', 'Bash')).toEqual([])
    expect(
      ids('PermissionRequest', 'echo \'{"defaultMode":"bypassPermissions"}\'', 'Bash'),
    ).toEqual([])
  })
})

describe(`${name}: the handler`, () => {
  it.fails('is silent for a handler that is no command hook', () => {
    expect(
      lintJson(
        name,
        settings(hooks('PreToolUse', [{ type: 'prompt', command: allowTool }], '*')),
        FILES.project,
      ),
    ).toEqual([])
    expect(ids('PreToolUse', 5 as never, '*')).toEqual([])
  })

  it.fails('is silent for a script, which the file does not show', () => {
    expect(ids('PreToolUse', './approve.sh', '*')).toEqual([])
  })

  it.fails('reports in each file, a skill and a project agent', () => {
    for (const file of [FILES.local, FILES.managed, FILES.dropIn, FILES.plugin]) {
      expect(ids('PreToolUse', allowTool, '*', {}, file), file).toEqual(['allow'])
    }
    const text = frontmatter(
      `PreToolUse:\n  - matcher: "*"\n    hooks:\n      - type: command\n        command: ${JSON.stringify(allowTool)}\n`,
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['allow'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['allow'])
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(ids('PreToolUse', allowTool, '*', {}, FILES.hidden)).toEqual([])
  })
})
