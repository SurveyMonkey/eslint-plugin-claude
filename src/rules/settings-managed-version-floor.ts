// `deniedModels` and `availableModelsMatch: "exact"` in managed settings
// (docs/rules/settings-managed-version-floor.md). Claude Code before v2.1.283 ignores both keys.
// The model configuration page says to set `requiredMinimumVersion` too, so that those versions
// do not start. The managed source is `managed-settings.json` and its drop-ins, merged, and the
// order of the drop-ins is not in view. So any file of the source that sets a floor of 2.1.283 or
// later makes the rule silent. A file that the rule cannot read, and a floor that is not a version
// number, can hold the floor, so the rule then makes no report (ADR 001, Decision 14).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readManagedSource } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'settings-managed-version-floor' as const

/** The first version that reads `deniedModels` and `availableModelsMatch`. */
const FIRST_VERSION = [2, 1, 283] as const

/** True when `floor` is a version number from 2.1.283 on, or is not a version number. The rule
 *  cannot tell what Claude Code reads then. The rule reads the first three numbers and ignores a
 *  suffix: `2.1.283-rc1` counts as 2.1.283. A `null` is no floor. */
function mayHoldFloor(floor: unknown): boolean {
  if (floor === undefined || floor === null) {
    return false
  }
  const match = typeof floor === 'string' ? /^(\d+)\.(\d+)\.(\d+)/.exec(floor) : null
  if (match === null) {
    return true
  }
  for (const [index, first] of FIRST_VERSION.entries()) {
    const part = Number(match[index + 1])
    if (part !== first) {
      return part > first
    }
  }
  return true
}

/** The value of a node as the parsed file gives it, for `mayHoldFloor`. A node that is neither a
 *  string nor `null` gives its type name, which is not a version number. */
const plainOf = (node: ValueNode | undefined) =>
  node === undefined
    ? undefined
    : node.type === 'String'
      ? node.value
      : node.type === 'Null'
        ? null
        : node.type

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'floor' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set requiredMinimumVersion with deniedModels or availableModelsMatch',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      floor:
        'Claude Code before v2.1.283 ignores "{{key}}". The managed settings do not set "requiredMinimumVersion" to 2.1.283 or later, so those versions still start.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const denied = lastMember(node.body, 'deniedModels')
        const match = lastMember(node.body, 'availableModelsMatch')
        // An empty list denies nothing, and the value "prefix" is the behavior of the earlier
        // versions. Neither one depends on the version.
        const keys = [
          denied?.value.type === 'Array' && denied.value.elements.length > 0 ? denied : undefined,
          match?.value.type === 'String' && match.value.value === 'exact' ? match : undefined,
        ].filter((member) => member !== undefined)
        if (keys.length === 0) {
          return
        }
        const siblings = readManagedSource(context.filename)
        if (
          siblings === UNREADABLE ||
          mayHoldFloor(plainOf(lastMember(node.body, 'requiredMinimumVersion')?.value)) ||
          siblings.some(({ requiredMinimumVersion }) => mayHoldFloor(requiredMinimumVersion))
        ) {
          return
        }
        for (const member of keys) {
          context.report({
            node: member.name,
            messageId: 'floor',
            data: { key: keyOf(member.name) },
          })
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
