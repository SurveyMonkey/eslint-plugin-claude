// The subagent tool sets name tools of the tools table. A name that the table
// does not hold would never match a tool that a rule reads.
import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_TOOL_NAMES,
  SUBAGENT_PLAN_MODE_TOOL,
  SUBAGENT_REMOVED_TOOLS,
  TOOL_NAMES,
} from '../src/data/tool-names.ts'

describe('subagent tool sets', () => {
  it.each([
    ['BACKGROUND_TOOL_NAMES', BACKGROUND_TOOL_NAMES],
    ['SUBAGENT_REMOVED_TOOLS', SUBAGENT_REMOVED_TOOLS],
    ['SUBAGENT_PLAN_MODE_TOOL', [SUBAGENT_PLAN_MODE_TOOL]],
  ])('%s holds names of the tools table only', (_name, names) => {
    expect(names.filter((tool) => !TOOL_NAMES.includes(tool))).toEqual([])
  })
})
