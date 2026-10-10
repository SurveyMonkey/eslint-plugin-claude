// `CLAUDE_ENV_FILE` is set for `SessionStart`, `Setup`, `CwdChanged` and `FileChanged` hooks only. No
// `CLAUDE_MODEL` variable exists at all
// (https://code.claude.com/docs/en/hooks#persist-environment-variables,
// https://code.claude.com/docs/en/hooks#common-input-fields).
import { describe, expect, it } from 'vitest'
import { ENV_FILE_EVENTS, HOOK_EVENTS } from '../../src/data/hook-events.ts'
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
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-env-var-unavailable'
const ids = (handler: object, event = 'PreToolUse', file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [handler])), file)
const shell = (text: string, event?: string) => ids(command({ command: text }), event)
const brace = (variable: string) => `\${${variable}}`

describe(`${name}: CLAUDE_ENV_FILE`, () => {
  it('lists the four events that set the variable', () => {
    expect(ENV_FILE_EVENTS).toEqual(['SessionStart', 'Setup', 'CwdChanged', 'FileChanged'])
    for (const event of ENV_FILE_EVENTS) {
      expect(HOOK_EVENTS, event).toContain(event)
    }
  })

  it('reports a reference on each event that does not set it', () => {
    const others = HOOK_EVENTS.filter((event) => !ENV_FILE_EVENTS.includes(event))
    expect(others.length).toBeGreaterThan(20)
    for (const event of others) {
      expect(shell('echo x >> "$CLAUDE_ENV_FILE"', event), event).toEqual(['envFile'])
    }
  })

  it('is silent on the four events that set it', () => {
    for (const event of ENV_FILE_EVENTS) {
      expect(shell('echo x >> "$CLAUDE_ENV_FILE"', event), event).toEqual([])
    }
  })

  it('reads the spellings of a variable, and stops at the name', () => {
    for (const text of [
      '[ -n "$CLAUDE_ENV_FILE" ]',
      `echo x >> ${brace('CLAUDE_ENV_FILE')}`,
      'Add-Content $env:CLAUDE_ENV_FILE x',
      `Add-Content ${brace('env:CLAUDE_ENV_FILE')} x`,
      'echo $CLAUDE_ENV_FILE',
    ]) {
      expect(shell(text), text).toEqual(['envFile'])
    }
    for (const text of [
      'echo $CLAUDE_ENV_FILE_OTHER',
      'echo CLAUDE_ENV_FILE',
      'echo $XCLAUDE_ENV_FILE',
      'echo $CLAUDE_ENV',
      '',
    ]) {
      expect(shell(text), text).toEqual([])
    }
  })

  it('is silent on an event that Claude Code does not know', () => {
    expect(shell('echo $CLAUDE_ENV_FILE', 'Bogus')).toEqual([])
    expect(shell('echo $CLAUDE_ENV_FILE', 'stop')).toEqual([])
  })

  it('reads the executable and each argument in exec form', () => {
    expect(ids(command({ command: 'tee', args: ['-a', '$CLAUDE_ENV_FILE'] }))).toEqual(['envFile'])
    expect(ids(command({ command: '$CLAUDE_ENV_FILE', args: ['x'] }))).toEqual(['envFile'])
    expect(
      ids(command({ command: 'tee', args: ['$CLAUDE_ENV_FILE', '$CLAUDE_ENV_FILE'] })),
    ).toEqual(['envFile', 'envFile'])
    expect(ids(command({ command: 'tee', args: ['x', 5, null, ['$CLAUDE_ENV_FILE']] }))).toEqual([])
    expect(ids(command({ command: 'tee', args: 'x' }))).toEqual([])
  })
})

describe(`${name}: CLAUDE_MODEL`, () => {
  it('reports a reference on every event, a SessionStart hook too', () => {
    for (const event of [...HOOK_EVENTS, 'Bogus']) {
      expect(shell('echo "$CLAUDE_MODEL"', event), event).toEqual(['model'])
    }
  })

  it('reads the spellings of a variable, and stops at the name', () => {
    expect(shell(`echo ${brace('CLAUDE_MODEL')}`)).toEqual(['model'])
    expect(shell('Write-Host $env:CLAUDE_MODEL')).toEqual(['model'])
    for (const text of [
      'echo $CLAUDE_MODEL_ID',
      'echo $ANTHROPIC_MODEL',
      'echo CLAUDE_MODEL',
      'echo $CLAUDE_MODELS',
    ]) {
      expect(shell(text), text).toEqual([])
    }
  })

  it('reports each variable once, for a command that holds both', () => {
    expect(shell('echo $CLAUDE_MODEL $CLAUDE_ENV_FILE', 'Stop')).toEqual(['envFile', 'model'])
    expect(shell('echo $CLAUDE_MODEL $CLAUDE_ENV_FILE', 'SessionStart')).toEqual(['model'])
  })
})

describe(`${name}: the messages`, () => {
  const at = (text: string, event: string) =>
    lintJson(
      name,
      `{\n  "hooks": {"${event}": [{"hooks": [{"type": "command", "command": ${JSON.stringify(text)}}]}]}\n}`,
      FILES.project,
    )

  it('names the event and the events that set the variable', () => {
    const found = at('echo $CLAUDE_ENV_FILE', 'Stop')
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['envFile', 2, 64],
    ])
    expect(found[0]?.message).toBe(
      'Claude Code sets CLAUDE_ENV_FILE for "SessionStart", "Setup", "CwdChanged" and "FileChanged" hooks only. A Stop hook has no such variable.',
    )
  })

  it('says that CLAUDE_MODEL does not exist', () => {
    expect(at('echo $CLAUDE_MODEL', 'Stop')[0]?.message).toBe(
      'Claude Code sets no CLAUDE_MODEL variable, so it is always empty. Read "model" in the input of a SessionStart hook, or set ANTHROPIC_MODEL.',
    )
  })
})

describe(`${name}: the handlers and the files`, () => {
  it('reads a command handler only', () => {
    expect(ids({ type: 'http', command: '$CLAUDE_MODEL' })).toEqual([])
    expect(ids({ type: 'prompt', prompt: '$CLAUDE_MODEL' })).toEqual([])
    expect(ids({ command: '$CLAUDE_MODEL' })).toEqual([])
    expect(ids({ type: 'command', command: 5 })).toEqual([])
  })

  it('reads every settings file, hooks.json, a skill and a project subagent', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(command({ command: '$CLAUDE_MODEL' }), 'Stop', file), file).toEqual(['model'])
    }
    const yaml = (event: string) =>
      `${event}:\n  - hooks:\n      - type: command\n        command: echo $CLAUDE_ENV_FILE\n`
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, frontmatter(yaml('Stop')), file), file).toEqual(['envFile'])
      expect(markdownIds(name, frontmatter(yaml('SessionStart')), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a plugin agent', () => {
    expect(ids(command({ command: '$CLAUDE_MODEL' }), 'Stop', FILES.hidden)).toEqual([])
    const yaml = 'Stop:\n  - hooks:\n      - type: command\n        command: echo $CLAUDE_MODEL\n'
    expect(markdownIds(name, frontmatter(yaml), pluginAgent())).toEqual([])
  })

  it('is silent on a config that is malformed', () => {
    expect(jsonIds(name, settings([]), FILES.project)).toEqual([])
    expect(
      jsonIds(name, settings({ Stop: [{ hooks: [{ type: 'command' }] }] }), FILES.project),
    ).toEqual([])
  })
})
