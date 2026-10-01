// Each rule links to its own doc. A rule with no doc, or a URL that names
// another file, sends the reader of a report to a 404.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import { docsUrl } from '../src/docs-url.ts'
import plugin from '../src/index.ts'

const DOCS = path.resolve(import.meta.dirname, '../docs/rules')

it('points docsUrl at docs/rules in this repository', () => {
  expect(docsUrl('a-rule')).toBe(
    'https://github.com/SurveyMonkey/eslint-plugin-claude/blob/main/docs/rules/a-rule.md',
  )
})

it('gives each rule a doc and a URL that names it', () => {
  const rules = Object.entries(plugin.rules)
  expect(rules.map(([name]) => name).sort()).toEqual([
    'command-legacy-format',
    'hooks-event-name-known',
    'skill-allowed-tools-ineffective',
    'skill-description-max-length',
    'skill-fork-fields-require-context',
    'skill-frontmatter-position',
    'skill-frontmatter-schema',
    'skill-inject-bang-position',
    'skill-invocation-unreachable',
    'skill-plugin-vars-outside-plugin',
    'skill-reserved-name',
  ])
  for (const [name, rule] of rules) {
    expect(rule.meta?.docs?.url).toBe(docsUrl(name))
    expect(existsSync(path.join(DOCS, `${name}.md`)), `${name}.md`).toBe(true)
  }
})
