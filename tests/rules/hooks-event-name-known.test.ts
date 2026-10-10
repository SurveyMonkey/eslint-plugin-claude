// The same `hooks` object is in `hooks/hooks.json`, in settings, and in
// `plugin.json`, where it can also be an array of paths and objects. It is also the `hooks` field
// of skill and subagent frontmatter. A plugin file is at `plugins/p/hooks/hooks.json`, so that the
// check of the file does not depend on the name of the directory that holds the checkout.
import { describe, expect, it } from 'vitest'
import { HOOK_EVENTS } from '../../src/data/hook-events.ts'
import { FILES, frontmatter, jsonIds, markdownIds } from '../hooks.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import {
  json5Tester,
  jsonTester,
  lintJson,
  lintMarkdown,
  ruleOf,
} from '../rule-tester.test-support.ts'

const rule = ruleOf('hooks-event-name-known')
const hooks = (...events: string[]) =>
  JSON.stringify({ hooks: Object.fromEntries(events.map((e) => [e, []])) })

describe('HOOK_EVENTS', () => {
  // The hooks reference, "Hook lifecycle", lists 33 events.
  it('holds the 33 documented events, each once', () => {
    expect(HOOK_EVENTS).toHaveLength(33)
    expect(new Set(HOOK_EVENTS).size).toBe(33)
  })
})

/** One `nearMiss` report on `key`, with a rename to `event` as a
 *  suggestion. `output: null` checks that it is not an autofix. */
const renamed = (key: string, event: string, filename = 'plugins/p/hooks/hooks.json') => ({
  code: hooks('SessionStart', key),
  filename,
  output: null,
  errors: [
    {
      messageId: 'nearMiss',
      data: { key, event },
      suggestions: [{ messageId: 'rename', data: { event }, output: hooks('SessionStart', event) }],
    },
  ],
})

jsonTester.run('hooks-event-name-known', rule, {
  valid: [
    { code: hooks(...HOOK_EVENTS), filename: 'plugins/p/hooks/hooks.json' },
    { code: hooks('PreToolUse', 'Stop'), filename: '.claude/settings.json' },
    { code: JSON.stringify({ description: 'no hooks' }), filename: '.claude/settings.json' },
    {
      code: JSON.stringify({ hooks: './hooks/other.json' }),
      filename: '.claude-plugin/plugin.json',
    },
    {
      code: JSON.stringify({ hooks: ['./hooks/other.json', { PostToolUse: [] }] }),
      filename: '.claude-plugin/plugin.json',
    },
    { code: '[]', filename: 'plugins/p/hooks/hooks.json' },
    // Two `hooks` keys. The rule ignores the first, as `JSON.parse` does.
    { code: '{"hooks": {"Bogus": []}, "hooks": {"Stop": []}}', filename: '.claude/settings.json' },
    {
      code: hooks('FutureEvent'),
      filename: 'plugins/p/hooks/hooks.json',
      options: [{ additionalEvents: ['FutureEvent'] }],
    },
  ],
  invalid: [
    // Case and separator misses.
    renamed('preToolUse', 'PreToolUse'),
    renamed('pre_tool_use', 'PreToolUse', '.claude/settings.json'),
    renamed('session-end', 'SessionEnd', '.claude/settings.local.json'),
    // Spelling misses of two edits or fewer.
    renamed('PreToolUs', 'PreToolUse'),
    renamed('SesionEd', 'SessionEnd'),
    // Two changed letters.
    renamed('PreToolUxa', 'PreToolUse'),
    // One extra letter.
    renamed('PreToolUsee', 'PreToolUse'),
    // A near miss of a name from `additionalEvents`.
    {
      ...renamed('futureEvent', 'FutureEvent'),
      options: [{ additionalEvents: ['FutureEvent'] }],
    },
    {
      code: hooks('Bogus'),
      filename: 'plugins/p/hooks/hooks.json',
      errors: [
        { messageId: 'unknown', data: { key: 'Bogus' }, line: 1, column: 11, suggestions: [] },
      ],
    },
    // A known name at the end of a longer key is not a near miss.
    {
      code: hooks('MyOwnStop'),
      filename: 'plugins/p/hooks/hooks.json',
      errors: [{ messageId: 'unknown', data: { key: 'MyOwnStop' }, suggestions: [] }],
    },
    // Three edits from `PreToolUse` is not a near miss.
    {
      code: hooks('PreToolXyz'),
      filename: 'plugins/p/hooks/hooks.json',
      errors: [{ messageId: 'unknown', data: { key: 'PreToolXyz' }, suggestions: [] }],
    },
    // `additionalEvents` adds names. It does not replace the list.
    {
      code: hooks('Stop', 'Bogus'),
      filename: 'plugins/p/hooks/hooks.json',
      options: [{ additionalEvents: ['FutureEvent'] }],
      errors: [{ messageId: 'unknown', data: { key: 'Bogus' } }],
    },
    // Two `hooks` keys. `JSON.parse` keeps the last, so the rule reads it.
    {
      code: '{"hooks": {"Stop": []}, "hooks": {"Bogus": []}}',
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unknown', data: { key: 'Bogus' } }],
    },
    // Inline in `plugin.json`, as an object and in an array.
    {
      code: JSON.stringify({ name: 'p', hooks: { Bogus: [] } }),
      filename: '.claude-plugin/plugin.json',
      errors: [{ messageId: 'unknown', data: { key: 'Bogus' } }],
    },
    {
      code: JSON.stringify({ name: 'p', hooks: ['./hooks/extra.json', { Bogus: [] }] }),
      filename: '.claude-plugin/plugin.json',
      errors: [{ messageId: 'unknown', data: { key: 'Bogus' } }],
    },
  ],
})

// JSON5 allows a bare key. The rule reads it the same way.
json5Tester.run('hooks-event-name-known (JSON5)', rule, {
  valid: [{ code: '{ hooks: { Stop: [] } }' }],
  invalid: [{ code: '{ hooks: { Bogus: [] } }', errors: [{ messageId: 'unknown' }] }],
})

const name = 'hooks-event-name-known'
const yamlOf = (event: string) =>
  frontmatter(`${event}:\n  - hooks:\n      - type: command\n        command: c\n`)

// Mid-round ruling 23, item 2: the rule reads frontmatter, and skips a `hooks.json` that Claude Code
// does not read.
describe(`${name}: frontmatter`, () => {
  it('reports an unknown event and a near miss in a skill and in a project subagent', () => {
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yamlOf('Bogus'), file), file).toEqual(['unknown'])
      expect(markdownIds(name, yamlOf('preToolUse'), file), file).toEqual(['nearMiss'])
      expect(markdownIds(name, yamlOf('PreToolUse'), file), file).toEqual([])
    }
  })

  it('suggests the correct name for a near miss, as a bare YAML key', () => {
    const code = yamlOf('pre_tool_use')
    const [found] = lintMarkdown(name, code, FILES.skill)
    const fix = found?.suggestions?.[0]?.fix
    expect(found?.messageId).toBe('nearMiss')
    expect(fix).toBeDefined()
    const [start, end] = fix?.range ?? [0, 0]
    expect(code.slice(0, start) + fix?.text + code.slice(end)).toBe(yamlOf('PreToolUse'))
    expect(found?.suggestions?.[0]?.messageId).toBe('rename')
  })

  it('reports at the key', () => {
    const [found] = lintMarkdown(name, yamlOf('Bogus'), FILES.skill)
    expect([found?.line, found?.column]).toEqual([5, 3])
  })

  it('is silent in a plugin subagent, which ignores hooks, and when hooks is not an object', () => {
    expect(markdownIds(name, yamlOf('Bogus'), pluginAgent())).toEqual([])
    expect(markdownIds(name, '---\nname: s\nhooks: x\n---\n', FILES.skill)).toEqual([])
    expect(markdownIds(name, '---\nname: s\n---\n', FILES.skill)).toEqual([])
    expect(markdownIds(name, yamlOf('Bogus'), '/repo/docs/notes.md')).toEqual([])
  })
})

describe(`${name}: options and near misses`, () => {
  const lint = (options: unknown[]) =>
    lintJson(name, hooks('Stop'), '.claude/settings.json', options)

  it('throws for an option that is not documented', () => {
    expect(() => lint([{ additionalEvents: 'x' }])).toThrow()
    expect(() => lint([{ additionalEvents: [1] }])).toThrow()
    expect(() => lint([{ additionalEvents: ['A', 'A'] }])).toThrow()
    expect(() => lint([{ other: 1 }])).toThrow()
    expect(() => lint([{ additionalEvents: ['A'] }])).not.toThrow()
  })

  it('suggests the closest name, and the first of two that are as close', () => {
    // `Setp` is one edit from `Setup` and two from `Stop`.
    expect(
      lintJson(name, hooks('Setp'), '.claude/settings.json')[0]?.suggestions?.[0]?.fix.text,
    ).toBe('"Setup"')
    // `Stup` is one edit from both `Setup` and `Stop`. The list order decides.
    expect(
      lintJson(name, hooks('Stup'), '.claude/settings.json')[0]?.suggestions?.[0]?.fix.text,
    ).toBe('"Setup"')
  })
})

describe(`${name}: files that Claude Code does not read`, () => {
  it('is silent for .claude/hooks/hooks.json, which hooks-no-standalone-file reports', () => {
    const text = JSON.stringify({ hooks: { Bogus: [] } })
    expect(jsonIds(name, text, '/repo/.claude/hooks/hooks.json')).toEqual([])
    expect(jsonIds(name, text, '/repo/.github/hooks/hooks.json')).toEqual([])
    expect(jsonIds(name, text, '/repo/.claude-plugin/hooks.json')).toEqual([])
    expect(jsonIds(name, text, '/repo/.claude/hooks.json')).toEqual([])
    expect(jsonIds(name, text, '/repo/plugins/p/hooks/hooks.json')).toEqual(['unknown'])
  })

  it('reads the managed settings files, and not a hidden drop-in', () => {
    const text = JSON.stringify({ hooks: { Bogus: [] } })
    expect(jsonIds(name, text, FILES.managed)).toEqual(['unknown'])
    expect(jsonIds(name, text, FILES.dropIn)).toEqual(['unknown'])
    expect(jsonIds(name, text, FILES.hidden)).toEqual([])
  })

  it('keeps the result for settings, local settings and plugin.json', () => {
    for (const file of [FILES.project, FILES.local]) {
      expect(jsonIds(name, JSON.stringify({ hooks: { Bogus: [] } }), file), file).toEqual([
        'unknown',
      ])
    }
    expect(
      jsonIds(name, JSON.stringify({ hooks: { Bogus: [] } }), '/repo/p/.claude-plugin/plugin.json'),
    ).toEqual(['unknown'])
  })
})
