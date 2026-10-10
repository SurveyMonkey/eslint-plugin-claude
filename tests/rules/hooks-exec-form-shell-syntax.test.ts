// In exec form, Claude Code spawns `command` with no shell. A pipe, a redirect, a list operator and a
// variable such as `$HOME` pass to the program as literal text
// (https://code.claude.com/docs/en/hooks#exec-form-and-shell-form). The rule reads an `args` item that is a
// shell operator, and a `$NAME` in `command` or in an `args` item.
import { describe, expect, it } from 'vitest'
import { command, FILES, frontmatter, hooks, markdownIds, settings } from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-exec-form-shell-syntax'
const ids = (handler: object, file = FILES.project) =>
  lintJson(name, settings(hooks('PostToolUse', [handler], 'Write')), file).map(
    (message) => message.messageId,
  )
const exec = (args: unknown[], fields: Record<string, unknown> = {}) =>
  ids(command({ command: 'tool', args, ...fields }))

describe(`${name}: the operators`, () => {
  it('reports an args item that is a shell operator', () => {
    for (const item of ['|', '||', '&&', ';', '&', '>', '>>', '<', '2>&1', '>&2', '2>/dev/null']) {
      expect(exec(['a', item, 'b']), item).toEqual(['operator'])
    }
  })

  it('reports an operator as the command', () => {
    expect(ids(command({ command: '&&', args: [] }))).toEqual(['operator'])
  })

  it('reports each operator', () => {
    expect(exec(['a', '|', 'b', '>', 'c'])).toEqual(['operator', 'operator'])
  })

  it('names the item in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ command: 'tool', args: ['a', '|', 'b'] })])),
      FILES.project,
    )
    expect(message?.message).toBe(
      'In exec form, "|" is an argument and not a shell operator. There is no shell, so it passes to the program as literal text. Use shell form (omit "args") for a pipe, a redirect or a list.',
    )
  })

  it('is silent for text that only holds an operator character', () => {
    for (const item of ['a|b', 'x>y', '--filter=a&&b', '>=1.0', '*.ts', 'src/**/*.ts', '']) {
      expect(exec([item]), item).toEqual([])
    }
  })
})

describe(`${name}: the variables`, () => {
  it(`reports $NAME and \${NAME} in an args item`, () => {
    for (const item of ['$HOME', `\${HOME}/x`, '--home=$HOME', '$CLAUDE_PROJECT_DIR/x', '$_A1']) {
      expect(exec([item]), item).toEqual(['variable'])
    }
  })

  it('reports a variable in the command', () => {
    expect(ids(command({ command: '$HOME/bin/tool', args: [] }))).toEqual(['variable'])
  })

  it('names the variable in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ command: 'tool', args: ['$HOME'] })])),
      FILES.project,
    )
    expect(message?.message).toBe(
      'In exec form, "$HOME" is not expanded, because there is no shell. It passes to the program as literal text. Use shell form (omit "args") to expand it.',
    )
  })

  it('is silent for the path placeholders, which Claude Code replaces', () => {
    for (const item of [
      `\${CLAUDE_PROJECT_DIR}/a`,
      `\${CLAUDE_PLUGIN_ROOT}/a`,
      `\${CLAUDE_PLUGIN_DATA}/a`,
      `\${user_config.token}`,
    ]) {
      expect(exec([item]), item).toEqual([])
    }
  })

  it('is silent for the variables that hooks-env-var-unavailable reports', () => {
    expect(exec(['$CLAUDE_ENV_FILE', `\${CLAUDE_MODEL}`])).toEqual([])
  })

  it('reports CLAUDE_ENV_FILE on an event that sets it, where no other rule reports it', () => {
    const text = settings(
      hooks('SessionStart', [command({ command: 'tool', args: ['$CLAUDE_ENV_FILE'] })]),
    )
    expect(lintJson(name, text, FILES.project).map((message) => message.messageId)).toEqual([
      'variable',
    ])
  })

  it('is silent for the variable of a shell line after -c, which the shell expands', () => {
    for (const command of ['bash', 'sh', '/bin/zsh']) {
      for (const flag of ['-c', '-lc']) {
        expect(
          ids({ type: 'command', command, args: [flag, 'echo $HOME'] }),
          command + flag,
        ).toEqual([])
      }
    }
    expect(ids({ type: 'command', command: 'bash', args: ['x.sh', '$HOME'] })).toEqual(['variable'])
    expect(ids({ type: 'command', command: 'python', args: ['-c', '$HOME'] })).toEqual(['variable'])
    expect(ids({ type: 'command', command: 'bash', args: ['-c', 'echo', '$HOME'] })).toEqual([
      'variable',
    ])
  })

  it('is silent for the ; item that ends -exec of find', () => {
    expect(
      ids({ type: 'command', command: 'find', args: ['.', '-exec', 'rm', '{}', ';'] }),
    ).toEqual([])
    expect(ids({ type: 'command', command: 'find', args: ['.', '|'] })).toEqual(['operator'])
  })

  it('is silent for a lower-case name, a bare dollar and a regular expression', () => {
    for (const item of ['.[$x]', '^a$', '$', '$1', 'cost: $5']) {
      expect(exec([item]), item).toEqual([])
    }
  })
})

describe(`${name}: the handler`, () => {
  it('is silent in shell form', () => {
    for (const fields of [{}, { args: 'x' }]) {
      expect(
        ids(command({ command: 'a | b > $HOME/c && d', ...fields })),
        JSON.stringify(fields),
      ).toEqual([])
    }
  })

  it('ignores an args item that is no string, and a handler that is no command hook', () => {
    expect(exec([1, null, ['|'], { a: '|' }, true])).toEqual([])
    expect(ids({ type: 'http', url: 'u', command: 'a', args: ['|'] })).toEqual([])
    expect(ids({ type: 'command', args: ['|'] })).toEqual([])
    expect(ids({ type: 'command', command: 5, args: ['|'] })).toEqual([])
  })

  it('reports in each file that Claude Code reads', () => {
    for (const file of [FILES.project, FILES.local, FILES.managed, FILES.dropIn, FILES.plugin]) {
      expect(exec(['|']), file).toEqual(['operator'])
    }
    expect(ids(command({ command: 'tool', args: ['|'] }), FILES.plugin)).toEqual(['operator'])
  })

  it('reports in a skill and a project agent', () => {
    const text = frontmatter(
      'Stop:\n  - hooks:\n      - type: command\n        command: tool\n        args: ["a", "|"]\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['operator'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['operator'])
  })

  it('is silent in a hidden drop-in and in a plugin agent', () => {
    expect(exec(['|'])).toEqual(['operator'])
    expect(ids(command({ command: 'tool', args: ['|'] }), FILES.hidden)).toEqual([])
    const text = frontmatter(
      'Stop:\n  - hooks:\n      - type: command\n        command: tool\n        args: ["|"]\n',
    )
    expect(markdownIds(name, text, '/repo/plugins/p/agents/a.md')).toEqual([])
  })
})
