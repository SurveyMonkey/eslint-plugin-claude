// Cloud sessions ignore `defaultMode: "dontAsk"` from a settings file, and the VS Code extension
// never reads the starting mode from a project or local file
// (docs/rules/permissions-default-mode-surface.md). `bypassPermissions` is for
// `permissions-bypass-mode-committed`, and `auto` in a project file is for
// `permissions-default-mode-project-ignored`, so one fault gets one report.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-default-mode-surface' as const

type Options = [{ vscode?: boolean }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'cloud' | 'vscode' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not rely on permissions.defaultMode where a Claude Code surface ignores it',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { vscode: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      cloud:
        'Cloud sessions ignore "defaultMode": "dontAsk" from a settings file. They honor only acceptEdits, plan, default and auto.',
      vscode:
        'The VS Code extension never reads "defaultMode" from a project or local settings file. Set it in user or managed settings.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const [{ vscode = false }] = context.options
    const reportsVscode = vscode && kindOf(context.filename) !== 'managed'
    return {
      Document(node) {
        const value = lastMember(lastMember(node.body, 'permissions')?.value, 'defaultMode')?.value
        if (value?.type !== 'String') {
          return
        }
        if (value.value === 'dontAsk') {
          context.report({ node: value, messageId: 'cloud' })
        }
        // `auto` and `bypassPermissions` in a project file have a rule of their own.
        if (reportsVscode && value.value !== 'auto' && value.value !== 'bypassPermissions') {
          context.report({ node: value, messageId: 'vscode' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
