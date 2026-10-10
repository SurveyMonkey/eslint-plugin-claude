// Claude Code before v2.1.239 silently ignores an agent file that starts with
// a UTF-8 byte-order mark. ESLint strips the mark before a rule runs, so the
// rule reads the first bytes of the file on disk.
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'agent-no-bom-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

// A plugin root: the manifest makes `agents/` below it a plugin agent directory.
mkdirSync(path.join(scratch, 'plugin', '.claude-plugin'), { recursive: true })
writeFileSync(path.join(scratch, 'plugin', '.claude-plugin', 'plugin.json'), '{}')

let count = 0
/** Write `bytes` as a fresh file at `name` below a new directory of the scratch
 *  tree, and give its absolute path. */
function write(name: string, bytes: string | Buffer) {
  const file = path.join(scratch, `t${count++}`, name)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, bytes)
  return file
}

const BOM = '﻿'
const OLD = [{ minVersion: '2.1.0' }]
const lint = (options: unknown[], file: string, code = BOM + agentText('')) =>
  lintRule('agent-no-bom', options, code, file)

describe('agent-no-bom', () => {
  it('reports a BOM in a local agent when minVersion is below 2.1.239', () => {
    const file = write('.claude/agents/a.md', BOM + agentText(''))
    expect(lint(OLD, file)).toMatchObject([
      { messageId: 'bom', line: 1, column: 1, endLine: 1, endColumn: 2, severity: 1 },
    ])
  })

  it('reports a BOM in a plugin agent', () => {
    const file = path.join(scratch, 'plugin', 'agents', 'a.md')
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, BOM + agentText(''))
    expect(lint(OLD, file)).toMatchObject([{ messageId: 'bom', line: 1, column: 1 }])
  })

  it('reports a BOM in an agent in a subfolder', () => {
    const file = write('.claude/agents/team/a.md', BOM + agentText(''))
    expect(lint(OLD, file)).toHaveLength(1)
  })

  it('names the configured minVersion in the message', () => {
    const file = write('.claude/agents/a.md', BOM + agentText(''))
    expect(lint([{ minVersion: '2.1.238' }], file)[0]?.message).toContain('minVersion is 2.1.238')
  })

  describe('compares minVersion with 2.1.239', () => {
    const file = write('.claude/agents/a.md', BOM + agentText(''))
    for (const version of ['1.9.9', '2.0.99', '2.1.99', '2.1.238']) {
      it(`reports ${version}`, () => {
        expect(lint([{ minVersion: version }], file)).toHaveLength(1)
      })
    }
    for (const version of ['2.1.239', '2.1.240', '2.1.1000', '2.2.0', '3.0.0']) {
      it(`stays silent for ${version}`, () => {
        expect(lint([{ minVersion: version }], file)).toEqual([])
      })
    }
  })

  describe('stays silent', () => {
    it('when minVersion is not set', () => {
      const file = write('.claude/agents/a.md', BOM + agentText(''))
      expect(lint([], file)).toEqual([])
      expect(lint([{}], file)).toEqual([])
    })

    it('for a file with no BOM', () => {
      const file = write('.claude/agents/a.md', agentText(''))
      expect(lint(OLD, file, agentText(''))).toEqual([])
    })

    it('for a file that starts like a BOM but is not one', () => {
      const code = '\ufffe' + agentText('')
      const file = write('.claude/agents/a.md', code)
      expect(lint(OLD, file, code)).toEqual([])
    })

    it('for a file that is shorter than a BOM', () => {
      const file = write('.claude/agents/a.md', '#')
      expect(lint(OLD, file, '#')).toEqual([])
    })

    it('for a BOM inside the text, not at the start', () => {
      const code = agentText('') + BOM
      const file = write('.claude/agents/a.md', code)
      expect(lint(OLD, file, code)).toEqual([])
    })

    it('for a file that is not on disk', () => {
      const file = path.join(scratch, 'missing', '.claude', 'agents', 'a.md')
      expect(lint(OLD, file)).toEqual([])
    })

    it('for a file outside the agent folders', () => {
      const file = write('docs/agents-notes/a.md', BOM + agentText(''))
      expect(lint(OLD, file)).toEqual([])
    })

    it('for an agents folder in a directory that is no plugin and no .claude', () => {
      const file = write('agents/a.md', BOM + agentText(''))
      expect(lint(OLD, file)).toEqual([])
    })

    it.skipIf(chmodCannotBlock)('for a file without read access', () => {
      const file = write('.claude/agents/a.md', BOM + agentText(''))
      withoutAccess(file, () => {
        expect(lint(OLD, file)).toEqual([])
      })
      chmodSync(file, 0o644)
    })
  })

  it('rejects a minVersion that is not major.minor.patch', () => {
    const file = write('.claude/agents/a.md', BOM + agentText(''))
    expect(() => lint([{ minVersion: 'latest' }], file)).toThrow(/should match pattern/)
    for (const bad of ['v2.1.0', '2.1.0-beta', '2.1.0.1']) {
      expect(() => lint([{ minVersion: bad }], file)).toThrow(/should match pattern/)
    }
    expect(() => lint([{ other: 1 }], file)).toThrow()
  })
})
