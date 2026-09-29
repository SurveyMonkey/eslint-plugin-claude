import { createRequire } from 'node:module'
import type { ESLint, Linter } from 'eslint'

// Read at run time, not imported, so `dist/` does not need its own copy.
// `../package.json` resolves from both `src/` and `dist/`.
const { name, version } = createRequire(import.meta.url)('../package.json') as {
  name: string
  version: string
}

// Annotated, not inferred: the inferred type reaches into @eslint/core, which
// the declaration emit cannot name. `ESLint.Plugin['rules']` rather than
// `Rule.RuleModule`, which types JavaScript rules only. Each config is an
// array: one block per language (Markdown, JSON) once rules exist.
type Plugin = ESLint.Plugin & {
  rules: NonNullable<ESLint.Plugin['rules']>
  configs: Record<string, Linter.Config[]>
}

const plugin: Plugin = {
  meta: { name, version, namespace: 'claude' },
  rules: {},
  configs: {},
}

plugin.configs.recommended = [
  {
    name: 'claude/recommended',
    plugins: { claude: plugin },
    rules: {},
  },
]

export default plugin
