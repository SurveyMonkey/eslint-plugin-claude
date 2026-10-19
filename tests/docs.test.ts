// Each rule links to its own doc. A rule with no doc, or a URL that names
// another file, sends the reader of a report to a 404.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { Linter } from 'eslint'
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
    'agent-body-nonempty',
    'agent-description-proactive',
    'agent-descriptions-budget',
    'agent-disallowed-tools-scope',
    'agent-field-min-version',
    'agent-frontmatter-schema',
    'agent-frontmatter-valid',
    'agent-initial-prompt-main-only',
    'agent-mcp-servers-inline-trust',
    'agent-mcp-servers-ref-exists',
    'agent-mcp-servers-schema',
    'agent-memory-auto-memory-off',
    'agent-memory-grants-write',
    'agent-memory-scope-project',
    'agent-model-forced',
    'agent-model-value',
    'agent-name-kebab-case',
    'agent-name-shadowing',
    'agent-name-shadows-builtin',
    'agent-name-unique',
    'agent-no-bom',
    'agent-omit-claude-md-main',
    'agent-permission-mode-auto-unavailable',
    'agent-permission-mode-bypass',
    'agent-permission-mode-manual',
    'agent-plugin-ignored-fields',
    'agent-plugin-scoped-name-unique',
    'agent-skills-exist',
    'agent-skills-preload-limit',
    'agent-skills-preloadable',
    'agent-teammate-ignored-fields',
    'agent-teams-no-project-config',
    'agent-tools-agent-type-list',
    'agent-tools-conditional',
    'agent-tools-known',
    'agent-tools-skill-for-preload',
    'agent-tools-task-alias',
    'agent-tools-unavailable',
    'claude-md-agents-md-prose-pointer',
    'claude-md-agents-md-shadowed',
    'claude-md-agents-md-variant',
    'claude-md-combined-size',
    'claude-md-dangling-reference',
    'claude-md-derivable-content',
    'claude-md-emphasis-overuse',
    'claude-md-excludes-absolute-committed',
    'claude-md-excludes-pattern',
    'claude-md-git-instructions',
    'claude-md-guardrail-to-hook',
    'claude-md-html-comment-content',
    'claude-md-import-exists',
    'claude-md-import-external',
    'claude-md-import-in-code-span',
    'claude-md-import-max-depth',
    'claude-md-local-untracked',
    'claude-md-location',
    'claude-md-max-bytes',
    'claude-md-max-lines',
    'claude-md-procedure-to-skill',
    'claude-md-symlink',
    'command-legacy-format',
    'frontmatter-yaml-portable',
    'hooks-agent-stop-event',
    'hooks-agent-type-experimental',
    'hooks-async-on-blocking-event',
    'hooks-broad-auto-approve',
    'hooks-command-deprecated-cli-flag',
    'hooks-command-path-variable',
    'hooks-command-removed-cli-flag',
    'hooks-command-shell-safety',
    'hooks-committed-command-review',
    'hooks-config-schema',
    'hooks-disable-all-override',
    'hooks-disabled-by-disableallhooks',
    'hooks-duplicate-handler',
    'hooks-env-var-unavailable',
    'hooks-event-name-known',
    'hooks-exec-form-command-spaces',
    'hooks-exec-form-shell-syntax',
    'hooks-exec-form-windows-shim',
    'hooks-filechanged-star-matcher',
    'hooks-handler-field-ignored',
    'hooks-handler-field-unknown',
    'hooks-handler-type-event-support',
    'hooks-http-env-allowlist',
    'hooks-http-literal-secret',
    'hooks-if-condition',
    'hooks-if-dir-glob-depth',
    'hooks-matcher-bash-without-powershell',
    'hooks-matcher-deprecated-value',
    'hooks-matcher-enum',
    'hooks-matcher-legacy-version',
    'hooks-matcher-mcp-name',
    'hooks-matcher-name-unresolved',
    'hooks-matcher-never-matches',
    'hooks-matcher-subagent-anchor',
    'hooks-matcher-syntax',
    'hooks-matcher-unanchored-regex',
    'hooks-matcher-unsupported-event',
    'hooks-multiple-updatedinput',
    'hooks-no-standalone-file',
    'hooks-output-blocking-exit-code',
    'hooks-output-deprecated-fields',
    'hooks-output-schema',
    'hooks-output-size',
    'hooks-placeholder-quoted',
    'hooks-powershell-placeholder',
    'hooks-prefer-exec-form',
    'hooks-prompt-on-permission-request',
    'hooks-ps1-needs-powershell-shell',
    'hooks-script-executable',
    'hooks-script-exists',
    'hooks-script-shebang',
    'hooks-sessionend-default-timeout',
    'hooks-sessionstart-static-context',
    'hooks-stop-loop-guard',
    'hooks-timeout-units',
    'hooks-worktree-create-without-remove',
    'lsp-duplicate-server-name',
    'lsp-extension-conflict',
    'lsp-json-location',
    'lsp-json-schema',
    'lsp-transport-socket',
    'marketplace-archive-sha256',
    'marketplace-command-link-mode',
    'marketplace-command-source',
    'marketplace-command-version-ignored',
    'marketplace-entry-component-paths',
    'marketplace-entry-hooks-inline',
    'marketplace-entry-hooks-override',
    'marketplace-entry-manifest-only-fields',
    'marketplace-entry-name-matches-manifest',
    'marketplace-entry-root-skills',
    'marketplace-headers-helper-command',
    'marketplace-headers-literal-credential',
    'marketplace-location',
    'marketplace-min-version',
    'marketplace-name-reserved',
    'marketplace-relative-source-backslash',
    'marketplace-relative-source-escape-symlink',
    'marketplace-relative-source-exists',
    'marketplace-relative-source-format',
    'marketplace-relative-source-url-hosted',
    'marketplace-schema',
    'marketplace-self-hosted-root-source',
    'marketplace-source-schema',
    'marketplace-strict-false-conflict',
    'marketplace-version-duplicate',
    'mcp-allow-deny-overlap',
    'mcp-allowlist-empty',
    'mcp-allowlist-servername-dead',
    'mcp-always-load-count',
    'mcp-anthropic-hosted-url',
    'mcp-approval-committed',
    'mcp-approval-conflict',
    'mcp-approval-names-exist',
    'mcp-authorization-header-with-oauth',
    'mcp-credential-var-remote',
    'mcp-disable-connectors-false',
    'mcp-duplicate-server-name',
    'mcp-env-client-secret',
    'mcp-env-expansion-field',
    'mcp-env-var-default',
    'mcp-env-var-numbers',
    'mcp-env-var-syntax',
    'mcp-headershelper-committed',
    'mcp-headershelper-credential-env',
    'mcp-headershelper-path',
    'mcp-hidden-whitespace',
    'mcp-insecure-url',
    'mcp-json-file-size',
    'mcp-json-location',
    'mcp-json-servers-key',
    'mcp-managed-servers-entry',
    'mcp-no-literal-secrets',
    'mcp-no-sse-transport',
    'mcp-oauth-transport',
    'mcp-oauth-values',
    'mcp-plugin-root-paths',
    'mcp-plugin-stdio-reach',
    'mcp-plugin-tool-name-scoped',
    'mcp-policy-entry-schema',
    'mcp-policy-literal-values',
    'mcp-policy-servername-weak',
    'mcp-project-dir-default',
    'mcp-project-plugin-bundle',
    'mcp-project-toggle-keys',
    'mcp-remote-url-empty',
    'mcp-server-name-anthropic-skills',
    'mcp-server-name-format',
    'mcp-server-name-reserved',
    'mcp-server-schema',
    'mcp-settings-mcpservers',
    'mcp-stdio-command-has-args',
    'mcp-stdio-relative-path',
    'mcp-timeout-min',
    'mcp-tool-name-format',
    'mcp-tool-server-unknown',
    'mcp-unknown-keys',
    'memory-agent-memory-local-untracked',
    'memory-agent-memory-orphan',
    'memory-auto-memory-directory-committed',
    'memory-index-entry-format',
    'memory-index-max-size',
    'memory-settings-schema',
    'memory-symlink-network-target',
    'memory-topic-frontmatter',
    'output-style-force-for-plugin',
    'output-style-frontmatter-schema',
    'output-style-frontmatter-valid',
    'output-style-name-unique',
    'output-style-plugin-name-description',
    'permissions-additional-directories-no-config',
    'permissions-additional-directories-path',
    'permissions-agent-rule-exists',
    'permissions-allow-dir-depth',
    'permissions-allow-unrestricted',
    'permissions-auto-mode-defaults',
    'permissions-auto-mode-dropped-allow',
    'permissions-auto-mode-push-ask',
    'permissions-auto-mode-rule-syntax',
    'permissions-auto-mode-schema',
    'permissions-bash-argument-constraint',
    'permissions-bash-colon-star-mid',
    'permissions-bash-colon-star-suffix',
    'permissions-bash-deny-not-boundary',
    'permissions-bash-exec-wrapper-prefix',
    'permissions-bash-glued-wildcard',
    'permissions-bash-readonly-redundant',
    'permissions-bash-runner-wildcard',
    'permissions-bash-stripped-wrapper',
    'permissions-bash-wildcard-before-subcommand',
    'permissions-block-reads-false',
    'permissions-bypass-mode-committed',
    'permissions-cd-allowlist',
    'permissions-dead-allow',
    'permissions-default-mode-conflict',
    'permissions-default-mode-manual-alias',
    'permissions-default-mode-project-ignored',
    'permissions-default-mode-surface',
    'permissions-default-mode-value',
    'permissions-deny-all-tools',
    'permissions-deny-dir-listable',
    'permissions-deny-secret-files',
    'permissions-disable-mode-value',
    'permissions-duplicate-rule',
    'permissions-end-conversation',
    'permissions-glob-grep-allow',
    'permissions-ignore-patterns',
    'permissions-invalid-path-pattern',
    'permissions-legacy-tool-name',
    'permissions-mcp-rule-parens',
    'permissions-mcp-server-exists',
    'permissions-negation',
    'permissions-param-rule',
    'permissions-param-rule-intent',
    'permissions-path-anchor',
    'permissions-path-rule-tool',
    'permissions-protected-path-allow',
    'permissions-read-deny-notebook',
    'permissions-rule-syntax',
    'permissions-sandbox-bash-ask',
    'permissions-schema',
    'permissions-skill-rule',
    'permissions-specifier-unsupported',
    'permissions-tool-name-glob',
    'permissions-unknown-tool',
    'permissions-webfetch-apex',
    'permissions-webfetch-domain-syntax',
    'permissions-webfetch-mid-wildcard',
    'permissions-windows-path',
    'plugin-bin-claude-ai',
    'plugin-bin-executable',
    'plugin-bin-shadows-system-command',
    'plugin-channel-server-stdio',
    'plugin-commands-dir-nonempty',
    'plugin-commands-map-fields',
    'plugin-default-dir-shadowed',
    'plugin-dependencies-not-auto-installed',
    'plugin-dependencies-prerelease-range',
    'plugin-dependencies-resolve',
    'plugin-dir-not-marketplace-root',
    'plugin-evals-case-yaml',
    'plugin-evals-dir',
    'plugin-evals-grader',
    'plugin-evals-mock-schema',
    'plugin-evals-mock-server-exists',
    'plugin-evals-prompt-frontmatter',
    'plugin-evals-prompt-no-at-mentions',
    'plugin-evals-replay-committed',
    'plugin-evals-results-gitignored',
    'plugin-feature-min-version',
    'plugin-manifest-location',
    'plugin-manifest-metadata-format',
    'plugin-manifest-no-bom',
    'plugin-manifest-publish-metadata',
    'plugin-manifest-version-semver',
    'plugin-monitors-command-env',
    'plugin-monitors-command-quote',
    'plugin-monitors-skill-exists',
    'plugin-no-git-lfs',
    'plugin-no-parent-path-escape',
    'plugin-no-project-plugins-dir',
    'plugin-no-state-in-plugin-root',
    'plugin-npm-source-shrinkwrap',
    'plugin-package-lifecycle-scripts',
    'plugin-package-lockfile',
    'plugin-package-lockfile-choice',
    'plugin-path-no-backslash',
    'plugin-path-uses-plugin-root',
    'plugin-path-var-braced',
    'plugin-project-skills-dir-limits',
    'plugin-relevance-signal-hints',
    'plugin-settings-agent-exists',
    'plugin-settings-keys',
    'plugin-settings-single-source',
    'plugin-skill-dir-layout',
    'plugin-skills-key-redundant-default',
    'plugin-symlink-escapes-marketplace',
    'plugin-symlink-escapes-plugin',
    'plugin-themes-layout',
    'plugin-user-config-field-applicability',
    'plugin-user-config-no-shell-fields',
    'plugin-user-config-sensitive',
    'plugin-user-config-sensitive-in-content',
    'rules-frontmatter-schema',
    'rules-max-lines',
    'rules-md-extension',
    'rules-paths-glob-valid',
    'rules-paths-no-match',
    'rules-symlink-external',
    'rules-symlink-external-scoped',
    'sandbox-allow-write-escalation',
    'sandbox-credentials-aws',
    'sandbox-credentials-mask',
    'sandbox-credentials-mask-fallback',
    'sandbox-credentials-recommended',
    'sandbox-docker-excluded',
    'sandbox-domain-broad',
    'sandbox-domain-duplicate',
    'sandbox-domain-overlap',
    'sandbox-domain-syntax',
    'sandbox-excluded-commands-broad',
    'sandbox-excluded-commands-syntax',
    'sandbox-filesystem-disabled-conflict',
    'sandbox-platform-limits',
    'sandbox-proxy-env',
    'sandbox-schema',
    'sandbox-scope',
    'sandbox-settings-without-enabled',
    'sandbox-unsandboxed-retry',
    'sandbox-weakening-options',
    'settings-agent-exists',
    'settings-attribution-false',
    'settings-committed-helper-command',
    'settings-conflicting-keys',
    'settings-defaultshell-powershell-tool',
    'settings-deprecated-key',
    'settings-enabled-plugins-entry-exists',
    'settings-enabled-plugins-external-source',
    'settings-enabled-plugins-marketplace-declared',
    'settings-enabled-plugins-schema',
    'settings-env-context-cost',
    'settings-env-credential',
    'settings-env-deprecated-var',
    'settings-env-format-heuristic',
    'settings-env-ignored-var',
    'settings-env-numeric-spelling',
    'settings-env-prompt-caching-off',
    'settings-env-routing',
    'settings-env-secret-heuristic',
    'settings-env-shadowed',
    'settings-env-value-format',
    'settings-extra-known-marketplaces-directory',
    'settings-extra-known-marketplaces-key-matches-name',
    'settings-extra-known-marketplaces-schema',
    'settings-file-size',
    'settings-footerlinks-pattern',
    'settings-global-only-file',
    'settings-key-scope',
    'settings-known-marketplaces-pattern-anchored',
    'settings-known-marketplaces-policy-schema',
    'settings-local-gitignored',
    'settings-local-location',
    'settings-local-untracked',
    'settings-managed-effort-cap',
    'settings-managed-file',
    'settings-managed-merge',
    'settings-managed-value-form',
    'settings-managed-version-floor',
    'settings-marketplace-headers-helper-https',
    'settings-marketplace-key-alias',
    'settings-marketplace-key-alias-conflict',
    'settings-marketplace-skip-lfs',
    'settings-model-capability',
    'settings-model-list',
    'settings-model-pin-version',
    'settings-model-value',
    'settings-nested-project-file',
    'settings-outputstyle-resolves',
    'settings-plugin-suggestion-marketplaces-source',
    'settings-project-autocontinue-off',
    'settings-project-value-ignored',
    'settings-redundant-value',
    'settings-removed-key',
    'settings-schema',
    'settings-schema-url',
    'settings-skilloverrides-key',
    'settings-skilloverrides-unknown-skill',
    'settings-strict-known-marketplaces-skills-dir',
    'settings-sync-claude-ai-plugins',
    'settings-valid-json',
    'settings-webfetch-preflight-skip',
    'settings-worktree-paths',
    'settings-worktree-sparse-claude-dir',
    'skill-agent-exists',
    'skill-allowed-tools-broad',
    'skill-allowed-tools-ineffective',
    'skill-argument-escape',
    'skill-body-token-budget',
    'skill-boolean-literal',
    'skill-description-max-length',
    'skill-description-present',
    'skill-file-layout',
    'skill-fork-fields-require-context',
    'skill-frontmatter-position',
    'skill-frontmatter-schema',
    'skill-inject-bang-position',
    'skill-inject-robustness',
    'skill-invocation-redundant-fields',
    'skill-invocation-unreachable',
    'skill-listing-budget',
    'skill-literal-dollar',
    'skill-loop-reference-invocable',
    'skill-max-lines',
    'skill-metadata-reserved-keys',
    'skill-model-override',
    'skill-name-characters',
    'skill-name-shadows-builtin',
    'skill-name-unique',
    'skill-no-bom',
    'skill-paths-glob-valid',
    'skill-plugin-name-prefix',
    'skill-plugin-path-vars',
    'skill-plugin-root-name',
    'skill-plugin-root-shadowed',
    'skill-plugin-vars-outside-plugin',
    'skill-precedence-shadowing',
    'skill-reference-exists',
    'skill-reserved-name',
    'skill-shell-platform',
    'skill-side-effects-manual-only',
    'statusline-home-path-shared',
    'statusline-script-exists',
    'statusline-script-terminal-size',
    'statusline-windows-path',
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

/** The files and the severity that `config` gives each rule. A rule with two languages has two
 *  blocks, so its files are the files of both. */
function rulesOf(config: Linter.Config[]): Map<string, { files: string[]; severity: unknown }> {
  const rules = new Map<string, { files: string[]; severity: unknown }>()
  for (const block of config) {
    for (const [id, severity] of Object.entries(block.rules ?? {})) {
      const name = id.slice('claude/'.length)
      const files = (block.files ?? []).flat().map(String)
      rules.set(name, { files: [...(rules.get(name)?.files ?? []), ...files], severity })
    }
  }
  return rules
}

const STRICT = rulesOf(plugin.configs.strict)
const RECOMMENDED = rulesOf(plugin.configs.recommended)

/** The text of the doc of `name`. */
function docOf(name: string): string {
  return readFileSync(path.join(DOCS, `${name}.md`), 'utf8')
}

// eslint-doc-generator writes no Files cell (ADR 003). A person writes it, so a test compares it
// with the files of the rule. A cell can add where the files are, after ", in ".
it('gives each rule doc a Files cell with the files of the rule', () => {
  expect(STRICT.size).toBe(Object.keys(plugin.rules).length)
  for (const [name, { files }] of STRICT) {
    const cell = /^\| Category \| Files \|\n\|-+\|-+\|\n\| [^|]+ \| (.+) \|$/m.exec(
      docOf(name),
    )?.[1]
    const globs = files.map((file) => `\`${file}\``).join(', ')
    expect(cell === globs || cell?.startsWith(`${globs}, in `), `${name}: ${cell}`).toBe(true)
  }
})

// eslint-doc-generator writes no Usage block (ADR 003). The block gives the `recommended`
// severity, or the `strict` severity for a rule that is off in `recommended` (CONTRIBUTING.md).
it('gives each rule doc a Usage block with the severity of the rule', () => {
  expect(STRICT.size).toBe(Object.keys(plugin.rules).length)
  for (const [name, strict] of STRICT) {
    const severity = (RECOMMENDED.get(name) ?? strict).severity
    const usage =
      docOf(name)
        .split(/^## Usage$/m)[1]
        ?.split(/^## /m)[0] ?? ''
    const code = /^```js\n([\s\S]*?)^```$/m.exec(usage)?.[1] ?? ''
    expect(code, name).toContain(`'claude/${name}': '${severity}'`)
  }
})

// eslint-doc-generator writes no options list in a doc that has no markers for it, and its
// `--check` then passes (ADR 003). So a test requires the markers for each rule with options.
it('gives the options list markers to each rule doc with options, and to no other', () => {
  for (const [name, rule] of Object.entries(plugin.rules)) {
    const schema = rule.meta?.schema
    const options = Array.isArray(schema) && schema.length > 0
    const doc = docOf(name)
    expect(doc.includes('<!-- begin auto-generated rule options list -->'), name).toBe(options)
    expect(doc.includes('<!-- end auto-generated rule options list -->'), name).toBe(options)
  }
})

/** A default that the hand prose under `## Options` states for one option. */
interface StatedDefault {
  option: string
  value: unknown
  sentence: string
}

/** The hand prose of the Options section: the text outside the generated list and the code
 *  fences. A list item and a paragraph are one unit each. */
function optionsProse(doc: string): string[] {
  const section = doc.split(/^## Options$/m)[1]?.split(/^## /m)[0] ?? ''
  const hand = section.replace(
    /<!-- begin auto-generated rule options list -->[\s\S]*?<!-- end auto-generated rule options list -->/,
    '',
  )
  const units: string[] = []
  let current: string[] = []
  let fence = false
  const flush = () => {
    if (current.length > 0) {
      units.push(current.join(' '))
    }
    current = []
  }
  for (const line of hand.split('\n')) {
    if (/^\s*`{3,}/.test(line)) {
      flush()
      fence = !fence
    } else if (!fence && line.trim() === '') {
      flush()
    } else if (!fence) {
      if (line.startsWith('- ')) {
        flush()
      }
      current.push(line.trim())
    }
  }
  flush()
  return units
}

/** The value after "default is" in a sentence, or `undefined` when the sentence gives none. A
 *  backtick value that is not JSON stays text, so it differs from the default and the test
 *  names it. */
function valueOfDefault(sentence: string): { value: unknown } | undefined {
  const text = /\bdefault is (`[^`]+`|\d+(?![\d,.]*\d)|an empty (?:array|list))/i.exec(
    sentence,
  )?.[1]
  if (text === undefined) {
    return undefined
  }
  if (text.startsWith('an empty')) {
    return { value: [] }
  }
  const raw = text.replaceAll('`', '')
  try {
    return { value: JSON.parse(raw) }
  } catch {
    return { value: raw }
  }
}

/** The defaults that the Options prose of a doc states. A sentence counts when it gives a value
 *  after "default is". Its unit must name exactly one option of the rule in backticks.
 *  The test skips any other sentence about a default. It can describe a Claude Code default.
 *  It can also describe an option that the unit does not name. */
function statedDefaults(doc: string, options: string[]): StatedDefault[] {
  const found: StatedDefault[] = []
  for (const unit of optionsProse(doc)) {
    const named = options.filter((option) => unit.includes(`\`${option}\``))
    if (named.length !== 1) {
      continue
    }
    for (const sentence of unit.split(/(?<=[.!?])\s+/)) {
      const stated = valueOfDefault(sentence)
      if (stated !== undefined) {
        found.push({ option: named[0] as string, value: stated.value, sentence })
      }
    }
  }
  return found
}

/** The names and defaults of the options in the schema and `defaultOptions` of a rule. */
function optionDefaults(rule: { meta?: unknown }): Map<string, unknown> {
  const meta = rule.meta as {
    schema?: Array<{ properties?: Record<string, { default?: unknown }> }>
    defaultOptions?: Array<Record<string, unknown>>
  }
  const properties = meta.schema?.[0]?.properties ?? {}
  const defaults = new Map<string, unknown>()
  for (const [option, schema] of Object.entries(properties)) {
    const given = meta.defaultOptions?.[0] ?? {}
    defaults.set(option, option in given ? given[option] : schema.default)
  }
  return defaults
}

// ADR 003 Decision 5 keeps hand prose under `## Options`, and some of it states a default.
// docs:check compares the generated list with `meta`, not this prose. So a test compares the
// default that a sentence states with the default in `meta`.

/** The stated defaults of a doc that differ from the defaults in `meta`. */
function wrongDefaults(doc: string, defaults: Map<string, unknown>): StatedDefault[] {
  return statedDefaults(doc, [...defaults.keys()]).filter(
    ({ option, value }) => !isDeepStrictEqual(value, defaults.get(option)),
  )
}

it('states in each rule doc the option defaults that meta gives', () => {
  const wrong: string[] = []
  const checked: string[] = []
  for (const [name, rule] of Object.entries(plugin.rules)) {
    const defaults = optionDefaults(rule)
    const doc = docOf(name)
    for (const { option } of statedDefaults(doc, [...defaults.keys()])) {
      checked.push(`${name}/${option}`)
    }
    for (const { sentence } of wrongDefaults(doc, defaults)) {
      wrong.push(`${name}: ${sentence}`)
    }
  }
  expect(wrong).toEqual([])
  // The match is a heuristic. This list shows that it still finds the known sentences.
  expect(checked).toEqual(['plugin-bin-claude-ai/targets', 'sandbox-domain-broad/broad'])
})

it('finds the stated defaults outside the fences and the generated list', () => {
  const doc = [
    '## Options',
    '',
    '<!-- begin auto-generated rule options list -->',
    '`max`: the default is 9.',
    '<!-- end auto-generated rule options list -->',
    '',
    '```js',
    '`max`: the default is 8.',
    '```',
    '',
    'The default is 7.',
    '',
    '`max` is a number. The default is `5`.',
    '',
    '- `names`: a list. The default is an empty list.',
    '- `max` and `names`: the default is 6.',
    '- `max`: The default is 1,536 characters in the listing.',
    '- `max`: Default is 12.',
    '- `names`: the default is an empty array.',
    '- `names`: the default is `warn`.',
    '',
    '## Sources',
    '',
    '`max`: the default is 4.',
  ].join('\n')
  expect(statedDefaults(doc, ['max', 'names']).map((d) => [d.option, d.value])).toEqual([
    ['max', 5],
    ['names', []],
    ['max', 12],
    ['names', []],
    ['names', 'warn'],
  ])
})

it('reports a stated default that differs from the default in meta', () => {
  const doc = [
    '## Options',
    '',
    '`max` is a number. The default is 5.',
    '',
    '- `names`: the default is `warn`.',
  ].join('\n')
  expect(
    wrongDefaults(
      doc,
      new Map<string, unknown>([
        ['max', 5],
        ['names', []],
      ]),
    ).map((d) => d.option),
  ).toEqual(['names'])
  expect(
    wrongDefaults(
      doc,
      new Map<string, unknown>([
        ['max', 6],
        ['names', 'warn'],
      ]),
    ).map((d) => d.option),
  ).toEqual(['max'])
})

// The generator writes the README rule list from the groups of `.eslint-doc-generatorrc.mjs`.
// `--check` compares the README with that same list, so it cannot see a rule that the list
// leaves out or names twice.
it('lists each rule once in the README rule list', () => {
  const readme = readFileSync(path.resolve(import.meta.dirname, '../README.md'), 'utf8')
  const list =
    readme
      .split('<!-- begin auto-generated rules list -->')[1]
      ?.split('<!-- end auto-generated rules list -->')[0] ?? ''
  const rows = [...list.matchAll(/^\| \[([a-z0-9-]+)\]\(docs\/rules\/\1\.md\)/gm)].map(
    (match) => match[1],
  )
  expect(rows.sort()).toEqual(Object.keys(plugin.rules).sort())
})

it('reads an explicit null default from defaultOptions before the schema default', () => {
  const meta = {
    schema: [{ properties: { a: { default: 'x' }, b: { default: 'y' } } }],
    defaultOptions: [{ a: null }],
  }
  expect([...optionDefaults({ meta })]).toEqual([
    ['a', null],
    ['b', 'y'],
  ])
})
