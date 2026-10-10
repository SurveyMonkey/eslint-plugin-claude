// The bundled skill aliases of `src/data/settings-keys.ts` against the reviewed copy of the
// commands reference in docs/docs-snapshot/commands.json. The snapshot is a source that the module
// does not share. A docs change that adds an alias to a bundled skill makes this test fail.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUNDLED_SKILL_ALIASES } from '../src/data/settings-keys.ts'

const snapshot = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../docs/docs-snapshot/commands.json'), 'utf8'),
) as { sources: { id: string; text: string }[] }
const TABLE = snapshot.sources.find(({ id }) => id === 'all-commands')?.text ?? ''

describe('the bundled skill aliases, against the commands reference', () => {
  // A row that the page marks as a bundled skill, with the alias that it names at the end.
  const rows = TABLE.split('\n').filter((line) =>
    line.includes('**[Skill](/docs/en/skills#bundled-skills).**'),
  )
  const found = rows.flatMap((row) => {
    const skill = /^\| `\/([a-z-]+)/.exec(row)?.[1]
    const alias = /Alias(?:es)?: `\/([a-z-]+)`\s*\|$/.exec(row)?.[1]
    return skill !== undefined && alias !== undefined ? [[alias, skill] as const] : []
  })

  it('reads the bundled skills of the table', () => {
    expect(rows.length).toBeGreaterThan(15)
  })

  it('lists the alias of each bundled skill that the table names, and no other', () => {
    expect(Object.fromEntries(found)).toEqual(Object.fromEntries(BUNDLED_SKILL_ALIASES))
  })

  it('pins the three aliases', () => {
    expect([...BUNDLED_SKILL_ALIASES]).toEqual([
      ['review', 'code-review'],
      ['checkup', 'doctor'],
      ['proactive', 'loop'],
    ])
  })
})
