// A settings key in a file that Claude Code does not read it from
// (docs/rules/settings-key-scope.md). The scope of each key is in
// `src/data/settings-keys.ts`. The rule makes no report on a key that has a
// rule of its own for a repository file, and the data names it. Today that is
// `syncClaudeAiPlugins`, which `settings-sync-claude-ai-plugins` reports, and
// `autoContinueAtUsageLimit`, which a project file turns off and does not
// ignore.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { hasListedChildren, type KeyScope, settingsKeyScope } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ObjectNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-key-scope' as const

type MessageId = 'managedOnly' | 'userOrManaged' | 'userLocalOrManaged' | 'globalConfig'

/** The kind of file: the two project files, or a managed file. */
type FileKind = 'project' | 'local' | 'managed'

/** For each scope that has a fault: the message, and the kinds of file that
 *  have the fault. An "any" key has no fault. */
const FAULTS: Record<KeyScope['scope'], { id: MessageId; kinds: FileKind[] } | undefined> = {
  managed: { id: 'managedOnly', kinds: ['project', 'local'] },
  'user-or-managed': { id: 'userOrManaged', kinds: ['project', 'local'] },
  'user-local-or-managed': { id: 'userLocalOrManaged', kinds: ['project'] },
  global: { id: 'globalConfig', kinds: ['project', 'local', 'managed'] },
  any: undefined,
}

function kindOf(filename: string): FileKind {
  switch (path.basename(filename)) {
    case 'settings.json':
      return 'project'
    case 'settings.local.json':
      return 'local'
    default:
      return 'managed'
  }
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set each settings key in a file that Claude Code reads it from',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      managedOnly:
        'Claude Code reads "{{key}}" from managed settings only. It ignores the key in this file.',
      userOrManaged:
        'Claude Code reads "{{key}}" from user and managed settings. It ignores the key in this file.',
      userLocalOrManaged:
        'Claude Code ignores "{{key}}" in .claude/settings.json. It reads the key from user, local and managed settings.',
      globalConfig:
        'Claude Code reads "{{key}}" from ~/.claude.json only. It ignores the key in this file.',
    },
  },
  create(context) {
    const kind = kindOf(context.filename)

    /** Report the faulty keys of `object`, whose keys are below `parent`. */
    function check(object: ObjectNode, parent: readonly string[]): void {
      for (const member of object.members) {
        const key = keyOf(member.name)
        // Two keys of one name: the last counts, as in `JSON.parse`.
        if (lastMember(object, key) !== member) {
          continue
        }
        const keyPath = [...parent, key]
        const info = settingsKeyScope(keyPath)
        const fault = info && FAULTS[info.scope]
        const value = member.value
        if (
          info !== undefined &&
          fault?.kinds.includes(kind) &&
          info.reportedBy === undefined &&
          (info.flaggedValue === undefined ||
            (value.type === 'Boolean' && value.value === info.flaggedValue))
        ) {
          context.report({
            node: member.name,
            messageId: fault.id,
            data: { key: keyPath.join('.') },
          })
        } else if (value.type === 'Object' && hasListedChildren(keyPath)) {
          check(value, keyPath)
        }
      }
    }

    return {
      Document(node) {
        if (node.body.type === 'Object') {
          check(node.body, [])
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
