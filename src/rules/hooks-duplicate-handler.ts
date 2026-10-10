// A handler that is in a plugin and in the project settings, or in two sources of one plugin
// (docs/rules/hooks-duplicate-handler.md). The plugins reference says that `hooks/hooks.json` and the
// `hooks` key of `plugin.json` both load. The plugin guide says that a hook in a settings file and in a
// plugin `hooks.json` runs twice. The hooks reference says that a handler in two settings files runs once.
// So the rule never pairs two settings files.
// One pair gets one report, on the later source: settings, then `hooks/hooks.json`, then `plugin.json`.
// The other files are comparison data. The rule reads them through `fromData`, so `handlersOf` reads
// every source. A file that the rule cannot read gives no report (ADR 001, Decision 14). A settings file
// that the rule cannot read can hold `disableAllHooks`, so it stops every settings pair.
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
import { readJson, repositoryRoot, UNREADABLE, type Unreadable } from '../skill-tree.ts'

const name = 'hooks-duplicate-handler' as const

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The value as text. Two values that differ only in the order of object keys give the same text. Array
 *  order counts. */
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

/** The matcher as a key part. An omitted matcher, `""` and `"*"` all match every occurrence of the event
 *  (hooks reference, "Matcher patterns"), so they share one part. `FileChanged` is the exception: it
 *  adds `"*"` to the watch list as a file name, and it adds an omitted matcher to nothing. */
const matcherPart = (event: string, matcher: string | undefined) =>
  event !== 'FileChanged' && (matcher === '' || matcher === '*') ? null : (matcher ?? null)

/** The key of a handler: two handlers with one key are identical. The key holds the event, the matcher
 *  and every field of the handler. */
const keyOf = ({ event, matcher, handler }: HookHandler) =>
  JSON.stringify([event, matcherPart(event, matcher), canonical(handler)])

/** The parsed object of the file `file`. The result is undefined when the file is not there or does not
 *  hold an object, and `UNREADABLE` when the rule cannot see the file. `bound` is the repository root. */
function objectAt(file: string, bound: string): Record<string, unknown> | undefined | Unreadable {
  const parsed = readJson(file, bound)
  if (parsed === UNREADABLE) {
    return UNREADABLE
  }
  return parsed === null || !isObject(parsed.data) ? undefined : parsed.data
}

/** The handlers of the object `data`, read as `kind`. The result is empty when the object holds no hooks. */
const handlersIn = (
  data: Record<string, unknown> | undefined | Unreadable,
  kind: HookSource['kind'],
) =>
  data === undefined || data === UNREADABLE
    ? []
    : handlersOf({ kind, hooks: fromData(data.hooks), file: undefined })

/** The settings files with their handlers. `disableAllHooks` merges across settings files: the nearest
 *  file that sets it wins, and `settings.local.json` wins over `settings.json`. When the merged value is
 *  true, Claude Code runs no hook, so no settings file adds a handler. A file that the rule cannot read
 *  can set the key, so it stops every settings handler. */
function settingsHandlers(root: string, bound: string) {
  const read = settingsFilesAround(root).map((at) => ({ at, data: objectAt(at, bound) }))
  const blind = read.some(({ data }) => data === UNREADABLE)
  const files = read.map(({ at, data }) => ({ at, data: isObject(data) ? data : undefined }))
  // `settingsFilesAround` lists `settings.json` and then `settings.local.json` for each folder.
  const byPrecedence = files.flatMap((_, i) => (i % 2 === 0 ? [files[i + 1], files[i]] : []))
  const nearest = byPrecedence.find((file) => typeof file?.data?.disableAllHooks === 'boolean')
  const off = blind || nearest?.data?.disableAllHooks === true
  return files.map(({ at, data }) => ({
    at,
    settings: true,
    handlers: off ? [] : handlersIn(data, 'settings'),
  }))
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
      description:
        'Do not define one hook handler in a plugin and in the project settings, or in two sources of one plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate:
        'This handler is identical to one in "{{other}}". Claude Code loads both, so the hook runs twice. Keep one copy.',
      bothLoad:
        'This handler is identical to one in "{{other}}". Claude Code loads both sources. Keep one copy.',
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
        ...settingsHandlers(root, bound),
        ...(manifest
          ? [
              {
                at: path.join(root, 'hooks', 'hooks.json'),
                settings: false,
                handlers: handlersIn(
                  objectAt(path.join(root, 'hooks', 'hooks.json'), bound),
                  'plugin',
                ),
              },
            ]
          : []),
      ]
      for (const own of ownHandlers(source, manifest)) {
        const twin = earlier.find(({ handlers }) => handlers.some((h) => keyOf(h) === keyOf(own)))
        if (twin !== undefined) {
          const other = path.relative(root, twin.at).split(path.sep).join('/')
          context.report({
            loc: own.handler.loc,
            messageId: twin.settings ? 'duplicate' : 'bothLoad',
            data: { other },
          })
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
