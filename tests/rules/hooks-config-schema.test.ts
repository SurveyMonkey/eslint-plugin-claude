// The shape of the hooks config: event, matcher group, handler. The shapes are those of the
// hooks reference (https://code.claude.com/docs/en/hooks#configuration). `lintJson` and
// `lintMarkdown` run the rule at a path, so each case names the kind of file.
import { describe, expect, it } from 'vitest'
import {
  command,
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  lintJson5,
  markdownIds,
  SETTINGS,
  settings,
} from '../hooks.test-support.ts'
import { pluginAgent, pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintJson, lintMarkdown } from '../rule-tester.test-support.ts'

const name = 'hooks-config-schema'
const ids = (value: unknown, file = FILES.project) => jsonIds(name, settings(value), file)
const pluginIds = (value: unknown) => jsonIds(name, JSON.stringify(value), FILES.plugin)

describe(`${name}: a valid config`, () => {
  it('is silent for each handler type, in every settings file and in hooks.json', () => {
    const value = {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            command({ if: 'Bash(rm *)', args: [], timeout: 30, statusMessage: 'Checking' }),
            command({ shell: 'powershell', async: true, asyncRewake: false, onFailure: 'block' }),
            { type: 'http', url: 'http://localhost:8080/hook', headers: {}, allowedEnvVars: ['T'] },
            { type: 'mcp_tool', server: 'my_server', tool: 'scan', input: { file: 'a.ts' } },
            {
              type: 'prompt',
              prompt: 'Is it safe? $ARGUMENTS',
              model: 'haiku',
              continueOnBlock: true,
            },
            { type: 'agent', prompt: 'Verify the tests pass.', timeout: 120, once: true },
          ],
        },
      ],
    }
    for (const file of SETTINGS) {
      expect(ids(value, file), file).toEqual([])
    }
    expect(pluginIds({ hooks: value })).toEqual([])
  })

  it('is silent when the file has no hooks, or hooks is null', () => {
    expect(jsonIds(name, '{}', FILES.project)).toEqual([])
    expect(jsonIds(name, '{"hooks": null}', FILES.project)).toEqual([])
    expect(jsonIds(name, '[1]', FILES.project)).toEqual([])
  })

  it('leaves an event name and a handler field that it does not know to other rules', () => {
    expect(ids({ Bogus: [] })).toEqual([])
    expect(ids({ preToolUse: [] })).toEqual([])
    expect(ids(hooks('Stop', [command({ made_up: 1 })]))).toEqual([])
  })

  it('reads the last of two hooks keys', () => {
    expect(jsonIds(name, '{"hooks": [], "hooks": {}}', FILES.project)).toEqual([])
    expect(jsonIds(name, '{"hooks": {}, "hooks": []}', FILES.project)).toEqual(['notObject'])
  })

  it('reads the last of two events of one name', () => {
    const early = '{"hooks": {"Stop": 1, "Stop": []}}'
    expect(jsonIds(name, early, FILES.project)).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids([], FILES.hidden)).toEqual([])
  })
})

describe(`${name}: the hooks value`, () => {
  it('reports a hooks value that is not an object', () => {
    for (const value of [[], 'Stop', 1, true]) {
      expect(ids(value), JSON.stringify(value)).toEqual(['notObject'])
    }
  })

  it('reports an event whose value is not an array', () => {
    expect(ids({ Stop: {} })).toEqual(['eventNotArray'])
    expect(ids({ Stop: 'x', PreToolUse: [] })).toEqual(['eventNotArray'])
  })

  it('reports a matcher group that is not an object', () => {
    expect(ids({ Stop: ['x'] })).toEqual(['groupNotObject'])
    expect(ids({ Stop: [[]] })).toEqual(['groupNotObject'])
  })

  it('reports a group with no handlers array', () => {
    expect(ids({ Stop: [{ matcher: 'x' }] })).toEqual(['handlersMissing'])
    expect(ids({ Stop: [{ hooks: {} }] })).toEqual(['handlersMissing'])
  })

  it('reports a handler that is not an object', () => {
    expect(ids({ Stop: [{ hooks: ['./a.sh'] }] })).toEqual(['handlerNotObject'])
  })

  it('reports each fault at its own place, in order', () => {
    const text = '{\n  "hooks": {\n    "Stop": 1,\n    "SessionEnd": [{}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['eventNotArray', 3, 13],
      ['handlersMissing', 4, 20],
    ])
  })
})

describe(`${name}: the matcher`, () => {
  it('is silent for a string, an empty string and an omitted matcher', () => {
    expect(ids(hooks('PreToolUse', [command()], 'Edit|Write'))).toEqual([])
    expect(ids(hooks('PreToolUse', [command()], ''))).toEqual([])
    expect(ids(hooks('PreToolUse', [command()]))).toEqual([])
  })

  it('says that no other hook of the file loads for an array under PreToolUse', () => {
    for (const event of ['PreToolUse', 'PermissionRequest']) {
      expect(ids(hooks(event, [command()], ['Edit', 'Write'])), event).toEqual([
        'matcherArrayWholeFile',
      ])
    }
  })

  it('reports an array under another event without that claim', () => {
    expect(ids(hooks('PostToolUse', [command()], ['Edit']))).toEqual(['matcherArray'])
  })

  it('reports a matcher of another type', () => {
    expect(ids(hooks('PreToolUse', [command()], 5))).toEqual(['matcherType'])
    expect(ids(hooks('PreToolUse', [command()], null))).toEqual(['matcherType'])
  })
})

describe(`${name}: the handler`, () => {
  it('reports a missing type, and a type that is not one of the five', () => {
    expect(ids(hooks('Stop', [{ command: './a.sh' }]))).toEqual(['typeMissing'])
    expect(ids(hooks('Stop', [command({ type: 'script' })]))).toEqual(['typeInvalid'])
    expect(ids(hooks('Stop', [command({ type: 5 })]))).toEqual(['typeInvalid'])
    expect(ids(hooks('Stop', [command({ type: 'Command' })]))).toEqual(['typeInvalid'])
  })

  it('reports the field that each type needs', () => {
    const missing = (handler: object) => {
      const found = lintJson(name, settings(hooks('Stop', [handler])), FILES.project)
      return found.map((message) => [message.messageId, message.message])
    }
    expect(missing({ type: 'command' })).toEqual([
      ['fieldMissing', 'The "command" hook type needs the field "command".'],
    ])
    expect(missing({ type: 'http' })).toEqual([
      ['fieldMissing', 'The "http" hook type needs the field "url".'],
    ])
    expect(missing({ type: 'mcp_tool' })).toEqual([
      ['fieldMissing', 'The "mcp_tool" hook type needs the field "server".'],
      ['fieldMissing', 'The "mcp_tool" hook type needs the field "tool".'],
    ])
    expect(missing({ type: 'prompt' })).toEqual([
      ['fieldMissing', 'The "prompt" hook type needs the field "prompt".'],
    ])
    expect(missing({ type: 'agent' })).toEqual([
      ['fieldMissing', 'The "agent" hook type needs the field "prompt".'],
    ])
  })

  it('reports a field of the wrong type once, not as missing too', () => {
    const cases: [object, string][] = [
      [command({ command: 5 }), 'fieldType'],
      [command({ timeout: '30' }), 'fieldType'],
      [command({ async: 'yes' }), 'fieldType'],
      [command({ once: 1 }), 'fieldType'],
      [command({ args: './a.sh' }), 'fieldType'],
      [command({ args: ['a', 1] }), 'fieldType'],
      [command({ if: ['Bash'] }), 'fieldType'],
      [{ type: 'http', url: 'http://x.test', headers: ['a'] }, 'fieldType'],
      [{ type: 'http', url: 'http://x.test', allowedEnvVars: 'T' }, 'fieldType'],
      [{ type: 'mcp_tool', server: 's', tool: 't', input: 'x' }, 'fieldType'],
      [{ type: 'prompt', prompt: 'p', continueOnBlock: 'true' }, 'fieldType'],
    ]
    for (const [handler, id] of cases) {
      expect(ids(hooks('Stop', [handler])), JSON.stringify(handler)).toEqual([id])
    }
  })

  it('names the field and the expected type in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ timeout: '30' })])),
      FILES.project,
    )
    expect(message?.message).toBe('The "timeout" field must be a number.')
    const [list] = lintJson(name, settings(hooks('Stop', [command({ args: 'x' })])), FILES.project)
    expect(list?.message).toBe('The "args" field must be an array of strings.')
  })

  it('reports a shell or onFailure value that is not documented', () => {
    for (const handler of [command({ shell: 'zsh' }), command({ onFailure: 'abort' })]) {
      expect(ids(hooks('Stop', [handler])), JSON.stringify(handler)).toEqual(['fieldValue'])
    }
    expect(ids(hooks('Stop', [command({ shell: 5 })]))).toEqual(['fieldValue'])
    expect(ids(hooks('Stop', [command({ shell: 'bash', onFailure: 'continue' })]))).toEqual([])
  })
})

describe(`${name}: hooks.json of a plugin`, () => {
  it('is silent for a description, a $schema and a modules path', () => {
    const value = hooks('SessionStart', [command()], 'startup')
    expect(pluginIds({ description: 'd', $schema: 'https://x.test/s.json', hooks: value })).toEqual(
      [],
    )
    expect(pluginIds({ description: 'A mod', modules: ['./register.js'] })).toEqual([])
    expect(pluginIds({ modules: ['./register.js'], hooks: value })).toEqual([])
  })

  it('reports a file that is not an object', () => {
    expect(pluginIds([])).toEqual(['fileNotObject'])
    expect(pluginIds('x')).toEqual(['fileNotObject'])
  })

  it('reports a file with neither hooks nor modules', () => {
    expect(pluginIds({})).toEqual(['hooksMissing'])
    expect(pluginIds({ description: 'd' })).toEqual(['hooksMissing'])
  })

  it('reports an event map without the hooks wrapper', () => {
    expect(pluginIds({ PreToolUse: [] })).toEqual(['hooksMissing', 'unknownKey'])
  })

  it('reports a top-level key that the docs do not name', () => {
    const [message] = lintJson(name, JSON.stringify({ hooks: {}, version: 1 }), FILES.plugin)
    expect(message?.messageId).toBe('unknownKey')
    expect(message?.message).toContain('"version"')
  })

  it('reports a description, $schema or modules of the wrong type', () => {
    expect(pluginIds({ hooks: {}, description: 1 })).toEqual(['fieldType'])
    expect(pluginIds({ hooks: {}, $schema: [] })).toEqual(['fieldType'])
    expect(pluginIds({ hooks: {}, modules: './register.js' })).toEqual(['fieldType'])
    expect(pluginIds({ hooks: {}, modules: [1] })).toEqual(['fieldType'])
  })

  it('reports a hooks value that is not an object', () => {
    expect(pluginIds({ hooks: [] })).toEqual(['notObject'])
  })

  it('reports nothing in a hooks.json that no plugin reads', () => {
    expect(jsonIds(name, '[]', '/repo/.claude/hooks/hooks.json')).toEqual([])
    expect(jsonIds(name, '[]', '/repo/hooks.json')).toEqual([])
  })

  it('reads a hooks value of JSON5 that is NaN as the wrong type', () => {
    const found = lintJson5(name, '{"hooks": {"Stop": NaN}}', FILES.project)
    expect(found.map((message) => message.messageId)).toEqual(['eventNotArray'])
  })
})

describe(`${name}: frontmatter`, () => {
  const yaml = (text: string, file = FILES.skill) => markdownIds(name, frontmatter(text), file)

  it('is silent for a valid config in a skill and in a project subagent', () => {
    const valid =
      'PreToolUse:\n  - matcher: "Bash"\n    hooks:\n      - type: command\n        command: "./scripts/security-check.sh"\n        once: true\n'
    expect(yaml(valid)).toEqual([])
    expect(yaml(valid, FILES.agent)).toEqual([])
  })

  it('reports a fault in a skill and in a project subagent, at the place', () => {
    const bad = 'PreToolUse:\n  - matcher: [Bash]\n    hooks:\n      - type: script\n'
    expect(yaml(bad)).toEqual(['matcherArrayWholeFile', 'typeInvalid'])
    expect(yaml(bad, FILES.agent)).toEqual(['matcherArrayWholeFile', 'typeInvalid'])
    const found = lintMarkdown(name, frontmatter(bad), FILES.skill)
    expect(found.map(({ line, column }) => [line, column])).toEqual([
      [6, 16],
      [8, 17],
    ])
  })

  it('reads a scalar, a number, a boolean, null and an alias as values', () => {
    expect(yaml('Stop: x\n')).toEqual(['eventNotArray'])
    expect(yaml('Stop: 1\n')).toEqual(['eventNotArray'])
    expect(yaml('Stop: true\n')).toEqual(['eventNotArray'])
    expect(yaml('Stop:\n')).toEqual(['eventNotArray'])
    expect(yaml('Stop: &a []\nSessionEnd: *a\n')).toEqual(['eventNotArray'])
  })

  it('skips a key that is not a string', () => {
    expect(yaml('1: x\nStop: []\n')).toEqual([])
    expect(yaml('? [a]\n: b\nStop: []\n')).toEqual([])
  })

  it('reports a hooks value that is not an object', () => {
    expect(markdownIds(name, '---\nhooks: x\n---\n', FILES.skill)).toEqual(['notObject'])
  })

  it('is silent without a hooks field, with null hooks, and with bad YAML', () => {
    expect(markdownIds(name, '---\nname: s\n---\n', FILES.skill)).toEqual([])
    expect(markdownIds(name, '---\nhooks:\n---\n', FILES.skill)).toEqual([])
    expect(markdownIds(name, '---\nhooks: [unclosed\n---\n', FILES.skill)).toEqual([])
    expect(markdownIds(name, '---\n- a\n---\n', FILES.skill)).toEqual([])
  })

  it('is silent in a plugin agent, where Claude Code ignores hooks', () => {
    expect(markdownIds(name, frontmatter('Stop: x\n'), pluginAgent())).toEqual([])
  })

  it('is silent in a Markdown file that is no skill or subagent', () => {
    expect(yaml('Stop: x\n', '/repo/docs/SKILL.md')).toEqual([])
    expect(yaml('Stop: x\n', '/repo/docs/agents/a.md')).toEqual([])
    expect(yaml('Stop: x\n', '/repo/.claude/commands/c.md')).toEqual([])
  })

  it('checks the SKILL.md of a plugin', () => {
    expect(markdownIds(name, frontmatter('Stop: x\n'), pluginSkill())).toEqual(['eventNotArray'])
  })
})
