// The bundled skill aliases of `src/data/settings-keys.ts`. The expected pairs come from the rows of
// the commands reference (https://code.claude.com/docs/en/commands#all-commands) that mark a
// bundled skill and name an alias: `/review` for `/code-review`, `/checkup` for `/doctor` and
// `/proactive` for `/loop`. No docs footnote cites that page, so the docs watch does not see it.
import { describe, expect, it } from 'vitest'
import { BUNDLED_SKILL_ALIASES } from '../src/data/settings-keys.ts'

describe('the bundled skill aliases', () => {
  it('pins the three aliases', () => {
    expect([...BUNDLED_SKILL_ALIASES]).toEqual([
      ['review', 'code-review'],
      ['checkup', 'doctor'],
      ['proactive', 'loop'],
    ])
  })
})
