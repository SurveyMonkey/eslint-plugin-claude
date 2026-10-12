// ESLint checks the rule definitions in `src/rules/` with eslint-plugin-eslint-plugin.
// Biome lints all the source, and `src/rules/` too (ADR 001, Decision 7).
import { stripTypeScriptTypes } from 'node:module'
import eslintPlugin from 'eslint-plugin-eslint-plugin'
import * as espree from 'espree'

// The parser removes the TypeScript types, then espree parses the JavaScript that remains.
// The parser puts spaces where the types were. Each report then points at the line
// and column in the `.ts` file. `tsconfig.json` sets `erasableSyntaxOnly`, so the strip
// mode can remove all the TypeScript syntax in `src/`.
const typeStripParser = {
  meta: { name: 'type-strip-espree' },
  parseForESLint(code) {
    const ast = espree.parse(stripTypeScriptTypes(code, { mode: 'strip' }), {
      ecmaVersion: 'latest',
      sourceType: 'module',
      range: true,
      loc: true,
      comment: true,
      tokens: true,
    })
    return { ast }
  },
}

export default [
  {
    ...eslintPlugin.configs.recommended,
    files: ['src/rules/*.ts'],
    languageOptions: { parser: typeStripParser },
  },
]
