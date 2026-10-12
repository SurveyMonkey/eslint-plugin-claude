// The hooks guide says: "When multiple `PreToolUse` hooks return `updatedInput` to rewrite a tool's arguments,
// the last one to finish takes effect. Since hooks run in parallel, the order is non-deterministic. Avoid having
// more than one hook modify the same tool's input"
// (https://code.claude.com/docs/en/hooks-guide#limitations). The rule reads the handlers of one file. It reports a
// `PreToolUse` handler that prints `updatedInput` as a literal, when an earlier handler of the file also does so
// for a tool that both matchers name.
import { describe, expect, it } from 'vitest'
import { command, FILES, frontmatter, markdownIds, settings } from '../hooks.test-support.ts'
import { lintScript, P, unreadable } from '../hooks-output.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-multiple-updatedinput'

const rewrite = (field = 'command') =>
  `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"${field}":"ls"}}}'`
const handler = (line = rewrite(), fields: Record<string, unknown> = {}) =>
  command({ command: line, ...fields })
const group = (matcher: unknown, ...handlers: unknown[]) => ({
  ...(matcher === undefined ? {} : { matcher }),
  hooks: handlers,
})
const WITH_SCRIPT = settings({
  PreToolUse: [group('Bash', handler()), group('Bash', handler(`${P}/hooks/s.sh`))],
})
const ids = (groups: unknown[], file = FILES.project, event = 'PreToolUse') =>
  lintJson(name, settings({ [event]: groups }), file).map((message) => message.messageId)

describe(`${name}: the report`, () => {
  it('reports the second handler for Bash, in two groups', () => {
    expect(ids([group('Bash', handler()), group('Bash', handler(rewrite('x')))])).toEqual([
      'multiple',
    ])
  })

  it('reports the second handler of one group', () => {
    expect(ids([group('Bash', handler(), handler(rewrite('x')))])).toEqual(['multiple'])
  })

  it('reports each handler after the first', () => {
    expect(ids([group('Bash', handler(), handler(rewrite('x')), handler(rewrite('y')))])).toEqual([
      'multiple',
      'multiple',
    ])
  })

  it('reports matchers that name the same tool in different forms', () => {
    for (const [first, second] of [
      ['Bash', undefined],
      ['Bash', ''],
      ['Bash', '*'],
      ['Bash', 'Bash|Edit'],
      ['Edit,Bash', 'Bash'],
      ['Bash', '^Ba'],
      ['Bash', '.*'],
      ['Edit|Write', 'Write|Read'],
      ['^Notebook', 'NotebookEdit'],
      [undefined, undefined],
    ]) {
      expect(
        ids([group(first, handler()), group(second, handler(rewrite('x')))]),
        `${first} ${second}`,
      ).toEqual(['multiple'])
    }
  })

  it('names the tool in the message', () => {
    const [message] = lintJson(
      name,
      settings({ PreToolUse: [group('Bash', handler()), group('Bash', handler(rewrite('x')))] }),
      FILES.project,
    )
    expect(message?.message).toBe(
      'An earlier PreToolUse handler in this file also returns "updatedInput" for the tool Bash. The hooks run in parallel, and the last one to finish wins. Let one hook rewrite the input.',
    )
  })

  it('says every tool when both matchers select every tool', () => {
    const [message] = lintJson(
      name,
      settings({ PreToolUse: [group(undefined, handler()), group('*', handler(rewrite('x')))] }),
      FILES.project,
    )
    expect(message?.message).toContain('for every tool.')
  })

  it('reads a literal in a script', () => {
    const files = { 'hooks/s.sh': `#!/bin/bash\n${rewrite('x')}\n` }
    expect(lintScript(name, files, { event: 'PreToolUse', text: WITH_SCRIPT })).toEqual([
      'multiple',
    ])
  })

  it('reports in a plugin hooks.json', () => {
    expect(
      ids([group('Bash', handler()), group('Bash', handler(rewrite('x')))], FILES.plugin),
    ).toEqual(['multiple'])
  })
})

describe(`${name}: silent`, () => {
  it('is silent for one handler', () => {
    expect(ids([group('Bash', handler())])).toEqual([])
  })

  it('is silent for handlers that name different tools', () => {
    expect(ids([group('Bash', handler()), group('Edit', handler(rewrite('x')))])).toEqual([])
    expect(ids([group('Bash', handler()), group('^Edit', handler(rewrite('x')))])).toEqual([])
    expect(
      ids([group('Bash|Edit', handler()), group('Write|Read', handler(rewrite('x')))]),
    ).toEqual([])
  })

  it('is silent when one handler does not return updatedInput', () => {
    expect(ids([group('Bash', handler()), group('Bash', handler('./check.sh'))])).toEqual([])
    expect(
      ids([
        group('Bash', handler()),
        group('Bash', handler(`echo '{"hookSpecificOutput":{"permissionDecision":"deny"}}'`)),
      ]),
    ).toEqual([])
    expect(
      ids([group('Bash', handler()), group('Bash', handler(`echo '{"updatedInput":{}}'`))]),
    ).toEqual([])
    expect(
      ids([
        group('Bash', handler()),
        group('Bash', handler(`echo '{"hookSpecificOutput":{"updatedInput":"x"}}'`)),
      ]),
    ).toEqual([])
  })

  it('is silent for a handler with an if condition, in the background, or that goes to stderr', () => {
    expect(
      ids([group('Bash', handler()), group('Bash', handler(rewrite('x'), { if: 'Bash(git *)' }))]),
    ).toEqual([])
    expect(
      ids([
        group('Bash', handler(rewrite(), { if: 'Bash(ls *)' })),
        group('Bash', handler(rewrite('x'))),
      ]),
    ).toEqual([])
    expect(
      ids([group('Bash', handler()), group('Bash', handler(rewrite('x'), { async: true }))]),
    ).toEqual([])
    expect(ids([group('Bash', handler()), group('Bash', handler(`${rewrite('x')} >&2`))])).toEqual(
      [],
    )
  })

  it('is silent for another event', () => {
    expect(
      ids(
        [group('Bash', handler()), group('Bash', handler(rewrite('x')))],
        FILES.project,
        'PostToolUse',
      ),
    ).toEqual([])
    expect(
      ids(
        [group('Bash', handler()), group('Bash', handler(rewrite('x')))],
        FILES.project,
        'PermissionRequest',
      ),
    ).toEqual([])
  })

  it('is silent for a matcher that is no string, a regex that does not compile, and a regex that names no tool', () => {
    expect(ids([group(['Bash'], handler()), group('Bash', handler(rewrite('x')))])).toEqual([])
    expect(ids([group('(', handler()), group('(', handler(rewrite('x')))])).toEqual([])
    expect(ids([group('^Zzz', handler()), group('^Zzz', handler(rewrite('x')))])).toEqual([])
  })

  it('is silent for handlers of two files, and for a hidden drop-in', () => {
    expect(ids([group('Bash', handler())], FILES.project)).toEqual([])
    expect(
      ids([group('Bash', handler()), group('Bash', handler(rewrite('x')))], FILES.hidden),
    ).toEqual([])
  })

  it('is silent for a handler that is no command', () => {
    expect(ids([group('Bash', handler(), { type: 'http', url: 'https://x.example' })])).toEqual([])
  })

  it('is silent for a script that it cannot read', () => {
    const body = `#!/bin/bash\n${rewrite('x')}\n`
    expect(
      lintScript(name, { 'hooks/s.sh': body }, { event: 'PreToolUse', text: WITH_SCRIPT }),
    ).toEqual(['multiple'])
    for (const [what, found] of unreadable(name, body, {
      event: 'PreToolUse',
      text: WITH_SCRIPT,
    })) {
      expect(found, what).toEqual([])
    }
  })
})

// No docs page says how Claude Code reads a merge key (`<<`). A map that holds one can only hide a
// handler, so it cannot add a report.
describe(`${name}: a merge key`, () => {
  const run = `{ type: command, command: ${JSON.stringify(rewrite())} }`
  const yaml = (groups: string) =>
    markdownIds(name, frontmatter(`PreToolUse:\n${groups}`), FILES.skill)

  it('counts no handler that holds a merge key', () => {
    expect(yaml(`  - matcher: Bash\n    hooks:\n      - <<: ${run}\n      - ${run}\n`)).toEqual([])
    expect(yaml(`  - matcher: Bash\n    hooks:\n      - &r ${run}\n      - <<: *r\n`)).toEqual([])
  })

  it('reads no matcher that holds a merge key', () => {
    expect(
      yaml(
        `  - matcher: { <<: { a: 1 } }\n    hooks: [${run}]\n  - matcher: Bash\n    hooks: [${run}]\n`,
      ),
    ).toEqual([])
  })

  it('still reports two handlers beside one that holds a merge key', () => {
    expect(
      yaml(`  - matcher: Bash\n    hooks:\n      - &r ${run}\n      - <<: *r\n      - ${run}\n`),
    ).toEqual(['multiple'])
  })
})
