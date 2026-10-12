// `quotedList` formats the names in a report. The rules test most of the reader. The tests below
// read the tree of a YAML `hooks` value through `hooksListener`, as a rule gets it.
import markdown from '@eslint/markdown'
import { Linter, type Rule } from 'eslint'
import { describe, expect, it } from 'vitest'
import { type HookSource, hooksListener, quotedList } from '../src/hooks-config.ts'
import { FILES, frontmatter } from './hooks.test-support.ts'

it('quotes one name', () => {
  expect(quotedList(['command'])).toBe('"command"')
})

it('joins two names with and', () => {
  expect(quotedList(['bash', 'powershell'])).toBe('"bash" and "powershell"')
})

it('joins three names with commas and a last and', () => {
  expect(quotedList(['command', 'http', 'mcp_tool'])).toBe('"command", "http" and "mcp_tool"')
})

it('gives an empty string for no name', () => {
  expect(quotedList([])).toBe('')
})

/** The sources that `hooksListener` gives for the Markdown text `code` of a skill. */
function sourcesOf(code: string): HookSource[] {
  const sources: HookSource[] = []
  const record: Rule.RuleModule = {
    create: (context) => hooksListener(context, (source) => sources.push(source)),
  }
  new Linter({ cwd: '/' }).verify(
    code,
    [
      {
        files: ['**/*.md'],
        plugins: { markdown, test: { rules: { record } } },
        language: 'markdown/gfm',
        languageOptions: { frontmatter: 'yaml' },
        rules: { 'test/record': 'error' },
      },
    ],
    { filename: FILES.skill },
  )
  return sources
}

/** The first handler slot of the `Stop` event of `source`, as the reader gives it. */
function firstHandler(source: HookSource | undefined) {
  const hooks = source?.hooks
  const groups = hooks?.kind === 'object' ? hooks.members[0]?.value : undefined
  const group = groups?.kind === 'array' ? groups.items[0] : undefined
  const handlers = group?.kind === 'object' ? group.members[0]?.value : undefined
  return handlers?.kind === 'array' ? handlers.items : []
}

describe('hooksListener: a merge key in YAML', () => {
  it('gives an unseen node for an alias to a map that holds a merge key', () => {
    const code = `---\nbase: &m { <<: { a: 1 }, type: command }\nhooks:\n  Stop:\n    - hooks:\n        - *m\n        - { type: command, command: c }\n---\n`
    const [source] = sourcesOf(code)
    const [merged, sibling] = firstHandler(source)
    // The unseen node takes the place of the alias, at line 6.
    expect(merged).toEqual({
      kind: 'unseen',
      loc: { start: { line: 6, column: 11 }, end: { line: 6, column: 13 } },
    })
    expect(sibling?.kind).toBe('object')
  })

  it('gives an unseen hooks value when the value itself holds a merge key', () => {
    const [source] = sourcesOf(frontmatter('<<: { Stop: [] }\nSessionEnd: x\n'))
    expect(source?.hooks?.kind).toBe('unseen')
  })

  it('reads a quoted << as an ordinary key', () => {
    const [source] = sourcesOf(
      frontmatter("Stop:\n  - hooks:\n      - { '<<': 1, type: command }\n"),
    )
    const [handler] = firstHandler(source)
    expect(handler?.kind).toBe('object')
    expect(handler?.kind === 'object' ? handler.members.map(({ key }) => key) : []).toEqual([
      '<<',
      'type',
    ])
  })

  it('leaves the whole value unread over the alias limit', () => {
    const rows = '  - { hooks: *a }\n'.repeat(1001)
    const sources = sourcesOf(frontmatter(`Stop:\n  - { hooks: &a [] }\n${rows}`))
    // The rule still gets a source, with no `hooks` value.
    expect(sources).toHaveLength(1)
    expect(sources[0]?.hooks).toBeUndefined()
  })
})
