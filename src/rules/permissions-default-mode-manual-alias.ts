// `defaultMode: "manual"` is an alias for `default` that Claude Code v2.1.200 added, so an older
// client rejects it (docs/rules/permissions-default-mode-manual-alias.md). The rule reports only
// when the option `minVersion` is set, because no file shows which client reads it. It reads the
// project and managed files. A managed file gets no exemption: the repair of an invalid managed
// `defaultMode` needs v2.1.282, which is newer than every client that rejects `manual`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { isBelow } from '../min-version.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-default-mode-manual-alias' as const

type Options = [{ minVersion?: string }]

/** The version that added the `manual` alias, from the Claude Code `CHANGELOG.md` on GitHub. */
const ALIAS_VERSION = '2.1.200'

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'alias' | 'useDefault' }> = {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Write "default" in place of the "manual" alias of permissions.defaultMode',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          minVersion: {
            description:
              'The oldest Claude Code version that the team supports, as major.minor.patch.',
            type: 'string',
            pattern: '^\\d+\\.\\d+\\.\\d+$',
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      alias:
        '"defaultMode": "manual" needs Claude Code v{{since}} or later, and your minVersion is {{minVersion}}. An older client rejects the value. Write "default".',
      useDefault: 'Write "default".',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    if (minVersion === undefined || !isBelow(minVersion, ALIAS_VERSION)) {
      return {}
    }
    return {
      Document(node) {
        if (isHiddenDropIn(context.filename)) {
          return
        }
        const value = lastMember(lastMember(node.body, 'permissions')?.value, 'defaultMode')?.value
        if (value?.type === 'String' && value.value === 'manual') {
          context.report({
            node: value,
            messageId: 'alias',
            data: { since: ALIAS_VERSION, minVersion },
            suggest: [
              { messageId: 'useDefault', fix: (fixer) => fixer.replaceText(value, '"default"') },
            ],
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
}

export default rule
