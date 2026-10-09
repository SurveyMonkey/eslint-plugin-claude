// What one managed settings file shows (docs/rules/settings-managed-file.md).
// The rule reads the file that it lints. For the control-only report, it also
// reads the drop-ins beside `managed-settings.json`. The merge order of the
// drop-ins is not in its view.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { MANAGED_CONTROL_KEYS } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'
import { entriesOf, readJson, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'settings-managed-file' as const

const DROP_IN_DIRECTORY = 'managed-settings.d'
const MERGE_FILE = 'managed-settings.json'

const isPolicyKey = (key: string) => !MANAGED_CONTROL_KEYS.includes(key)

/** True when a drop-in in `managed-settings.d` beside `dir` holds a policy key,
 *  or when the rule cannot tell. Claude Code reads each `*.json` file there
 *  that is not hidden. A drop-in that cannot be read, or that does not parse
 *  to an object, counts as a policy source: it can hold any key. */
function dropInsMayHoldPolicy(dir: string): boolean {
  const directory = path.join(dir, DROP_IN_DIRECTORY)
  const entries = entriesOf(directory)
  if (entries === null) {
    return false
  }
  if (entries === UNREADABLE) {
    return true
  }
  const bound = repositoryRoot(dir)
  return entries
    .filter(({ name: entry }) => entry.endsWith('.json') && !entry.startsWith('.'))
    .some(({ name: entry }) => {
      const parsed = readJson(path.join(directory, entry), bound)
      // A file that vanished since the listing, or one that cannot be read.
      if (parsed === null || parsed === UNREADABLE) {
        return true
      }
      const { data } = parsed
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return true
      }
      return Object.entries(data).some(([key, value]) => value !== null && isPolicyKey(key))
    })
}

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
        // The source counts as one merged policy. A drop-in with only control keys can sit beside
        // a file with policy keys, so only `managed-settings.json` gets this report, and only
        // when no drop-in beside it holds a policy key.
        if (
          !isDropIn &&
          file === MERGE_FILE &&
          keys.length > 0 &&
          !keys.some(isPolicyKey) &&
          !dropInsMayHoldPolicy(path.dirname(context.filename))
        ) {
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
