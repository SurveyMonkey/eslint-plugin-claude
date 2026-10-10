// A prompt hook on PermissionRequest cannot deny. The hooks reference, "Response schema", says that
// `ok: false` has no effect on that event (https://code.claude.com/docs/en/hooks#response-schema).
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

const name = 'hooks-prompt-on-permission-request'
const prompt = { type: 'prompt', prompt: 'Is it safe?' }
const ids = (event: string, handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [handler])), file)

describe(`${name}: the event`, () => {
  it('reports a prompt hook on PermissionRequest', () => {
    expect(ids('PermissionRequest', prompt)).toEqual(['promptOnPermissionRequest'])
  })

  it('reports each prompt hook of a group', () => {
    const text = settings(hooks('PermissionRequest', [prompt, command(), prompt]))
    expect(jsonIds(name, text, FILES.project)).toEqual([
      'promptOnPermissionRequest',
      'promptOnPermissionRequest',
    ])
  })

  it('is silent for a prompt hook on another event', () => {
    for (const event of ['PreToolUse', 'PermissionDenied', 'Stop', 'PostToolUse']) {
      expect(ids(event, prompt), event).toEqual([])
    }
  })

  it('is silent for another handler type on PermissionRequest', () => {
    for (const handler of [
      command(),
      { type: 'http', url: 'u' },
      { type: 'mcp_tool', server: 's', tool: 't' },
      { type: 'agent', prompt: 'p' },
      { command: 'c' },
      { type: 7 },
    ]) {
      expect(ids('PermissionRequest', handler), JSON.stringify(handler)).toEqual([])
    }
  })

  it('says what to use instead', () => {
    const [message] = lintJson(name, settings(hooks('PermissionRequest', [prompt])), FILES.project)
    expect(message?.message).toBe(
      'A prompt hook on PermissionRequest cannot deny: "ok": false has no effect. Use a command or http hook that returns a decision.',
    )
  })

  it('reports at the value of the type', () => {
    const text =
      '{\n  "hooks": {\n    "PermissionRequest": [{"hooks": [{"type": "prompt", "prompt": "p"}]}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 47]])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('PermissionRequest', prompt, file), file).toEqual(['promptOnPermissionRequest'])
      expect(ids('Stop', prompt, file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (event: string) =>
      frontmatter(`${event}:\n  - hooks:\n      - type: prompt\n        prompt: p\n`)
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('PermissionRequest'), file), file).toEqual([
        'promptOnPermissionRequest',
      ])
      expect(markdownIds(name, yaml('Stop'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('PermissionRequest', prompt, FILES.hidden)).toEqual([])
    expect(ids('PermissionRequest', prompt, '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
