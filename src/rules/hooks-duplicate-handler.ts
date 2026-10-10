// Two sources of one plugin that both define an identical handler (docs/rules/hooks-duplicate-handler.md).
// The plugins reference says that `hooks/hooks.json` and the `hooks` key of `plugin.json` both load. The
// plugin guide says that a hook in a settings file and in a plugin `hooks.json` runs twice. The hooks
// reference says that a handler in more than one settings file runs once, so the rule never pairs two
// settings files. One pair gets one report, on the later source: settings, then `hooks/hooks.json`, then
// `plugin.json`. The other files are comparison data. The rule reads them through `fromData`, so the same
// `handlersOf` reads every source. A file that the rule cannot read gives no report (ADR 001, Decision 14).
import path from 'node:path'
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  fromData,
  type HNode,
  type HookHandler,
  type HookSource,
  handlersOf,
  hooksListener,
  lastMembers,
} from '../hooks-config.ts'
import { settingsFilesAround } from '../hooks-files.ts'
import { readJson, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'hooks-duplicate-handler' as const

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The value as text, the same for two values with the same members in any order. */
function canonical(node: HNode): string {
  switch (node.kind) {
    case 'object':
      return `{${lastMembers(node)
        .map((member) => `${JSON.stringify(member.key)}:${canonical(member.value)}`)
        .sort()
        .join(',')}}`
    case 'array':
      return `[${node.items.map(canonical).join(',')}]`
    case 'string':
    case 'number':
    case 'boolean':
      return JSON.stringify(node.value)
    default:
      return 'null'
  }
}

/** The key of a handler: two handlers with one key are identical. The key holds the event, the matcher
 *  and every field of the handler. */
const keyOf = ({ event, matcher, handler }: HookHandler) =>
  JSON.stringify([event, matcher ?? null, canonical(handler)])

/** The handlers of the file `file`, read as `kind`, or none when the rule cannot read the file or the file
 *  holds no hooks. A settings file that sets `disableAllHooks` to true runs no hook, so it adds none. */
function handlersAt(file: string, kind: HookSource['kind'], bound: string): HookHandler[] {
  const parsed = readJson(file, bound)
  if (parsed === null || parsed === UNREADABLE || !isObject(parsed.data)) {
    return []
  }
  if (kind === 'settings' && parsed.data.disableAllHooks === true) {
    return []
  }
  return handlersOf({ kind, hooks: fromData(parsed.data.hooks), file: undefined })
}

/** The handlers that the linted file adds to the plugin. `plugin.json` holds an event map, or an array
 *  of paths and event maps. The rule reads the event maps. */
function ownHandlers(source: HookSource, manifest: boolean): HookHandler[] {
  if (!manifest) {
    return handlersOf(source)
  }
  const maps = source.hooks?.kind === 'array' ? source.hooks.items : [source.hooks]
  return maps.flatMap((hooks) => handlersOf({ kind: 'plugin', hooks, file: undefined }))
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not define one hook handler in two sources of a plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate:
        'This handler is identical to one in "{{other}}". Claude Code loads both, so the hook runs twice. Keep one copy.',
    },
  },
  create(context) {
    const file = path.resolve(context.filename)
    const manifest = path.basename(file) === 'plugin.json'
    // A `plugin.json` is the manifest of a plugin only in `.claude-plugin/`.
    if (manifest && path.basename(path.dirname(file)) !== '.claude-plugin') {
      return {}
    }
    const root = path.dirname(path.dirname(file))
    const bound = repositoryRoot(root)
    return hooksListener(context, (source) => {
      // A settings file is comparison data for a plugin file. It is never the later source.
      if (!manifest && source.kind !== 'plugin') {
        return
      }
      const earlier = [
        ...settingsFilesAround(root).map((at) => ({
          at,
          handlers: handlersAt(at, 'settings', bound),
        })),
        ...(manifest
          ? [
              {
                at: path.join(root, 'hooks', 'hooks.json'),
                handlers: handlersAt(path.join(root, 'hooks', 'hooks.json'), 'plugin', bound),
              },
            ]
          : []),
      ]
      for (const own of ownHandlers(source, manifest)) {
        const twin = earlier.find(({ handlers }) => handlers.some((h) => keyOf(h) === keyOf(own)))
        if (twin !== undefined) {
          const other = path.relative(root, twin.at).split(path.sep).join('/')
          context.report({ loc: own.handler.loc, messageId: 'duplicate', data: { other } })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/hooks/hooks.json', '**/.claude-plugin/plugin.json'],
  rule,
}
