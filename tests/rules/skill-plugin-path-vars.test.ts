// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const ids = (code: string) =>
  lintMarkdown('skill-plugin-path-vars', code, pluginSkill()).map((m) => m.messageId)

describe('skill-plugin-path-vars (red)', () => {
  it.fails('reports an unbraced plugin variable', () => {
    expect(ids('Run $CLAUDE_PLUGIN_ROOT/run.sh\n')).toEqual(['unbraced'])
  })
  it.fails('stays silent for a braced plugin variable', () => {
    expect(ids(`Run \${CLAUDE_PLUGIN_ROOT}/run.sh\n`)).toEqual([])
  })
  it.fails('reports a climb out of the skill directory', () => {
    expect(ids(`Run \${CLAUDE_SKILL_DIR}/../../run.sh\n`)).toEqual(['climb'])
  })
})
