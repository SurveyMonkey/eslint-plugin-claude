// A path rule uses the POSIX form. Claude Code normalizes a Windows path before it matches, so
// `C:\Users\alice` is `/c/Users/alice`, and a rule uses `//c/Users/alice`
// (docs/rules/permissions-windows-path.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { PATH_TOOLS, pathSpecifier, windowsFault } from '../permission-path.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-windows-path' as const

type MessageId = 'driveLetter' | 'backslash'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a path rule in POSIX form, not with a drive letter or a backslash',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      driveLetter:
        '`{{rule}}` starts with a drive letter. Claude Code matches POSIX paths, where `C:\\Users\\alice` is `/c/Users/alice`. Start an absolute path with `//c/`.',
      backslash:
        '`{{rule}}` has a backslash as a path separator. Claude Code matches POSIX paths. Write `/` between segments.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const entry of entries) {
        const specifier = pathSpecifier(entry, PATH_TOOLS)
        if (specifier === null) {
          continue
        }
        const fault = windowsFault(specifier)
        if (fault !== null) {
          context.report({
            loc: entry.loc,
            messageId: fault,
            data: { rule: `${entry.rule.tool}(${specifier})` },
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
