import { createRequire } from 'node:module'
import type { ESLint, Linter } from 'eslint'

// Read at run time, not imported, so `dist/` does not need its own copy.
// `../package.json` resolves from both `src/` and `dist/`.
const { name, version } = createRequire(import.meta.url)('../package.json') as {
  name: string
  version: string
}

// Annotated, not inferred: the inferred type reaches into @eslint/core, which
// the declaration emit cannot name. `meta` and each config key are required
// here, because `ESLint.Plugin` makes them optional and consumers would have
// to check for `undefined`. `ESLint.Plugin['rules']` rather than
// `Rule.RuleModule`, which types JavaScript rules only. Each config is an
// array so it can hold one block per language. Add a key for a new config.
type Plugin = ESLint.Plugin & {
  meta: { name: string; version: string; namespace: 'claude' }
  rules: NonNullable<ESLint.Plugin['rules']>
  configs: { recommended: Linter.Config[] }
}

const plugin: Plugin = {
  meta: { name, version, namespace: 'claude' },
  rules: {},
  // Filled in below, once `plugin` exists to reference itself.
  configs: { recommended: [] },
}

plugin.configs.recommended = [
  {
    name: 'claude/recommended',
    plugins: { claude: plugin },
    rules: {},
  },
]

export default plugin
