// Each rule with a schema option keeps its defaults in `meta.defaultOptions`, not in `create`
// (issue #235). eslint-doc-generator writes the options list of each rule doc from `meta`
// (ADR 003), and `pnpm docs:check` fails when a doc does not agree with it. This test checks
// what `docs:check` does not: one options object, no default that is not an option, a
// description on each option, and no default in `create`.
// The test expects 77 rules with options. A new rule with options makes it fail until its author
// changes the count.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

const RULES = path.resolve(import.meta.dirname, '../src/rules')

/** These rules keep `platforms = []` in `create`, and give no default for `platforms` in `meta`
 *  (issue #235, ruling 11). An empty list and an unset option both turn the check off. */
const PLATFORMS_IN_CREATE = new Set([
  'hooks-exec-form-windows-shim',
  'hooks-ps1-needs-powershell-shell',
  'sandbox-platform-limits',
  'settings-defaultshell-powershell-tool',
  'skill-shell-platform',
])

const withOptions = Object.entries(plugin.rules).flatMap(([name, rule]) => {
  const schema = rule.meta?.schema
  return Array.isArray(schema) && schema.length > 0 ? [{ name, rule, schema }] : []
})

describe('default options', () => {
  it('finds each rule with a schema option', () => {
    expect(withOptions).toHaveLength(77)
    expect([...PLATFORMS_IN_CREATE].every((name) => name in plugin.rules)).toBe(true)
  })

  for (const { name, rule, schema } of withOptions) {
    it(`${name} has one options object, and meta.defaultOptions of length 1`, () => {
      expect(schema, name).toHaveLength(1)
      expect(rule.meta?.defaultOptions, name).toHaveLength(1)
      const properties = Object.keys((schema[0] as { properties?: object }).properties ?? {})
      const defaults = Object.keys(rule.meta?.defaultOptions?.[0] ?? {})
      expect(properties, `${name}: the options of the schema`).toEqual(
        expect.arrayContaining(defaults),
      )
      if (PLATFORMS_IN_CREATE.has(name)) {
        expect(rule.meta?.defaultOptions?.[0], name).not.toHaveProperty('platforms')
      }
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
