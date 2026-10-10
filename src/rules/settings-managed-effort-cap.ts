// A managed `effortLevel` with no `maxEffortLevel` (docs/rules/settings-managed-effort-cap.md).
// The settings reference says that `maxEffortLevel` caps the level, and that it is the key to
// deploy in managed settings to enforce a cap. `effortLevel` is only a default. The rule reads
// the merged managed source, because the cap can sit in another file. The rule rests on an
// absence, so it makes no report when a file of the source cannot be read.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readManagedSource } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'settings-managed-effort-cap' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'uncapped' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set maxEffortLevel beside effortLevel in managed settings',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      uncapped:
        '"effortLevel" is a default, and a user can raise it. No file of this managed source sets "maxEffortLevel", which caps the level.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const level = lastMember(node.body, 'effortLevel')?.value
        if (
          level?.type !== 'String' ||
          lastMember(node.body, 'maxEffortLevel')?.value.type === 'String'
        ) {
          return
        }
        const siblings = readManagedSource(context.filename)
        if (
          siblings === UNREADABLE ||
          siblings.some(({ maxEffortLevel }) => typeof maxEffortLevel === 'string')
        ) {
          return
        }
        context.report({ node: level, messageId: 'uncapped' })
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
