// Each rule with a schema option keeps its defaults in `meta.defaultOptions`, not in `create`
// (issue #235). The docs of the rule are the independent source. The `## Options` table of
// `docs/rules/<rule>.md` gives the default of each option. A default of `none` or `unset` means
// that the option has no default. Then `meta.defaultOptions[0]` must not hold it.
// The count of 77 is a tripwire: a new rule with options makes this test fail until its author
// updates the count.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

const DOCS = path.resolve(import.meta.dirname, '../docs/rules')

/** The value of an option that has no default. */
const NONE = Symbol('none')

type Defaults = Record<string, unknown>

/** The docs of these rules give the defaults in sentences, not in a table. Each value is from
 *  the sentence that the comment quotes. */
const PROSE: Record<string, Defaults> = {
  // "The default is an empty list."
  'skill-inject-robustness': { allow: [] },
  // "The default is an empty list."
  'settings-model-value': { providerIdPatterns: [] },
  // "The default is an empty array."
  'plugin-bin-claude-ai': { targets: [] },
  // "The default is `[]`."
  'sandbox-domain-broad': { broad: [] },
  // "the rule makes no report unless the option `platforms` is set."
  'settings-defaultshell-powershell-tool': { platforms: NONE },
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
  })

  for (const { name, rule, schema } of withOptions) {
    it(`${name} holds each default of its doc in meta.defaultOptions, and no other`, () => {
      expect(schema, name).toHaveLength(1)
      const properties = Object.keys((schema[0] as { properties?: object }).properties ?? {})
      const docs = PROSE[name] ?? tableOf(name)
      expect(Object.keys(docs).sort(), `${name}: the options of the doc`).toEqual(properties.sort())
      const expected = Object.fromEntries(
        Object.entries(docs).filter(([, value]) => value !== NONE),
      )
      expect(rule.meta?.defaultOptions, name).toHaveLength(1)
      expect(rule.meta?.defaultOptions?.[0], name).toStrictEqual(expected)
    })
  }
})
