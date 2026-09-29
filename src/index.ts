import { createRequire } from 'node:module'
import type { ESLint, Linter, Rule } from 'eslint'

// Read at run time, not imported, so `dist/` does not need its own copy.
// `../package.json` resolves from both `src/` and `dist/`.
const { name, version } = createRequire(import.meta.url)('../package.json') as {
  name: string
  version: string
}

const rules: Record<string, Rule.RuleModule> = {}

const plugin = {
  meta: { name, version, namespace: 'claude' },
  rules,
  configs: {} as Record<string, Linter.Config>,
} satisfies ESLint.Plugin

plugin.configs.recommended = {
  name: 'claude/recommended',
  plugins: { claude: plugin },
  rules: {},
}

export default plugin
