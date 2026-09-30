import { createRequire } from 'node:module'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import type { ESLint, Linter } from 'eslint'
import commandLegacyFormat from './rules/command-legacy-format.ts'
import hooksEventNameKnown from './rules/hooks-event-name-known.ts'
import skillDescriptionMaxLength from './rules/skill-description-max-length.ts'

// Read at run time, not imported, so `dist/` does not need its own copy.
// `../package.json` resolves from both `src/` and `dist/`.
const { name, version } = createRequire(import.meta.url)('../package.json') as {
  name: string
  version: string
}

// Each rule module names its own files and language, so a new rule adds no
// entry to a central glob list.
const modules = [skillDescriptionMaxLength, commandLegacyFormat, hooksEventNameKnown]

type RuleName = (typeof modules)[number]['name']
type Severity = 'off' | 'warn' | 'error'

const LANGUAGES: Record<(typeof modules)[number]['language'], Linter.Config> = {
  markdown: { language: 'markdown/gfm', languageOptions: { frontmatter: 'yaml' } },
  json: { language: 'json/json' },
}

// Each rule at its `recommended` severity. A rule whose source is not the
// Claude Code or Agent Skills docs is `off` here.
const recommended: Record<RuleName, Severity> = {
  'skill-description-max-length': 'warn',
  'command-legacy-format': 'warn',
  'hooks-event-name-known': 'error',
}

// `strict` keeps each `recommended` severity, and turns `off` into `warn`.
const STRICT: Record<Severity, Severity> = { off: 'warn', warn: 'warn', error: 'error' }

// Annotated, not inferred: the inferred type reaches into @eslint/core, which
// the declaration emit cannot name. `meta` and each config key are required
// here, because `ESLint.Plugin` makes them optional and consumers would have
// to check for `undefined`. `ESLint.Plugin['rules']` rather than
// `Rule.RuleModule`, which types JavaScript rules only. Each config is an
// array of one block per rule. Add a key for a new config.
type Plugin = ESLint.Plugin & {
  meta: { name: string; version: string; namespace: 'claude' }
  rules: NonNullable<ESLint.Plugin['rules']>
  configs: { recommended: Linter.Config[]; strict: Linter.Config[] }
}

const plugin: Plugin = {
  meta: { name, version, namespace: 'claude' },
  rules: Object.fromEntries(modules.map((m) => [m.name, m.rule])),
  // Filled in below, once `plugin` exists to reference itself.
  configs: { recommended: [], strict: [] },
}

/** One block for each rule that `severity` turns on, with the rule's own
 *  files and language. The block also registers the language plugins, so a
 *  consumer needs no other setup. */
function configFor(config: string, severity: (rule: RuleName) => Severity): Linter.Config[] {
  return modules
    .filter((m) => severity(m.name) !== 'off')
    .map((m) => ({
      name: `claude/${config}/${m.name}`,
      files: m.files,
      plugins: { claude: plugin, markdown, json },
      ...LANGUAGES[m.language],
      rules: { [`claude/${m.name}`]: severity(m.name) },
    }))
}

plugin.configs.recommended = configFor('recommended', (rule) => recommended[rule])
plugin.configs.strict = configFor('strict', (rule) => STRICT[recommended[rule]])

export default plugin
