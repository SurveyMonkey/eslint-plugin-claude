// Claude Code drops a `mode: "mask"` entry of `sandbox.credentials.files` and `envVars` from the
// project file and the local file (docs/rules/sandbox-scope.md). `settings-key-scope` reports a
// key of the sandbox that the settings index limits to managed settings, or to user and managed
// settings, such as `sandbox.bwrapPath`. It cannot see the value of `mode`, so this rule reads the entries.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { valueAt } from '../permission-sandbox.ts'
import { kindOf } from '../settings-files.ts'

const name = 'sandbox-scope' as const

type MessageId = 'mask'

const LISTS = ['files', 'envVars']

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not put a credentials mask entry in a project or local settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      mask: 'Claude Code drops a "mask" entry of "sandbox.credentials.{{list}}" from this file. Move the entry to user or managed settings.',
    },
  },
  create(context) {
    // A managed file keeps the entry. A hidden drop-in is a managed file that Claude Code ignores.
    if (kindOf(context.filename) === 'managed') {
      return {}
    }
    return {
      Document(node) {
        for (const list of LISTS) {
          const entries = valueAt(node, ['sandbox', 'credentials', list])
          if (entries?.type !== 'Array') {
            continue
          }
          for (const { value: entry } of entries.elements) {
            const mode = lastMember(entry, 'mode')?.value
            if (mode?.type === 'String' && mode.value === 'mask') {
              context.report({ node: mode, messageId: 'mask', data: { list } })
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
  files: SETTINGS_FILES,
  rule,
}
