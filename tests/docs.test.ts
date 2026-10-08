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
    'agent-frontmatter-schema',
    'agent-frontmatter-valid',
    'agent-mcp-servers-schema',
    'agent-memory-auto-memory-off',
    'agent-memory-grants-write',
    'agent-model-forced',
    'agent-name-unique',
    'agent-omit-claude-md-main',
    'agent-permission-mode-bypass',
    'agent-plugin-ignored-fields',
    'agent-skills-preloadable',
    'agent-teams-no-project-config',
    'agent-tools-known',
    'agent-tools-unavailable',
    'command-legacy-format',
    'hooks-event-name-known',
    'marketplace-command-version-ignored',
    'marketplace-entry-hooks-inline',
    'marketplace-entry-hooks-override',
    'marketplace-entry-manifest-only-fields',
    'marketplace-entry-name-matches-manifest',
    'marketplace-entry-root-skills',
    'marketplace-headers-helper-command',
    'marketplace-name-reserved',
    'marketplace-relative-source-escape-symlink',
    'marketplace-relative-source-exists',
    'marketplace-relative-source-format',
    'marketplace-schema',
    'marketplace-source-schema',
    'marketplace-strict-false-conflict',
    'marketplace-version-duplicate',
    'output-style-frontmatter-schema',
    'output-style-frontmatter-valid',
    'permissions-mcp-rule-parens',
    'permissions-param-rule',
    'permissions-path-rule-tool',
    'permissions-rule-syntax',
    'permissions-skill-rule',
    'permissions-specifier-unsupported',
    'permissions-tool-name-glob',
    'permissions-unknown-tool',
    'skill-agent-exists',
    'skill-allowed-tools-broad',
    'skill-allowed-tools-ineffective',
    'skill-description-max-length',
    'skill-file-layout',
    'skill-fork-fields-require-context',
    'skill-frontmatter-position',
    'skill-frontmatter-schema',
    'skill-inject-bang-position',
    'skill-invocation-unreachable',
    'skill-name-unique',
    'skill-paths-glob-valid',
    'skill-plugin-root-shadowed',
    'skill-plugin-vars-outside-plugin',
    'skill-reference-exists',
    'skill-reserved-name',
  ])
  for (const [name, rule] of rules) {
    expect(rule.meta?.docs?.url).toBe(docsUrl(name))
    expect(existsSync(path.join(DOCS, `${name}.md`)), `${name}.md`).toBe(true)
  }
})
