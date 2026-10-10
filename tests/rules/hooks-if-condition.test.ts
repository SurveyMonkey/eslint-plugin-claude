// The `if` field of a hook handler holds one permission rule, and Claude Code evaluates it on tool
// events only. The docs are the hooks reference, "Common fields" and "How a hook resolves", and the
// tools reference, "Configure tools with permission rules and hooks".
import { describe, expect, it } from 'vitest'
import { HOOK_EVENTS, NO_MATCHER_EVENTS, TOOL_EVENTS } from '../../src/data/hook-events.ts'
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

const name = 'hooks-if-condition'
const run = (event: string, condition: unknown, matcher?: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command({ if: condition })], matcher)), file)
const message = (event: string, condition: string, matcher?: string) =>
  lintJson(name, settings(hooks(event, [command({ if: condition })], matcher)), FILES.project)[0]
    ?.message
const NON_TOOL_EVENTS = HOOK_EVENTS.filter((event) => !TOOL_EVENTS.includes(event))

describe(`${name}: the event`, () => {
  it('reports an if on each event that is not a tool event, where the hook never runs', () => {
    for (const event of NON_TOOL_EVENTS) {
      expect(run(event, 'Bash(git *)'), event).toEqual(['event'])
    }
    expect(NO_MATCHER_EVENTS.every((event) => NON_TOOL_EVENTS.includes(event))).toBe(true)
  })

  it('names the event', () => {
    expect(message('Stop', 'Bash(git *)')).toBe(
      'The "if" field works on tool events only. On Stop the hook never runs.',
    )
  })

  it('reports only the event when the rule is also wrong', () => {
    expect(run('Stop', 'Bash(')).toEqual(['event'])
  })

  it('is silent on each tool event, and on an event that Claude Code does not know', () => {
    for (const event of TOOL_EVENTS) {
      expect(run(event, 'Bash(git *)'), event).toEqual([])
    }
    expect(run('Bogus', 'Bash(git *)')).toEqual([])
  })

  it('is silent for a handler with no if, and for an if that is no string', () => {
    const text = settings(hooks('Stop', [command()]))
    expect(jsonIds(name, text, FILES.project)).toEqual([])
    for (const condition of [['Bash(git *)'], 7, null, true, {}]) {
      expect(run('Stop', condition), JSON.stringify(condition)).toEqual([])
      expect(run('PreToolUse', condition), JSON.stringify(condition)).toEqual([])
    }
  })

  it('is silent for an empty string, where the docs do not say', () => {
    expect(run('PreToolUse', '')).toEqual([])
    expect(run('Stop', '')).toEqual(['event'])
  })
})

describe(`${name}: the grammar of the rule`, () => {
  it('reports each fault that the shared parser finds', () => {
    expect(run('PreToolUse', '(npm run *)')).toEqual(['emptyTool'])
    expect(run('PreToolUse', 'Bash(npm run build')).toEqual(['unbalanced'])
    expect(run('PreToolUse', 'Bash)')).toEqual(['unbalanced'])
    expect(run('PreToolUse', 'Bash(npm run build) --watch')).toEqual(['trailingText'])
    expect(run('PreToolUse', 'Bash(npm\0run)')).toEqual(['nulByte'])
  })

  it('names each fault', () => {
    expect(message('PreToolUse', '(x)')).toBe(
      'The "if" field is not a permission rule: it has no tool name.',
    )
    expect(message('PreToolUse', 'Bash(x')).toBe(
      'The "if" field is not a permission rule: it has unbalanced parentheses.',
    )
    expect(message('PreToolUse', 'Bash(x) y')).toBe(
      'The "if" field is not a permission rule: it has text after the final parenthesis.',
    )
    expect(message('PreToolUse', 'Bash(x\0)')).toBe(
      'The "if" field is not a permission rule: it holds a NUL byte.',
    )
  })

  it('is silent for a valid rule', () => {
    for (const condition of [
      'Bash',
      'Bash(git *)',
      'Edit(*.ts)',
      'Edit(**/src/**)',
      'Read(./Finance (2024)/**)',
      'WebFetch(domain:example.com)',
      'mcp__memory__create_entities',
      'Bash(rm *)',
      'Bash(echo $(date) && ls -l)',
      'Bash(git commit -m "a, b")',
      'Bash(a || b)',
    ]) {
      expect(run('PreToolUse', condition), condition).toEqual([])
    }
  })
})

describe(`${name}: one rule only`, () => {
  it('reports two rules joined by &&, || or a comma', () => {
    for (const condition of [
      'Bash(git *) && Edit(*.ts)',
      'Bash(git *) || Edit(*.ts)',
      'Bash(git *), Edit(*.ts)',
      'Bash(git *),Edit(*.ts)',
      'Bash && Edit',
      'Bash || Edit',
      'Bash, Edit',
      'Bash(git *) && Edit',
      'Bash && Edit(*.ts)',
      'Bash(git *) && Edit && Read',
    ]) {
      expect(run('PreToolUse', condition), condition).toEqual(['multiple'])
    }
  })

  it('names the operator', () => {
    expect(message('PreToolUse', 'Bash(a) && Edit(b)')).toBe(
      'The "if" field holds one permission rule. Use one handler for each rule, not "&&".',
    )
    expect(message('PreToolUse', 'Bash(a) || Edit(b)')).toContain('not "||"')
    expect(message('PreToolUse', 'Bash(a), Edit(b)')).toContain('not ","')
    expect(message('PreToolUse', 'Bash, Edit')).toContain('not ","')
  })

  it('is silent when the operator is part of a specifier', () => {
    for (const condition of ['Bash(a && b)', 'Bash(echo (a), b)', 'Edit(./a (b), c/**)']) {
      expect(run('PreToolUse', condition), condition).toEqual([])
    }
  })
})

// Two false positives that the review of this layer found.
describe(`${name}: review findings`, () => {
  it('is silent for the rule of a whole MCP server, which the matcher can select', () => {
    expect(run('PreToolUse', 'mcp__memory', 'mcp__memory__.*')).toEqual([])
    expect(run('PreToolUse', 'mcp__memory', 'mcp__memory__create_entities')).toEqual([])
  })

  it('is silent for parentheses and a comma inside a specifier', () => {
    expect(run('PreToolUse', 'Bash(python -c "f(a), g(b)")')).toEqual([])
    expect(run('PreToolUse', 'Bash(echo (a)) || ls')).toEqual(['multiple'])
  })

  it('still reports a rule of a whole MCP server whose tool the matcher cannot select', () => {
    expect(run('PreToolUse', 'mcp__memory__create', 'mcp__github__.*')).toEqual(['toolNotMatched'])
  })
})

describe(`${name}: the matcher of the group`, () => {
  it('reports a rule whose tool the matcher never selects', () => {
    expect(run('PreToolUse', 'Bash(rm *)', 'Edit')).toEqual(['toolNotMatched'])
    expect(run('PreToolUse', 'Edit(*.ts)', 'Bash|PowerShell')).toEqual(['toolNotMatched'])
    expect(run('PostToolUse', 'WebFetch(domain:x.com)', '^Bash')).toEqual(['toolNotMatched'])
    expect(run('PreToolUse', 'mcp__memory__create', 'mcp__github__.*')).toEqual(['toolNotMatched'])
    expect(run('PreToolUse', 'Agent(Explore)', 'Skill')).toEqual(['toolNotMatched'])
  })

  it('names the matcher and the tool', () => {
    expect(message('PreToolUse', 'Bash(rm *)', 'Edit')).toBe(
      'The matcher "Edit" never selects the tool "Bash" of this "if" rule, so the hook never runs.',
    )
  })

  it('is silent when the matcher selects the tool', () => {
    expect(run('PreToolUse', 'Bash(rm *)', 'Bash')).toEqual([])
    expect(run('PreToolUse', 'Bash(rm *)', 'Edit|Bash')).toEqual([])
    expect(run('PreToolUse', 'Bash(rm *)', 'Edit, Bash')).toEqual([])
    expect(run('PreToolUse', 'Bash(rm *)', 'Bash.*')).toEqual([])
    expect(run('PreToolUse', 'Bash(rm *)', '^(Bash|PowerShell)$')).toEqual([])
    expect(run('PreToolUse', 'mcp__memory__create', 'mcp__memory__.*')).toEqual([])
  })

  it('is silent for a match-all matcher, and for a handler of a group with no matcher', () => {
    for (const matcher of ['', '*', undefined]) {
      expect(run('PreToolUse', 'Bash(rm *)', matcher), String(matcher)).toEqual([])
    }
  })

  it('reads a rule for one tool as a rule for the tools of its family', () => {
    // `Bash` rules apply to Monitor, `Read` rules to Grep, Glob and LSP, `Edit` rules to Write and NotebookEdit.
    expect(run('PreToolUse', 'Bash(rm *)', 'Monitor')).toEqual([])
    expect(run('PreToolUse', 'Monitor(x)', 'Bash')).toEqual([])
    for (const tool of ['Read', 'Grep', 'Glob', 'LSP']) {
      expect(run('PreToolUse', 'Read(./a)', tool), tool).toEqual([])
    }
    for (const tool of ['Edit', 'Write', 'NotebookEdit']) {
      expect(run('PreToolUse', 'Edit(./a)', tool), tool).toEqual([])
    }
    expect(run('PreToolUse', 'Edit(./a)', 'Read')).toEqual(['toolNotMatched'])
  })

  it('leaves a case variant to hooks-matcher-never-matches', () => {
    expect(run('PreToolUse', 'Bash(rm *)', 'bash')).toEqual([])
    expect(run('PreToolUse', 'Bash(rm *)', 'edit|bash')).toEqual([])
  })

  it('is silent for a tool that is not known, a wildcard, and a matcher that does not compile', () => {
    expect(run('PreToolUse', 'Foo(x)', 'Edit')).toEqual([])
    expect(run('PreToolUse', 'Task(x)', 'Edit')).toEqual([])
    expect(run('PreToolUse', 'mcp__memory__*', 'Edit')).toEqual([])
    expect(run('PreToolUse', 'Bash(rm *)', '(unclosed')).toEqual([])
  })

  it('is silent when the rule has a fault of its own', () => {
    expect(run('PreToolUse', 'Bash(rm', 'Edit')).toEqual(['unbalanced'])
  })

  it('is silent for a matcher that is no string', () => {
    expect(run('PreToolUse', 'Bash(rm *)', ['Edit'])).toEqual([])
  })

  it('reads the matcher of the group of each handler', () => {
    const text = JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [command({ if: 'Bash(a)' })] },
          { matcher: 'Edit', hooks: [command({ if: 'Bash(a)' }), command({ if: 'Edit(b)' })] },
        ],
      },
    })
    expect(jsonIds(name, text, FILES.project)).toEqual(['toolNotMatched'])
  })
})

describe(`${name}: the files`, () => {
  it('reports at the if value', () => {
    const text =
      '{\n  "hooks": {\n    "Stop": [{"hooks": [{"type": "command", "command": "c", "if": "Bash"}]}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 67]])
  })

  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(run('Stop', 'Bash', undefined, file), file).toEqual(['event'])
      expect(run('PreToolUse', 'Bash', undefined, file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (event: string) =>
      frontmatter(
        `${event}:\n  - hooks:\n      - type: command\n        command: c\n        if: "Bash(git *)"\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('Stop'), file), file).toEqual(['event'])
      expect(markdownIds(name, yaml('PreToolUse'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(run('Stop', 'Bash', undefined, FILES.hidden)).toEqual([])
    expect(run('Stop', 'Bash', undefined, '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
