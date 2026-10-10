// A matcher form that an older Claude Code reads in another way, or does not know
// (docs/rules/hooks-matcher-legacy-version.md). The option `minVersion` is the oldest version that
// the team supports. Without it, the rule makes no report.
import type { Rule } from 'eslint'
import {
  MATCHER_VALUE_SINCE,
  MATCHER_VALUES,
  NARROW_MATCHER_EVENTS,
  NO_MATCHER_EVENTS,
} from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-legacy-version' as const

/** The first version that exact-matches a hyphenated name. Before it, Claude Code matched the name
 *  as a substring. Source: the Claude Code changelog, v2.1.195. */
const HYPHEN_FIXED = '2.1.195'
/** The first version that reads a comma list. Before it, a comma matcher never fired. Source: the
 *  Claude Code changelog, v2.1.191. */
const COMMA_FIXED = '2.1.191'

interface Options {
  minVersion?: string
}

/** True when the version `version` is older than `limit`. Both are `major.minor.patch`. */
function isBefore(version: string, limit: string): boolean {
  const have = version.split('.').map(Number)
  const want = limit.split('.').map(Number)
  const index = have.findIndex((part, at) => part !== want[at])
  return index !== -1 && (have[index] as number) < (want[index] as number)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write the hook matchers so that the oldest supported Claude Code reads them',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { minVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      hyphen: `Before v${HYPHEN_FIXED}, Claude Code matched the hyphenated name "{{segment}}" as a substring. The option minVersion is {{min}}. Write "^{{segment}}$".`,
      comma: `Before v${COMMA_FIXED}, a hook matcher with a comma never fired. The option minVersion is {{min}}. Separate the values with "|".`,
      value:
        'Claude Code sends "{{segment}}" on {{event}} from v{{version}}. The option minVersion is {{min}}.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options as [Options]
    if (minVersion === undefined) {
      return {}
    }
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        if (matcher === undefined) {
          continue
        }
        const { loc, value } = matcher
        const data = { min: minVersion }
        const narrow = NARROW_MATCHER_EVENTS.includes(event)
        // The events with the narrow set are for `hooks-matcher-syntax`, and the events without matcher
        // support are for `hooks-matcher-unsupported-event`.
        const free = !narrow && !NO_MATCHER_EVENTS.includes(event)
        const wide = exactValues(value, false)
        if (free && wide !== null && value.includes(',') && isBefore(minVersion, COMMA_FIXED)) {
          context.report({ loc, messageId: 'comma', data })
        }
        // An event with a fixed set of values is for `hooks-matcher-enum`.
        if (free && !MATCHER_VALUES.has(event) && isBefore(minVersion, HYPHEN_FIXED)) {
          for (const segment of wide ?? []) {
            if (/\w-\w/.test(segment)) {
              context.report({ loc, messageId: 'hyphen', data: { ...data, segment } })
            }
          }
        }
        for (const since of MATCHER_VALUE_SINCE) {
          if (since.event === event && isBefore(minVersion, since.version)) {
            for (const segment of exactValues(value, narrow) ?? []) {
              if (since.values.includes(segment)) {
                context.report({
                  loc,
                  messageId: 'value',
                  data: { ...data, segment, event, version: since.version },
                })
              }
            }
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
