// `permissions.defaultMode: "auto"` has no effect in `.claude/settings.json` and
// `.claude/settings.local.json`. Claude Code also skips the `defaultMode` of the user settings
// then (docs/rules/permissions-default-mode-project-ignored.md). `bypassPermissions` is ignored
// there too, and `permissions-bypass-mode-committed` reports it, so one fault gets one report.
// `settings-key-scope` makes no report on the key, because every file may hold it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { kindOf } from '../settings-files.ts'

const name = 'permissions-default-mode-project-ignored' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set permissions.defaultMode to auto in a project or local settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored:
        '"defaultMode": "auto" has no effect in a project or local settings file. Claude Code also skips the "defaultMode" of ~/.claude/settings.json and uses its built-in default. Set it in user or managed settings.',
    },
  },
  create(context) {
    // A managed file can set the value. The `files` glob does not reach one, so this guards a
    // config that lints it anyway.
    if (kindOf(context.filename) === 'managed') {
      return {}
    }
    return {
      Document(node) {
        const value = lastMember(lastMember(node.body, 'permissions')?.value, 'defaultMode')?.value
        if (value?.type === 'String' && value.value === 'auto') {
          context.report({ node: value, messageId: 'ignored' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
