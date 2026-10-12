// eslint-plugin-eslint-plugin finds a rule from the exports of its module. When an object
// literal export, such as `target`, comes after `export default rule`, the plugin finds no rule.
// Then it checks nothing in that file, and gives no report. So each module in `src/rules/` ends
// with `export default rule`.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RULES = path.resolve(import.meta.dirname, '../src/rules')

const modules = readdirSync(RULES).filter((file) => file.endsWith('.ts'))

describe('rule modules', () => {
  it('finds the rule modules', () => {
    expect(modules.length).toBeGreaterThan(400)
  })

  it('ends each module with export default rule', () => {
    const others = modules.filter(
      (file) => !readFileSync(path.join(RULES, file), 'utf8').endsWith('\nexport default rule\n'),
    )
    expect(others).toEqual([])
  })
})
