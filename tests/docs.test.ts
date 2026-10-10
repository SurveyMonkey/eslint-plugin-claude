// Each rule links to its own doc. A rule with no doc, or a URL that names
// another file, sends the reader of a report to a 404.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import { parse } from 'yaml'
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
    'claude-md-agents-md-prose-pointer',
    'claude-md-agents-md-shadowed',
    'claude-md-agents-md-variant',
    'claude-md-combined-size',
    'claude-md-excludes-absolute-committed',
    'claude-md-excludes-pattern',
    'claude-md-html-comment-content',
    'claude-md-import-exists',
    'claude-md-import-external',
    'claude-md-import-in-code-span',
    'claude-md-import-max-depth',
    'claude-md-location',
    'claude-md-max-bytes',
    'claude-md-max-lines',
    'claude-md-symlink',
    'command-legacy-format',
    'hooks-event-name-known',
    'marketplace-command-version-ignored',
    'marketplace-entry-component-paths',
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
    'memory-auto-memory-directory-committed',
    'memory-index-max-size',
    'memory-settings-schema',
    'memory-symlink-network-target',
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
    'rules-frontmatter-schema',
    'rules-max-lines',
    'rules-md-extension',
    'rules-paths-glob-valid',
    'rules-paths-no-match',
    'rules-symlink-external',
    'rules-symlink-external-scoped',
    'settings-conflicting-keys',
    'settings-enabled-plugins-entry-exists',
    'settings-enabled-plugins-schema',
    'settings-env-credential',
    'settings-env-ignored-var',
    'settings-env-shadowed',
    'settings-env-value-format',
    'settings-extra-known-marketplaces-key-matches-name',
    'settings-extra-known-marketplaces-schema',
    'settings-file-size',
    'settings-key-scope',
    'settings-known-marketplaces-policy-schema',
    'settings-managed-file',
    'settings-marketplace-headers-helper-https',
    'settings-marketplace-key-alias-conflict',
    'settings-model-list',
    'settings-model-value',
    'settings-plugin-suggestion-marketplaces-source',
    'settings-project-value-ignored',
    'settings-removed-key',
    'settings-skilloverrides-key',
    'settings-sync-claude-ai-plugins',
    'settings-valid-json',
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

// The docs watch reads the `description` of each rule doc with `yaml`
// (`loadRules` in scripts/docs-classify.ts). One frontmatter that does not
// parse stops the whole watch.
it('gives each rule doc frontmatter that parses, with a string description', () => {
  const docs = readdirSync(DOCS).filter((file) => file.endsWith('.md') && file !== 'index.md')
  expect(docs.length).toBeGreaterThan(0)
  for (const file of docs) {
    const text = readFileSync(path.join(DOCS, file), 'utf8')
    expect(text.startsWith('---\n'), file).toBe(true)
    const front = text.slice(4, text.indexOf('\n---', 4))
    let description: unknown
    expect(() => {
      description = (parse(front) as { description?: unknown } | null)?.description
    }, file).not.toThrow()
    expect(typeof description, file).toBe('string')
  }
})
