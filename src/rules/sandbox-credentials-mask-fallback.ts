// Claude Code falls back to `deny` for a `mask` entry that it cannot mask safely
// (docs/rules/sandbox-credentials-mask-fallback.md): an `extract` pattern with no capturing group,
// a directory path, or a glob pattern. The rule reads the `mask` entries of managed files.
// `sandbox-scope` reports a `mask` entry in a project or local file, where Claude Code drops it.
// The rule decides from the text of the entry. It reads no path from the disk, because a
// credential path resolves outside the repository.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { objectEntries, type SettingsObject } from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-credentials-mask-fallback' as const

type MessageId = 'noGroup' | 'unmaskablePath'

/** True when `pattern` compiles and holds no capturing group. The empty alternative added at the
 *  end leaves the groups of `pattern` as they are, and `exec` on the empty string then returns
 *  one slot for each group. A pattern that does not compile is not this fault. */
function lacksGroup(pattern: string): boolean {
  try {
    return (new RegExp(`${pattern}|`).exec('') as RegExpExecArray).length === 1
  } catch {
    return false
  }
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Give a mask entry an extract group and a file path that it can mask',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noGroup:
        'The "extract" pattern has no capturing group, so Claude Code falls back to "deny" for this entry. The credential is blocked, not masked. Capture the secret in a group.',
      unmaskablePath:
        'Claude Code cannot mask {{kind}}, so it falls back to "deny" for this entry. "mask" applies to a single file: list each credential file by its own path, or write "deny".',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename) || kindOf(context.filename) !== 'managed') {
      return {}
    }
    return {
      Document(document) {
        // ESLint has parsed the text as JSON already, so `JSON.parse` does not fail.
        const own = JSON.parse(context.sourceCode.text) as SettingsObject
        for (const kind of ['files', 'envVars'] as const) {
          for (const { entry, node } of objectEntries(document, own, [
            'sandbox',
            'credentials',
            kind,
          ])) {
            if (entry.mode !== 'mask') {
              continue
            }
            if (typeof entry.extract === 'string' && lacksGroup(entry.extract)) {
              context.report({
                node: lastMember(node, 'extract')?.value as ValueNode,
                messageId: 'noGroup',
              })
            }
            const target = entry.path
            if (kind === 'files' && typeof target === 'string') {
              const found = /[*?[]/.test(target)
                ? 'a glob pattern'
                : target.endsWith('/')
                  ? 'a directory'
                  : null
              if (found !== null) {
                context.report({
                  node: lastMember(node, 'path')?.value as ValueNode,
                  messageId: 'unmaskablePath',
                  data: { kind: found },
                })
              }
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
