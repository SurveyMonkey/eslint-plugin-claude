// A pattern such as `Edit(src/**)` matches one directory in an `allow` rule and a directory of
// that name at any depth in a `deny` or `ask` rule
// (docs/rules/permissions-allow-dir-depth.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { GITIGNORE_TOOLS, pathSpecifier, singleSegmentDirectory } from '../permission-path.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-allow-dir-depth' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'depth' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write the depth of a one-directory allow pattern for Read and Edit',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      depth:
        '`{{tool}}({{pattern}})` in allow matches only `<cwd>/{{directory}}`, not a `{{directory}}` directory at a deeper level. Write `{{tool}}(/{{pattern}})` for that one directory, or `{{tool}}(**/{{pattern}})` for any depth.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const entry of entries) {
        const pattern = entry.list === 'allow' ? pathSpecifier(entry, GITIGNORE_TOOLS) : null
        const directory = pattern === null ? null : singleSegmentDirectory(pattern)
        if (pattern !== null && directory !== null) {
          context.report({
            loc: entry.loc,
            messageId: 'depth',
            data: { tool: entry.rule.tool, pattern: pattern.trim(), directory },
          })
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
