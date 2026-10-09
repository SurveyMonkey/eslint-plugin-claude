// `syncClaudeAiPlugins` in a project settings file
// (docs/rules/settings-sync-claude-ai-plugins.md). Claude Code reads the key in
// user, local and managed settings, and not in `.claude/settings.json`. It
// honors only `false`. A key in `.claude/settings.json` gives one report for any
// value, so a `true` there gives no second report.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'settings-sync-claude-ai-plugins' as const

const LOCAL_FILE = 'settings.local.json'

const rule: JSONRuleDefinition<{
  RuleOptions: []
  MessageIds: 'ignoredInProject' | 'trueIsUnset'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set syncClaudeAiPlugins in .claude/settings.json, or set it to true',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignoredInProject:
        'Claude Code ignores "syncClaudeAiPlugins" in .claude/settings.json. A repository cannot turn off the sync.',
      trueIsUnset:
        'Claude Code honors only false for "syncClaudeAiPlugins". The value true is the same as unset.',
    },
  },
  create(context) {
    const isLocal = path.basename(context.filename) === LOCAL_FILE
    return {
      Document(node) {
        const member = lastMember(node.body, 'syncClaudeAiPlugins')
        if (member === undefined) {
          return
        }
        if (!isLocal) {
          context.report({ node: member.name, messageId: 'ignoredInProject' })
        } else if (member.value.type === 'Boolean' && member.value.value) {
          context.report({ node: member.value, messageId: 'trueIsUnset' })
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
