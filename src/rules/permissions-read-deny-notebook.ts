// A `Read` deny rule blocks Edit and Write on the same path, but not NotebookEdit. An `Edit` deny
// rule is needed for a path that no tool may change (docs/rules/permissions-read-deny-notebook.md).
// The rule rests on an absence, so it adds up the `deny` lists of one source. It makes no report
// when it cannot read a file of the source.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { pathSpecifier } from '../permission-path.ts'
import { listRules, sourceOf } from '../permission-source.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-read-deny-notebook' as const

/** The path of a rule, with white space and a leading `./` removed. `path` and `./path` name the
 *  same path (https://code.claude.com/docs/en/permissions#read-and-edit). */
const normalize = (pattern: string) => pattern.trim().replace(/^\.\//, '')

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'notebook' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Add an Edit deny rule next to a Read deny rule, because NotebookEdit is not covered',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notebook:
        '`Read({{pattern}})` in deny does not cover NotebookEdit. Add `Edit({{pattern}})` to deny for a path that no tool may change.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      const reads = entries.flatMap((entry) => {
        const pattern = entry.list === 'deny' ? pathSpecifier(entry, ['Read']) : null
        // A `!` pattern carves paths out of a block. It blocks nothing.
        return pattern === null || pattern.trim().startsWith('!')
          ? []
          : [{ loc: entry.loc, pattern: pattern.trim() }]
      })
      if (reads.length === 0) {
        return
      }
      const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
      if (!complete) {
        return
      }
      const denied = listRules(objects, 'deny')
      // A deny rule with no path matches the tool everywhere.
      if (
        denied.some(
          ({ tool, specifier }) => specifier === null && ['Edit', 'NotebookEdit'].includes(tool),
        )
      ) {
        return
      }
      const edits = new Set(
        denied.flatMap(({ tool, specifier }) =>
          tool === 'Edit' && specifier !== null ? [normalize(specifier)] : [],
        ),
      )
      for (const { loc, pattern } of reads) {
        if (!edits.has(normalize(pattern))) {
          context.report({ loc, messageId: 'notebook', data: { pattern } })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
