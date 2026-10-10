// A handler field that the docs do not list for the type of the handler
// (docs/rules/hooks-handler-field-unknown.md). The docs do not say what Claude Code does with it.
// `hooks-config-schema` checks the types of the known fields. `hooks-handler-field-ignored` owns a
// field that exists and is misplaced, so this rule skips those.
import type { Rule } from 'eslint'
import { COMMON_HANDLER_FIELDS, HANDLER_FIELDS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  isHandlerType,
  lastMembers,
  quotedList,
  stringOf,
} from '../hooks-config.ts'

const name = 'hooks-handler-field-unknown' as const

/** The fields that `hooks-handler-field-ignored` reports when the type or the event does not fit. */
const OWNED_BY_IGNORED = ['async', 'asyncRewake', 'continueOnBlock', 'onFailure']

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use only the handler fields that the docs list for the hook type',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknown:
        'The "{{field}}" field is not documented for the "{{type}}" hook type. The fields are {{fields}}.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const type = stringOf(handler, 'type')
        // A handler with no type or an unknown type is for `hooks-config-schema`.
        if (type === undefined || !isHandlerType(type)) {
          continue
        }
        const fields = [...COMMON_HANDLER_FIELDS, ...HANDLER_FIELDS[type]]
        for (const { key, keyLoc } of lastMembers(handler)) {
          if (!fields.includes(key) && !OWNED_BY_IGNORED.includes(key)) {
            context.report({
              loc: keyLoc,
              messageId: 'unknown',
              data: {
                field: key,
                type,
                fields: quotedList(fields),
              },
            })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
