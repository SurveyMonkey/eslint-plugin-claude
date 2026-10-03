// Each built rule in the `limit` category takes its number as an option. The
// inventory row names the option and the default (ADR 001, Decision 2).
// The test reads the rows and the registered rules, so a new `limit` rule
// with no option fails here. The count of 21 is a tripwire: a new `limit`
// row makes this test fail until its author updates the count.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

const INVENTORY = readFileSync(
  path.resolve(import.meta.dirname, '../docs/rules-inventory.md'),
  'utf8',
)

interface Row {
  name: string
  text: string
}

const rows: Row[] = INVENTORY.split('\n')
  .map((line) => ({ line, match: /^\| `([a-z0-9-]+)` \|.*\| limit \| – \|/.exec(line) }))
  .flatMap(({ line, match }) => (match?.[1] === undefined ? [] : [{ name: match[1], text: line }]))

/** The options that a row names: `name`, default N (or no default), schema maximum M. */
function optionsOf(text: string) {
  return [
    ...text.matchAll(/`(\w+)`, (?:default (\d[\d,]*)|no default)(?:, schema maximum (\d[\d,]*))?/g),
  ].map(([, option, fallback, maximum]) => ({
    option: option ?? '',
    fallback: fallback === undefined ? undefined : Number(fallback.replaceAll(',', '')),
    maximum: maximum === undefined ? undefined : Number(maximum.replaceAll(',', '')),
  }))
}

const NO_OPTION = 'No threshold option'
const built = rows.filter(({ name }) => name in plugin.rules)

describe('limit rule options', () => {
  it('finds the limit rows and the built rules among them', () => {
    expect(rows).toHaveLength(21)
    expect(built.map(({ name }) => name)).toContain('skill-description-max-length')
  })

  it('gives each limit row an option or a statement that it has none, not both', () => {
    for (const { name, text } of rows) {
      expect(optionsOf(text).length > 0, name).toBe(!text.includes(NO_OPTION))
    }
  })

  for (const { name, text } of built) {
    const options = optionsOf(text)
    if (options.length === 0) {
      it(`${name} has no threshold option, as its row says`, () => {
        const schema = plugin.rules[name]?.meta?.schema as { properties?: object }[] | undefined
        expect(Object.keys(schema?.[0]?.properties ?? {}), name).toEqual([])
      })
      continue
    }
    it(`${name} has each option of its row, with the docs default`, () => {
      const meta = plugin.rules[name]?.meta
      const schema = meta?.schema as { properties: Record<string, { maximum?: number }> }[]
      const defaults = (meta?.defaultOptions ?? []) as Record<string, number>[]
      for (const { option, fallback, maximum } of options) {
        expect(schema[0]?.properties[option], `${name} option ${option}`).toBeDefined()
        expect(defaults[0]?.[option], `${name} default of ${option}`).toBe(fallback)
        expect(schema[0]?.properties[option]?.maximum, `${name} maximum of ${option}`).toBe(maximum)
      }
    })
  }
})
