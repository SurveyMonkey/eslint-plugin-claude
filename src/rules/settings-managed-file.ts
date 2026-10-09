// What one managed settings file shows (docs/rules/settings-managed-file.md).
// The rule reads the one file that it lints. Two files or more, such as the
// merge order of the drop-ins, are not in its view.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { MANAGED_CONTROL_KEYS } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-managed-file' as const

const DROP_IN_DIRECTORY = 'managed-settings.d'
const MERGE_FILE = 'managed-settings.json'

const rule: JSONRuleDefinition<{
  RuleOptions: []
  MessageIds: 'notObject' | 'hiddenDropIn' | 'controlKeysOnly' | 'mergeNothing'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a managed settings file as Claude Code reads it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject:
        'Claude Code refuses to start when a managed settings file is not a JSON object. The top-level value has the type {{type}}.',
      hiddenDropIn:
        'Claude Code ignores the hidden file "{{file}}" in managed-settings.d. Rename it, or remove it.',
      controlKeysOnly:
        'This file holds only the control keys wslInheritsWindowsSettings and managedSourcesBehavior. Claude Code does not count it as a policy source, and moves on to the next source.',
      mergeNothing:
        '"merge" in a managed settings file has no source below it to combine with. The file is the lowest-ranked admin source.',
    },
  },
  create(context) {
    const file = path.basename(context.filename)
    const isDropIn = path.basename(path.dirname(context.filename)) === DROP_IN_DIRECTORY
    return {
      Document(node) {
        const { body } = node
        // Claude Code ignores a hidden drop-in, so it reads nothing else in the file.
        if (isDropIn && file.startsWith('.')) {
          context.report({ node: body, messageId: 'hiddenDropIn', data: { file } })
          return
        }
        if (body.type !== 'Object') {
          context.report({ node: body, messageId: 'notObject', data: { type: body.type } })
          return
        }
        // A key counts when its last value is not `null`. A `null` removes the key.
        const keys = body.members
          .filter(
            (member) =>
              lastMember(body, keyOf(member.name)) === member && member.value.type !== 'Null',
          )
          .map((member) => keyOf(member.name))
        if (keys.length > 0 && keys.every((key) => MANAGED_CONTROL_KEYS.includes(key))) {
          context.report({ node: body, messageId: 'controlKeysOnly' })
          return
        }
        // The page states the lowest rank for the `managed-settings.json` file.
        const merge = lastMember(body, 'managedSourcesBehavior')?.value
        if (
          !isDropIn &&
          file === MERGE_FILE &&
          merge?.type === 'String' &&
          merge.value === 'merge'
        ) {
          context.report({ node: merge, messageId: 'mergeNothing' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: MANAGED_SETTINGS_FILES,
  rule,
}
