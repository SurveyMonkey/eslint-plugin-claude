// `disableAllHooks: false` in the committed `.claude/settings.json` overrides a `true` in the user
// settings of each person who clones the repository, and turns their hooks back on. The hooks
// reference says so (https://code.claude.com/docs/en/hooks#disable-or-remove-hooks). A person who
// reads the rule on the local file, the managed files or a plugin file gets no report.
import { describe, expect, it } from 'vitest'
import { FILES } from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-disable-all-override'
const ids = (text: string, file = FILES.project) =>
  lintJson(name, text, file).map((message) => message.messageId)

describe(`${name}: the project file`, () => {
  it.fails('reports disableAllHooks false', () => {
    expect(ids('{"disableAllHooks": false}')).toEqual(['override'])
    expect(
      ids('{"hooks": {}, "disableAllHooks": false}', '/repo/pkg/.claude/settings.json'),
    ).toEqual(['override'])
  })

  it.fails('reads the last of two members, as JSON.parse does', () => {
    expect(ids('{"disableAllHooks": true, "disableAllHooks": false}')).toEqual(['override'])
    expect(ids('{"disableAllHooks": false, "disableAllHooks": true}')).toEqual([])
  })

  it.fails('is silent for true, a missing key and a value of another type', () => {
    for (const text of [
      '{"disableAllHooks": true}',
      '{}',
      '{"hooks": {}}',
      '{"disableAllHooks": "false"}',
      '{"disableAllHooks": 0}',
      '{"disableAllHooks": null}',
      '[]',
    ]) {
      expect(ids(text), text).toEqual([])
    }
  })

  it.fails('reports at the value', () => {
    const found = lintJson(name, '{\n  "disableAllHooks": false\n}', FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[2, 3]])
  })

  it.fails('names the effect in the message', () => {
    const [message] = lintJson(name, '{"disableAllHooks": false}', FILES.project)
    expect(message?.message).toBe(
      'The committed "disableAllHooks": false overrides the user setting of each person who clones the repository, and turns their hooks back on. Remove the key.',
    )
  })
})

describe(`${name}: the other files`, () => {
  it.fails('is silent in the local file, the managed files and a plugin file', () => {
    for (const file of [
      FILES.local,
      FILES.managed,
      FILES.dropIn,
      FILES.hidden,
      FILES.plugin,
      '/repo/pkg/.claude/settings.local.json',
      '/repo/managed-settings.d/settings.json',
    ]) {
      expect(ids('{"disableAllHooks": false}', file), file).toEqual([])
    }
  })
})
