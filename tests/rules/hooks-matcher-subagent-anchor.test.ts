// A plugin subagent has a name with a colon, such as `my-plugin:reviewer`. The colon puts the matcher
// on the regular-expression path, where it matches anywhere in the name. The docs say to anchor it with
// `^` and `$` (https://code.claude.com/docs/en/hooks#subagentstart).
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

const name = 'hooks-matcher-subagent-anchor'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)

describe(`${name}: a plugin-scoped name`, () => {
  it.fails('reports a name with a colon and no anchor, on both subagent events', () => {
    for (const event of ['SubagentStart', 'SubagentStop']) {
      expect(ids(event, 'plugin:agent'), event).toEqual(['unanchored'])
    }
  })

  it.fails('reports a name that has one anchor only', () => {
    expect(ids('SubagentStart', '^plugin:agent')).toEqual(['unanchored'])
    expect(ids('SubagentStart', 'plugin:agent$')).toEqual(['unanchored'])
  })

  it.fails('reports a list with a colon and no anchor', () => {
    expect(ids('SubagentStart', 'a:b|c:d')).toEqual(['unanchored'])
    expect(ids('SubagentStart', 'reviewer|my-plugin:reviewer')).toEqual(['unanchored'])
  })

  it.fails('is silent for a name with both anchors', () => {
    expect(ids('SubagentStart', '^plugin:agent$')).toEqual([])
    expect(ids('SubagentStop', '^my-plugin:review:security$')).toEqual([])
    expect(ids('SubagentStart', '^(a:b|c:d)$')).toEqual([])
  })

  it.fails('is silent for a name with no colon', () => {
    for (const matcher of ['reviewer', 'my-agent', 'Explore|Plan', undefined, '', '*']) {
      expect(ids('SubagentStart', matcher), String(matcher)).toEqual([])
    }
  })

  it.fails('is silent for a matcher that is no string', () => {
    expect(ids('SubagentStart', ['a:b'])).toEqual([])
    expect(ids('SubagentStart', 7)).toEqual([])
  })

  it.fails('is silent on another event', () => {
    for (const event of ['PreToolUse', 'SessionStart', 'Stop', 'Elicitation']) {
      expect(ids(event, 'plugin:agent'), event).toEqual([])
    }
  })

  it.fails('says what to write', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SubagentStart', [command()], 'my-plugin:reviewer')),
      FILES.project,
    )
    expect(message?.message).toBe(
      'A name with a colon is a regular expression, and it matches anywhere in the agent type. Anchor it: "^my-plugin:reviewer$".',
    )
  })

  it.fails('reports at the matcher value', () => {
    const text = '{\n  "hooks": {\n    "SubagentStart": [{"matcher": "a:b", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 35]])
  })
})

describe(`${name}: the files`, () => {
  it.fails('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('SubagentStart', 'p:a', file), file).toEqual(['unanchored'])
      expect(ids('SubagentStart', '^p:a$', file), file).toEqual([])
    }
  })

  it.fails('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (matcher: string) =>
      frontmatter(
        `SubagentStart:\n  - matcher: '${matcher}'\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('p:a'), file), file).toEqual(['unanchored'])
      expect(markdownIds(name, yaml('^p:a$'), file), file).toEqual([])
    }
  })

  it.fails('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('SubagentStart', 'p:a', FILES.hidden)).toEqual([])
    expect(ids('SubagentStart', 'p:a', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
