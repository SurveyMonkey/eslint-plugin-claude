// A `FileChanged` matcher is a list of literal file names. A `"*"` matches every watched file, but
// Claude Code also registers it in the watch list as a file named `*`. An omitted matcher matches
// every watched file and adds nothing to the list. The hooks reference says so
// (https://code.claude.com/docs/en/hooks#filechanged).
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

const name = 'hooks-filechanged-star-matcher'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)

describe(`${name}: the star matcher`, () => {
  it('reports "*" on FileChanged', () => {
    expect(ids('FileChanged', '*')).toEqual(['star'])
  })

  it('reports a star segment in a list, once for the matcher', () => {
    expect(ids('FileChanged', '*|.env')).toEqual(['star'])
    expect(ids('FileChanged', '.envrc|*')).toEqual(['star'])
    expect(ids('FileChanged', '*|.env|*')).toEqual(['star'])
  })

  it('is silent for an omitted or empty matcher and for a named file', () => {
    for (const matcher of [undefined, '', '.envrc', '.envrc|.env', 'data.csv']) {
      expect(ids('FileChanged', matcher), String(matcher)).toEqual([])
    }
  })

  it('is silent for a segment that only holds a star', () => {
    // `hooks-matcher-syntax` reports a pattern character in a file name.
    // A comma is no separator for FileChanged: only `|` splits the value.
    for (const matcher of ['**', '*.env', '.env*', '* ', 'a*', '.env,*', '*,.env']) {
      expect(ids('FileChanged', matcher), matcher).toEqual([])
    }
  })

  it('is silent on another event and for a matcher that is no string', () => {
    expect(ids('PreToolUse', '*')).toEqual([])
    expect(ids('SessionStart', '*')).toEqual([])
    expect(ids('FileChanged', ['*'])).toEqual([])
    expect(ids('FileChanged', 1)).toEqual([])
  })

  it('reports at the matcher value', () => {
    const text = '{\n  "hooks": {\n    "FileChanged": [{"matcher": "*", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 33]])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('FileChanged', '*', file), file).toEqual(['star'])
      expect(ids('FileChanged', '.envrc', file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (matcher: string) =>
      frontmatter(
        `FileChanged:\n  - matcher: '${matcher}'\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('*'), file), file).toEqual(['star'])
      expect(markdownIds(name, yaml('.envrc'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('FileChanged', '*', FILES.hidden)).toEqual([])
    expect(ids('FileChanged', '*', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
