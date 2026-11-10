// The component paths of an entry in `marketplace.json` follow the plugin path
// rules: a `./` prefix, no `..`, no backslash, a path that exists, and a path
// that does not resolve out of the marketplace through a link
// (docs/rules/marketplace-entry-component-paths.md). A server file path of
// `mcpServers` or `lspServers` is a second check: a `./` path with a `..` part. The rule resolves each
// path from the real source directory that `sourceReader` gives, with
// `placeOf` (src/plugin-links.ts). It reads the disk with the repository as
// the bound, and makes no report for a part that it cannot read.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries, type ValueNode } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'
import { declaredMcpStrings } from '../mcp-servers.ts'
import { placeOf } from '../plugin-links.ts'
import { entriesOf, realDirectory, repositoryRoot } from '../skill-tree.ts'
import { pathFault } from './marketplace-relative-source-format.ts'
import { URL_START } from './plugin-path-no-backslash.ts'

const name = 'marketplace-entry-component-paths' as const

// The component fields of an entry that take a path (manifest reference, "Fields").
// `hooks` and `mcpServers` also take inline configuration, and `commands` also takes an object map.
const COMPONENT_FIELDS = ['commands', 'agents', 'skills', 'outputStyles', 'themes']

// An MCP bundle is a `.mcpb` or `.dxt` file, or a URL (manifest reference, "mcpServers").
// Claude Code does not read it as a server file.
const BUNDLE = /\.(?:mcpb|dxt)$/

type MessageIds = 'start' | 'parent' | 'backslash' | 'missing' | 'escapes' | 'server'
type StringNode = Extract<ValueNode, { type: 'String' }>

/** The strings of a field value: the value itself, or the strings in an array.
 *  Another value or element is not a path that the rule reads. */
function pathsOf(value: ValueNode): StringNode[] {
  const items = value.type === 'Array' ? value.elements.map((element) => element.value) : [value]
  return items.filter((item) => item.type === 'String')
}

/** The first fault in the text of `text`, or undefined. Only `skills` takes a
 *  path that is `.` (manifest reference, "Path rules"). */
function textFault(text: string, field: string): MessageIds | undefined {
  const fault = pathFault(text)
  if (fault === 'parent') {
    return 'parent'
  }
  // A network path and an absolute path do not start with `./`.
  if (fault !== undefined) {
    return 'start'
  }
  if (text.includes('\\')) {
    return 'backslash'
  }
  return text.startsWith('./') || (field === 'skills' && text === '.') ? undefined : 'start'
}

/** The server file paths of an entry: the strings of `mcpServers` that are not a bundle or URL,
 *  and the strings of `lspServers`. A path with no `./` start is not here, because
 *  `claude plugin validate` fails it in an entry. An inline map is not a string. */
function serverPaths(entry: ValueNode): { field: string; item: StringNode }[] {
  const lsp = lastMember(entry, 'lspServers')?.value
  return [
    ...declaredMcpStrings(entry)
      .filter((item) => !URL_START.test(item.value) && !BUNDLE.test(item.value))
      .map((item) => ({ field: 'mcpServers', item })),
    ...(lsp === undefined ? [] : pathsOf(lsp).map((item) => ({ field: 'lspServers', item }))),
  ].filter(({ item }) => item.value.startsWith('./') && pathFault(item.value) === 'parent')
}

const rule: JSONRuleDefinition<{ MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Write the component paths of a marketplace entry as the plugin path rules require',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      start:
        'The {{field}} path "{{path}}" does not start with "./". Write the path from the plugin root, with the "./" prefix.',
      parent:
        'The {{field}} path "{{path}}" has a ".." segment, which fails validation. Write the path from the plugin root, with no "..".',
      backslash:
        'The {{field}} path "{{path}}" contains a backslash. On macOS and Linux, Claude Code rejects it. Write the path with forward slashes.',
      missing:
        'The {{field}} path "{{path}}" does not exist in the plugin directory, so Claude Code does not load it.',
      server:
        'The {{field}} path "{{path}}" has a ".." segment. Claude Code does not read that server file, even when the path stays inside the plugin. Write the path from the plugin root, with no "..".',
      escapes:
        'The {{field}} path "{{path}}" resolves out of the marketplace through a link, so Claude Code drops it. Keep the target of the link inside the marketplace.',
    },
  },
  create(context) {
    // The marketplace root is the directory that holds `.claude-plugin/`.
    const root = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          const paths = COMPONENT_FIELDS.flatMap((field) => {
            const value = lastMember(entry, field)?.value
            return value === undefined ? [] : pathsOf(value).map((item) => ({ field, item }))
          })
          const servers = serverPaths(entry)
          // The read comes after the key tests, so an entry with no path costs no read.
          if (paths.length === 0 && servers.length === 0) {
            continue
          }
          const source = read(entry)
          // A source that is a file has no directory to resolve a path from.
          if (!('dir' in source) || !Array.isArray(entriesOf(source.dir))) {
            continue
          }
          // With a `plugin.json`, `marketplace-entry-manifest-only-fields` reports the server field.
          if (source.kind === 'no-manifest') {
            for (const { field, item } of servers) {
              context.report({ node: item, messageId: 'server', data: { field, path: item.value } })
            }
          }
          const dir = source.dir
          const scopes = { marketplace: realDirectory(root), plugin: dir }
          const bound = repositoryRoot(root)
          for (const { field, item } of paths) {
            const text = item.value
            let messageId = textFault(text, field)
            if (messageId === undefined) {
              // A link to another place in the marketplace is allowed. Claude Code skips a link
              // that leads out of the marketplace.
              const { reach } = placeOf(dir, dir, bound, scopes, path.resolve(dir, text))
              if (reach === 'outside') {
                messageId = 'escapes'
              } else if (reach === 'missing') {
                messageId = 'missing'
              }
            }
            if (messageId !== undefined) {
              context.report({ node: item, messageId, data: { field, path: text } })
            }
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
}

export default rule
