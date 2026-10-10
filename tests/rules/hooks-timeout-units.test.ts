// The `timeout` of a hook handler is in seconds
// (https://code.claude.com/docs/en/hooks#common-fields). The docs give no upper limit, and the default is
// 600 seconds for a command hook. The rule reports a value at or above the option `millisecondsFrom`,
// which a person more likely wrote in milliseconds. The option has no docs default, so its value is
// the choice of the plugin: 1000.
import { describe, expect, it } from 'vitest'
import {
  command,
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  markdownIds,
  SETTINGS,
  settings,
} from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-timeout-units'
const ids = (timeout: unknown, file = FILES.project, options: unknown[] = []) =>
  lintJson(name, settings(hooks('PostToolUse', [command({ timeout })])), file, options).map(
    (message) => message.messageId,
  )

describe(`${name}: the report`, () => {
  it('reports 5000, and the default limit of 1000', () => {
    expect(ids(5000)).toEqual(['units'])
    expect(ids(1000)).toEqual(['units'])
  })

  it('reports in every file that holds hooks', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(5000, file), file).toEqual(['units'])
    }
    const text = frontmatter(
      'PostToolUse:\n  - hooks:\n      - type: command\n        command: ./a.sh\n        timeout: 5000\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['units'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['units'])
  })

  it('reports a handler of any type', () => {
    for (const type of ['command', 'http', 'mcp_tool', 'prompt', 'agent']) {
      const text = settings(hooks('PostToolUse', [{ type, timeout: 5000 }]))
      expect(jsonIds(name, text, FILES.project), type).toEqual(['units'])
    }
  })

  it('names the value and the value in seconds, at the number', () => {
    const text =
      '{\n  "hooks": {"PostToolUse": [{"hooks": [{"type": "command", "command": "a", "timeout": 5000}]}]}\n}'
    const [message] = lintJson(name, text, FILES.project)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['units', 2, 87])
    expect(message?.message).toBe(
      '"timeout" is in seconds, so 5000 waits for 5000 seconds. For milliseconds, write 5.',
    )
  })

  it('rounds the suggestion, and keeps it at 1 second or more', () => {
    expect(
      lintJson(name, settings(hooks('Stop', [command({ timeout: 1500 })])), FILES.project)[0]
        ?.message,
    ).toContain('write 2.')
  })

  it('reports from the configured limit, and names it', () => {
    expect(ids(300, FILES.project, [{ millisecondsFrom: 300 }])).toEqual(['limit'])
    expect(
      lintJson(name, settings(hooks('Stop', [command({ timeout: 400 })])), FILES.project, [
        { millisecondsFrom: 300 },
      ])[0]?.message,
    ).toBe('"timeout" is 400 seconds, which is at or above the configured limit of 300 seconds.')
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for 30, 600 and 999', () => {
    for (const value of [30, 600, 999, 0, 1.5]) {
      expect(ids(value), String(value)).toEqual([])
    }
  })

  it('is silent below the configured limit, and at the default when the limit is higher', () => {
    expect(ids(299, FILES.project, [{ millisecondsFrom: 300 }])).toEqual([])
    expect(ids(5000, FILES.project, [{ millisecondsFrom: 10000 }])).toEqual([])
  })

  it('is silent for a timeout that is no number', () => {
    for (const value of ['5000', null, true, [5000]]) {
      expect(ids(value), JSON.stringify(value)).toEqual([])
    }
  })

  it('is silent when the handler has no timeout', () => {
    expect(jsonIds(name, settings(hooks('Stop', [command()])), FILES.project)).toEqual([])
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids(5000, FILES.hidden)).toEqual([])
  })
})

describe(`${name}: the option`, () => {
  it('refuses a limit below 1 and an unknown option', () => {
    expect(() => ids(1, FILES.project, [{ millisecondsFrom: 5 }])).not.toThrow()
    expect(() => ids(1, FILES.project, [{ millisecondsFrom: 0 }])).toThrow()
    expect(() => ids(1, FILES.project, [{ other: 1 }])).toThrow()
  })
})
