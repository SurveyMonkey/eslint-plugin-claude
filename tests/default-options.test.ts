// Each rule with a schema option keeps its defaults in `meta.defaultOptions`, not in `create`
// (issue #235). The docs of the rule are the independent source. The `## Options` table of
// `docs/rules/<rule>.md` gives the default of each option. A default of `none` or `unset` means
// that the option has no default. Then `meta.defaultOptions[0]` must not hold it.
// The test expects 77 rules with options. A new rule with options makes it fail until its author
// changes the count.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

const DOCS = path.resolve(import.meta.dirname, '../docs/rules')
const RULES = path.resolve(import.meta.dirname, '../src/rules')

/** The value of an option that has no default. */
const NONE = Symbol('none')

type Defaults = Record<string, unknown>

/** The docs of these rules give the defaults in sentences, not in a table. Each rule has the
 *  sentence of its doc, and the defaults that the sentence gives. */
const PROSE: Record<string, { quote: string; defaults: Defaults }> = {
  'skill-inject-robustness': { quote: 'The default is an empty list.', defaults: { allow: [] } },
  'settings-model-value': {
    quote: '`env.CLAUDE_CODE_SUBAGENT_MODEL`. The default is an empty list.',
    defaults: { providerIdPatterns: [] },
  },
  'plugin-bin-claude-ai': {
    quote:
      '`targets`: an array. The only value that it takes is `"claude-ai"`. The default is an empty array.',
    defaults: { targets: [] },
  },
  'sandbox-domain-broad': {
    quote: '`broad` is an array of hosts. The default is `[]`.',
    defaults: { broad: [] },
  },
  'settings-defaultshell-powershell-tool': {
    quote: 'the rule makes no report unless the option `platforms` is set.',
    defaults: { platforms: NONE },
  },
}

/** These rules keep `platforms = []` in `create`, and their docs give no default (issue #235,
 *  ruling 11). An empty list and an unset option both turn the check off. */
const PLATFORMS_IN_CREATE = new Set([
  'hooks-exec-form-windows-shim',
  'hooks-ps1-needs-powershell-shell',
  'sandbox-platform-limits',
  'settings-defaultshell-powershell-tool',
  'skill-shell-platform',
])

/** The text of the doc of `name`, with each run of white space as one space. */
function docOf(name: string): string {
  return readFileSync(path.join(DOCS, `${name}.md`), 'utf8').replace(/\s+/g, ' ')
}

/** The value of one Default cell. A cell that this function cannot read gives an error. */
function defaultOf(cell: string): unknown {
  if (/^(none|unset)\b/.test(cell)) {
    return NONE
  }
  const code = /^`(.+)`$/.exec(cell)
  if (code?.[1] !== undefined) {
    return JSON.parse(code[1])
  }
  if (/^\d+(\.\d+)?$/.test(cell)) {
    return Number(cell)
  }
  throw new Error(`The Default cell "${cell}" has no value that the test can read`)
}

/** The rows of the Options table of the doc of `name`, as option and default. */
function tableOf(name: string): Defaults {
  const text = readFileSync(path.join(DOCS, `${name}.md`), 'utf8')
  const section = text.split(/^#{2,3} Options$/m)[1]?.split(/^#{1,3} /m)[0] ?? ''
  const lines = section.split('\n').filter((line) => line.startsWith('|'))
  const header = (lines[0] ?? '').split('|').map((cell) => cell.trim())
  const at = header.indexOf('Default')
  const rows: Defaults = {}
  for (const line of lines) {
    const cells = line.split('|').map((cell) => cell.trim())
    const option = /^`(\w+)`$/.exec(cells[1] ?? '')?.[1]
    if (option !== undefined && at !== -1) {
      rows[option] = defaultOf(cells[at] ?? '')
    }
  }
  return rows
}

const withOptions = Object.entries(plugin.rules).flatMap(([name, rule]) => {
  const schema = rule.meta?.schema
  return Array.isArray(schema) && schema.length > 0 ? [{ name, rule, schema }] : []
})

describe('default options', () => {
  it('finds each rule with a schema option', () => {
    expect(withOptions).toHaveLength(77)
    expect(Object.keys(PROSE).every((name) => name in plugin.rules)).toBe(true)
    expect([...PLATFORMS_IN_CREATE].every((name) => name in plugin.rules)).toBe(true)
  })

  for (const { name, rule, schema } of withOptions) {
    it(`${name} holds each default of its doc in meta.defaultOptions, and no other`, () => {
      expect(schema, name).toHaveLength(1)
      const properties = Object.keys((schema[0] as { properties?: object }).properties ?? {})
      const prose = PROSE[name]
      if (prose !== undefined) {
        expect(docOf(name), `${name}: the sentence of the doc`).toContain(prose.quote)
        expect(tableOf(name), `${name}: a table in the doc`).toEqual({})
      }
      const docs = prose?.defaults ?? tableOf(name)
      expect(Object.keys(docs).sort(), `${name}: the options of the doc`).toEqual(properties.sort())
      const expected = Object.fromEntries(
        Object.entries(docs).filter(([, value]) => value !== NONE),
      )
      expect(rule.meta?.defaultOptions, name).toHaveLength(1)
      expect(rule.meta?.defaultOptions?.[0], name).toStrictEqual(expected)
    })

    // The lint cannot see a schema that a rule imports, such as `MIN_VERSION_SCHEMA`.
    it(`${name} gives a description to each schema option`, () => {
      const properties = (schema[0] as { properties?: Record<string, { description?: unknown }> })
        .properties
      for (const [option, value] of Object.entries(properties ?? {})) {
        expect(value.description, `${name}: ${option}`).toMatch(/\S/)
      }
    })

    // V8 coverage counts no branch for a default in a destructure, so a dead default stays green.
    it(`${name} applies no default in create`, () => {
      const source = readFileSync(path.join(RULES, `${name}.ts`), 'utf8')
      const reads = source.split('\n').filter((line) => line.includes('context.options'))
      expect(reads, `${name}: the reads of context.options`).toHaveLength(1)
      const read = PLATFORMS_IN_CREATE.has(name)
        ? (reads[0] ?? '').replace('platforms = []', 'platforms')
        : (reads[0] ?? '')
      expect(/const (\[.*\]) = context\.options/.exec(read)?.[1] ?? '', name).not.toContain('=')
      expect(read, name).not.toMatch(/context\.options.*(\?\?|\|\|)/)
    })
  }
})
