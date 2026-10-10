// A value that Claude Code treats as an unset key (docs/rules/settings-redundant-value.md). The
// rule makes no report that another rule already makes: `settings-key-scope` reports
// `syncClaudeAiSkills` in `.claude/settings.json`, and `settings-sync-claude-ai-plugins` reports
// `syncClaudeAiPlugins` in both project files. A managed file has no other report for either key.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { type FileKind, isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-redundant-value' as const

type MessageId = 'sameAsUnset' | 'emptyReplace'

/** A Boolean key for which `true` is the same as unset. `why` finishes the message. `skip` lists
 *  the kinds of file where another rule reports the key. */
const TRUE_IS_UNSET: { key: string; why: string; skip: readonly FileKind[] }[] = [
  { key: 'alwaysThinkingEnabled', why: 'thinking is on by default', skip: [] },
  { key: 'enableArtifact', why: 'it never overrides a false from another file', skip: [] },
  { key: 'syncClaudeAiSkills', why: 'Claude Code honors only false', skip: ['project'] },
  { key: 'syncClaudeAiPlugins', why: 'Claude Code honors only false', skip: ['project', 'local'] },
]

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not set a settings value that is the same as an unset key',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      sameAsUnset: '"{{key}}": true changes nothing, because {{why}}. Remove the key.',
      emptyReplace:
        '"spinnerVerbs" in "replace" mode with no verbs keeps the built-in verbs. Add verbs, or remove the key.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const kind = kindOf(context.filename)
    return {
      Document(node) {
        const body = node.body
        for (const { key, why, skip } of TRUE_IS_UNSET) {
          const value = lastMember(body, key)?.value
          if (value?.type === 'Boolean' && value.value && !skip.includes(kind)) {
            context.report({ node: value, messageId: 'sameAsUnset', data: { key, why } })
          }
        }
        const verbs = lastMember(body, 'spinnerVerbs')?.value
        const mode = lastMember(verbs, 'mode')?.value
        const list = lastMember(verbs, 'verbs')?.value
        if (
          mode?.type === 'String' &&
          mode.value === 'replace' &&
          list?.type === 'Array' &&
          list.elements.length === 0
        ) {
          context.report({ node: list, messageId: 'emptyReplace' })
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
