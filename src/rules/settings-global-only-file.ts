// A file of the repository that Claude Code reads from the home directory only
// (docs/rules/settings-global-only-file.md). The file reference of the `.claude` directory marks
// `keybindings.json` and `themes/*.json` as "Global only", and `~/.claude.json` the same. So a
// copy in a repository has no effect. Of a `.claude.json`, the rule reports the keys that the
// debug page says belong in `settings.json`.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'

const name = 'settings-global-only-file' as const

type MessageId = 'keybindings' | 'theme' | 'settingsKey'

/** The keys of a `.claude.json` that belong in a settings file. */
const SETTINGS_KEYS = ['permissions', 'hooks', 'env']

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not keep a global-only Claude Code file in a repository',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      keybindings:
        'Claude Code reads keybindings from ~/.claude/keybindings.json only. It ignores this file.',
      theme: 'Claude Code reads custom themes from ~/.claude/themes/ only. It ignores this file.',
      settingsKey:
        'Claude Code does not read "{{key}}" from a .claude.json in a repository, and ~/.claude.json holds app state. Set "{{key}}" in .claude/settings.json.',
    },
  },
  create(context) {
    const file = path.resolve(context.filename)
    const messageId: MessageId =
      path.basename(file) === '.claude.json'
        ? 'settingsKey'
        : path.basename(path.dirname(file)) === 'themes'
          ? 'theme'
          : 'keybindings'
    return {
      Document(node) {
        const body = node.body
        if (messageId !== 'settingsKey') {
          // The first character of the top-level value, so that an editor marks one character.
          const { start } = body.loc
          context.report({
            loc: { start, end: { line: start.line, column: start.column + 1 } },
            messageId,
          })
        } else if (body.type === 'Object') {
          for (const member of body.members) {
            const key = keyOf(member.name)
            // Two keys of one name: the last counts, as in `JSON.parse`.
            if (SETTINGS_KEYS.includes(key) && lastMember(body, key) === member) {
              context.report({ node: member.name, messageId, data: { key } })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/keybindings.json', '**/.claude/themes/*.json', '**/.claude.json'],
  rule,
}
