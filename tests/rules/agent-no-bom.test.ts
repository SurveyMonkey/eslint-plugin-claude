// Claude Code before v2.1.239 silently ignores an agent file that starts with
// a UTF-8 byte-order mark. ESLint strips the mark before a rule runs, so the
// rule reads the first bytes of the file on disk. The files are on disk.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'agent-no-bom-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

/** Write `text` at `name` in the scratch tree, and give its absolute path. */
function write(name: string, text: string) {
  const file = path.join(scratch, name)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
  return file
}

const BOM = '﻿'
const OLD = [{ minVersion: '2.1.0' }]

describe('agent-no-bom', () => {
  it.fails('reports a BOM when minVersion is below 2.1.239', () => {
    const file = write('r1/.claude/agents/a.md', BOM + agentText(''))
    const messages = lintRule('agent-no-bom', OLD, BOM + agentText(''), file)
    expect(messages).toMatchObject([{ messageId: 'bom', line: 1, column: 1 }])
  })

  it.fails('stays silent for a file with no BOM', () => {
    const file = write('r2/.claude/agents/a.md', agentText(''))
    expect(lintRule('agent-no-bom', OLD, agentText(''), file)).toEqual([])
  })

  it.fails('stays silent when minVersion is not set', () => {
    const file = write('r3/.claude/agents/a.md', BOM + agentText(''))
    expect(lintRule('agent-no-bom', [], BOM + agentText(''), file)).toEqual([])
  })
})
