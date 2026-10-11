// A `Read` deny rule for a directory of generated or vendored code ends in `/**/*`, and not in
// `/**`, so that Claude can still list the directory (docs/rules/permissions-deny-dir-listable.md).
// A heuristic. The docs show the advice for the directories `dist`, `build` and `vendor`, so the
// rule reads those names, and no others. The rule reads the text of the pattern only.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { pathSpecifier } from '../permission-path.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-deny-dir-listable' as const

/** The directory names of the docs example: build output and a vendored SDK. Source: the example
 *  of "Block reads of generated and vendored code"
 *  (https://code.claude.com/docs/en/large-codebases#block-reads-of-generated-and-vendored-code). */
const DIRECTORIES = ['dist', 'build', 'vendor']

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'listable' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'End a Read deny rule for generated or vendored code in /**/* so that the directory stays listable',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      listable:
        '`Read({{pattern}})` also covers the directory "{{directory}}" itself, so Claude cannot list it or change into it. `Read({{pattern}}/*)` covers everything inside and leaves the directory listable.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const entry of entries) {
        const specifier = entry.list === 'deny' ? pathSpecifier(entry, ['Read']) : null
        const pattern = specifier ?? ''
        const directory = pattern.endsWith('/**')
          ? pattern.slice(0, -3).split('/').pop()
          : undefined
        if (
          !pattern.startsWith('!') &&
          directory !== undefined &&
          DIRECTORIES.includes(directory)
        ) {
          context.report({
            loc: entry.loc,
            messageId: 'listable',
            data: { pattern, directory },
          })
        }
      }
    })
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
}

export default rule
