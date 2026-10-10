// Red first: the rule does not exist yet, so each case is expected to fail.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-plugin-name-prefix-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}
put('plug/.claude-plugin/plugin.json', '{"name": "my-plugin"}')
const skill = put('plug/skills/s/SKILL.md', '')
const ids = (name: string, options: unknown[] = [{ minVersion: '2.1.230' }]) =>
  lintMarkdown('skill-plugin-name-prefix', `---\nname: ${name}\n---\n`, skill, options).map(
    (m) => m.messageId,
  )

describe('skill-plugin-name-prefix (red)', () => {
  it.fails('reports a name that starts with the plugin prefix', () => {
    expect(ids('my-plugin:fancy')).toEqual(['doubled'])
  })
  it.fails('stays silent for a name with no prefix', () => {
    expect(ids('fancy')).toEqual([])
  })
  it.fails('stays silent at a version that does not double the prefix', () => {
    expect(ids('my-plugin:fancy', [{ minVersion: '2.1.246' }])).toEqual([])
  })
})
