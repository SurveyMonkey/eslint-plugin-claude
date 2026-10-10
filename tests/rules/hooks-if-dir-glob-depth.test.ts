// In an `if` condition for a file tool, "a single-segment directory pattern like `Edit(src/**)` matches
// only the `src` directory in the working directory and the files under it. To match a directory named
// `src` at any depth, write `Edit(**/src/**)`. Before v2.1.214, `Edit(src/**)` matched a directory named
// `src` at any depth" (https://code.claude.com/docs/en/hooks#common-fields). The current docs state both
// behaviors, but a repository file does not say which Claude Code runs it. So the rule reports only with
// the option `minVersion` at v2.1.214 or later (ADR 001, Decision 2).
import { describe, expect, it } from 'vitest'
import { NO_MATCHER_EVENTS, TOOL_EVENTS } from '../../src/data/hook-events.ts'
import { command, FILES, hooks, jsonIds, SETTINGS, settings } from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-if-dir-glob-depth'
const MIN = [{ minVersion: '2.1.214' }]
const lint = (
  condition: unknown,
  options: unknown[] = MIN,
  event = 'PreToolUse',
  file = FILES.project,
) => lintJson(name, settings(hooks(event, [command({ if: condition })])), file, options)
const ids = (
  condition: unknown,
  options: unknown[] = MIN,
  event = 'PreToolUse',
  file = FILES.project,
) => lint(condition, options, event, file).map((message) => message.messageId)

describe(`${name}: the report`, () => {
  it('reports Edit(src/**) when minVersion is 2.1.214', () => {
    expect(ids('Edit(src/**)')).toEqual(['depth'])
  })

  it('reports from minVersion 2.1.214 on, and not below', () => {
    for (const minVersion of ['2.1.214', '2.1.215', '2.2.0', '3.0.0', '2.10.0', '2.1.1000']) {
      expect(ids('Edit(src/**)', [{ minVersion }]), minVersion).toEqual(['depth'])
    }
    for (const minVersion of ['2.1.213', '2.0.999', '1.9.9999', '2.1.9']) {
      expect(ids('Edit(src/**)', [{ minVersion }]), minVersion).toEqual([])
    }
  })

  it('reports each file tool', () => {
    for (const tool of ['Read', 'Edit', 'Write', 'NotebookEdit', 'Glob', 'Grep']) {
      expect(ids(`${tool}(src/**)`), tool).toEqual(['depth'])
    }
  })

  it('reports each tool event', () => {
    for (const event of TOOL_EVENTS) {
      expect(ids('Edit(src/**)', MIN, event), event).toEqual(['depth'])
    }
  })

  it('reports a single-segment directory in each spelling', () => {
    for (const dir of ['src', '.github', 'my-dir', 'a b', 'src.d', '_x']) {
      expect(ids(`Edit(${dir}/**)`), dir).toEqual(['depth'])
    }
  })

  it('reports in a settings file and a plugin hooks.json', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('Edit(src/**)', MIN, 'PreToolUse', file), file).toEqual(['depth'])
    }
  })

  it('reports at the if value, names the rule and the fix, and names the option', () => {
    const text =
      '{\n  "hooks": {"PreToolUse": [{"hooks": [{"type": "command", "command": "a", "if": "Edit(src/**)"}]}]}\n}'
    const [message] = lintJson(name, text, FILES.project, MIN)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['depth', 2, 81])
    expect(message?.message).toBe(
      'Since v2.1.214, "Edit(src/**)" matches only the "src" directory in the working directory. The option minVersion is 2.1.214. To match a directory named "src" at any depth, write "Edit(**/src/**)".',
    )
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent when minVersion is not set', () => {
    expect(ids('Edit(src/**)', [])).toEqual([])
    expect(ids('Edit(src/**)', [{}])).toEqual([])
  })

  it('is silent for Edit(**/src/**) and the other pattern shapes', () => {
    for (const condition of [
      'Edit(**/src/**)',
      'Edit(/src/**)',
      'Edit(./src/**)',
      'Edit(src/components/**)',
      'Edit(src/**/*.ts)',
      'Edit(src/*)',
      'Edit(src)',
      'Edit(*.ts)',
      'Edit(**)',
      'Edit(//src/**)',
      'Edit(~/src/**)',
      'Edit(../src/**)',
      'Edit(./**)',
      'Edit(../**)',
      'Edit(*/**)',
      'Edit(?/**)',
      'Edit(\\a/**)',
      'Edit(!src/**)',
      'Edit(~/**)',
      'Edit(ab[c/**)',
      'Edit(ab[c]/**)',
      'Edit(ab{c}/**)',
      'Edit(a\\b/**)',
      'Edit(sr*/**)',
      'Edit(s?c/**)',
      'Edit([s]rc/**)',
      'Edit({src}/**)',
      'Edit(/**)',
      'Edit(src/**/)',
      'Edit()',
      'Edit',
    ]) {
      expect(ids(condition), condition).toEqual([])
    }
  })

  it('is silent for a tool that is no file tool', () => {
    for (const condition of [
      'Bash(src/**)',
      'WebFetch(src/**)',
      'mcp__a__b(src/**)',
      'Agent(src/**)',
      'LSP(src/**)',
      'Task(src/**)',
    ]) {
      expect(ids(condition), condition).toEqual([])
    }
  })

  it('is silent for an event that is no tool event, where hooks-if-condition reports', () => {
    for (const event of ['SessionStart', 'Stop', 'Notification', 'Bogus', ...NO_MATCHER_EVENTS]) {
      expect(ids('Edit(src/**)', MIN, event), event).toEqual([])
    }
  })

  it('is silent for an if that is no string, empty, or not one rule', () => {
    for (const condition of [
      5,
      null,
      ['Edit(src/**)'],
      '',
      'Edit(src/**',
      'Edit(src/**) && Write(x)',
      '(src/**)',
    ]) {
      expect(ids(condition), JSON.stringify(condition)).toEqual([])
    }
    expect(jsonIds(name, settings(hooks('PreToolUse', [command()])), FILES.project)).toEqual([])
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids('Edit(src/**)', MIN, 'PreToolUse', FILES.hidden)).toEqual([])
  })
})

describe(`${name}: the option`, () => {
  it('refuses a minVersion that is not major.minor.patch, and an unknown option', () => {
    for (const minVersion of ['2.1', 'v2.1.214', '2.1.214-beta', 2]) {
      expect(() => ids('Edit(src/**)', [{ minVersion }]), String(minVersion)).toThrow()
    }
    expect(() => ids('Edit(src/**)', [{ other: 1 }])).toThrow()
    expect(() => ids('Edit(src/**)', [{ minVersion: '2.1.214' }])).not.toThrow()
  })
})
