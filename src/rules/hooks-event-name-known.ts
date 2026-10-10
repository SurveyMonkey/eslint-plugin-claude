// Claude Code skips a hook under an event name that it does not know, with
// no error (docs/rules/hooks-event-name-known.md). The same `hooks` object
// is in `hooks/hooks.json`, in settings, in the frontmatter of a skill and of a
// project subagent, and inline in `plugin.json`. In `plugin.json`, `hooks` can
// also be an array of paths and inline objects. The reader of `hooks-config.ts`
// reads each of them, and skips a `hooks.json` that Claude Code does not read.
import type { Rule } from 'eslint'
import { HOOK_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { type HNode, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-event-name-known' as const

type Options = [{ additionalEvents: string[] }]

/** The ASCII letters and digits of a name, in lowercase. */
function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** The Levenshtein distance between `a` and `b`. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + cost,
      )
    }
    previous = current
  }
  return previous[b.length] as number
}

/** The known event that `key` is a near miss of, or null. A near miss has
 *  the same letters with a different case or separator. It can also be at
 *  most two edits from a known name. The edit count ignores case and
 *  separators. */
function nearMiss(key: string, known: readonly string[]): string | null {
  const folded = fold(key)
  let best: string | null = null
  let bestDistance = 3
  for (const event of known) {
    if (fold(event) === folded) {
      return event
    }
    const d = distance(folded, fold(event))
    if (d < bestDistance) {
      best = event
      bestDistance = d
    }
  }
  return best
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    docs: {
      description: 'Use a hook event name that Claude Code knows',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          additionalEvents: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ additionalEvents: [] }],
    messages: {
      unknown: 'Claude Code does not know the hook event "{{key}}", and skips it.',
      nearMiss:
        'Claude Code does not know the hook event "{{key}}", and skips it. Did you mean "{{event}}"?',
      rename: 'Rename to "{{event}}".',
    },
  },
  create(context) {
    const [options] = context.options as [Options[0]]
    const known = [...HOOK_EVENTS, ...options.additionalEvents]
    const { sourceCode } = context

    /** Report each event name in `hooks`, which is an object, or an array of paths and objects. */
    function check(hooks: HNode | undefined, yaml: boolean): void {
      // A path holds no names.
      const objects = hooks?.kind === 'array' ? hooks.items : [hooks]
      for (const object of objects) {
        for (const { key, keyLoc } of object?.kind === 'object' ? object.members : []) {
          if (known.includes(key)) {
            continue
          }
          const event = nearMiss(key, known)
          if (event === null) {
            context.report({ loc: keyLoc, messageId: 'unknown', data: { key } })
            continue
          }
          context.report({
            loc: keyLoc,
            messageId: 'nearMiss',
            data: { key, event },
            suggest: [
              {
                messageId: 'rename',
                data: { event },
                fix: (fixer) =>
                  fixer.replaceTextRange(
                    [
                      sourceCode.getIndexFromLoc(keyLoc.start),
                      sourceCode.getIndexFromLoc(keyLoc.end),
                    ],
                    yaml ? event : JSON.stringify(event),
                  ),
              },
            ],
          })
        }
      }
    }

    return hooksListener(context, (source) =>
      check(source.hooks, source.kind === 'skill' || source.kind === 'agent'),
    )
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...HOOKS_TARGET.files, '**/.claude-plugin/plugin.json'],
  // The same rule, for the frontmatter of a skill and of a project subagent.
  also: HOOKS_TARGET.also,
  rule,
}
