// A `case.yaml` in the eval suite of a plugin sets `schema_version: "1.1"` and `name`. The paths in
// `context.scaffold_script`, `context.history_file` and `context.add_dirs` are in the case
// directory (docs/rules/plugin-evals-case-yaml.md). ESLint has no YAML language, so the rule lints
// the manifest, as `plugin-evals-results-gitignored` does, and reads the case files of the eval
// directory. It reports at the start of the manifest. The rule makes no report that rests on a file
// that it cannot read (ADR 001, Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { EVAL_CASE_SCHEMA_VERSION } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { isMap } from '../frontmatter-values.ts'
import { realSource } from '../marketplace-source.ts'
import { caseDirectories, evalDirectoryOf, readCaseYaml } from '../plugin-evals.ts'
import { isInside } from '../skill-tree.ts'

const name = 'plugin-evals-case-yaml' as const

/** The `context` keys that name a path, and whether the value is a list. */
const PATH_KEYS = [
  ['scaffold_script', false],
  ['history_file', false],
  ['add_dirs', true],
] as const

const rule: JSONRuleDefinition<{
  MessageIds: 'noVersion' | 'badVersion' | 'noName' | 'outside' | 'missing'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give a case.yaml its schema_version and name, and keep its paths in the case',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noVersion: `The file "{{file}}" has no \`schema_version\`. A case.yaml needs \`schema_version: "${EVAL_CASE_SCHEMA_VERSION}"\`.`,
      badVersion: `The file "{{file}}" sets \`schema_version\` to {{value}}. A case.yaml needs \`schema_version: "${EVAL_CASE_SCHEMA_VERSION}"\`.`,
      noName: 'The file "{{file}}" has no `name`. A case.yaml needs a `name`.',
      outside:
        'The file "{{file}}" names "{{path}}" in `context.{{key}}`. The path is not inside the case directory, and the docs ask for a path inside it.',
      missing:
        'The file "{{file}}" names "{{path}}" in `context.{{key}}`, and the case directory has no such path.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const suite = evalDirectoryOf(context.filename, node)
        if (suite === null) {
          return
        }
        for (const caseDir of caseDirectories(suite.real)) {
          const read = readCaseYaml(path.join(caseDir, 'case.yaml'), suite.bound)
          if (read === null) {
            continue
          }
          const { data } = read
          const relative = path.relative(suite.real, path.join(caseDir, 'case.yaml'))
          const file = `${suite.name}/${relative.split(path.sep).join('/')}`
          const version = data.schema_version
          if (version === null || version === undefined) {
            context.report({ node, messageId: 'noVersion', data: { file } })
          } else if (
            // The docs write the version as a string. A number 1.1 is the same text, and the
            // docs do not say that Claude Code refuses it.
            !(typeof version === 'string' || typeof version === 'number') ||
            String(version) !== EVAL_CASE_SCHEMA_VERSION
          ) {
            context.report({
              node,
              messageId: 'badVersion',
              data: { file, value: read.written('schema_version') },
            })
          }
          if (data.name === null || data.name === undefined || data.name === '') {
            context.report({ node, messageId: 'noName', data: { file } })
          }
          const paths = isMap(data.context) ? data.context : {}
          for (const [key, isList] of PATH_KEYS) {
            const value = paths[key]
            const entries = isList ? (Array.isArray(value) ? value : []) : [value]
            for (const entry of entries) {
              if (typeof entry !== 'string') {
                continue
              }
              // An empty path stands for the case directory, so it passes the checks below.
              const target = path.resolve(caseDir, entry)
              let fault: 'outside' | 'missing' | null = null
              if (!isInside(target, caseDir)) {
                fault = 'outside'
              } else {
                // A link on the path can lead out of the case, or out of the repository.
                const real = realSource(caseDir, caseDir, suite.bound, target)
                if (typeof real === 'string') {
                  fault = isInside(real, caseDir) ? null : 'outside'
                } else if (real.kind === 'missing') {
                  fault = 'missing'
                }
              }
              if (fault !== null) {
                context.report({ node, messageId: fault, data: { file, key, path: entry } })
              }
            }
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
}

export default rule
