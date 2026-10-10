// The memory keys of a settings file, with the types and values that the settings reference gives
// (https://code.claude.com/docs/en/settings-reference#automemoryenabled).
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const lint = (settings: object) =>
  lintJson('memory-settings-schema', JSON.stringify(settings), '.claude/settings.json')

describe('memory-settings-schema', () => {
  it.fails('reports an autoMemoryEnabled that is not a Boolean', () => {
    expect(lint({ autoMemoryEnabled: 'false' }).map((m) => m.messageId)).toEqual(['wrongType'])
  })

  it.fails('stays silent on a Boolean autoMemoryEnabled', () => {
    expect(lint({ autoMemoryEnabled: false })).toEqual([])
  })
})
