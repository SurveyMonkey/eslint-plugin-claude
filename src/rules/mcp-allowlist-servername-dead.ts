// A `serverName` entry of `allowedMcpServers` that never matches
// (docs/rules/mcp-allowlist-servername-dead.md). Claude Code lets a `serverName` entry admit a
// remote server only when the allowlist has no `serverUrl` entry. It lets a name admit a stdio
// server only when the allowlist has no `serverCommand` entry. With both kinds in the allowlist,
// no name admits any server. The managed settings page combines the lists of the managed files
// into one list, so the rule counts the entries of the sibling files too. A sibling that the
// rule cannot read can only add entries, so the report that the linted file supports stays.
// An entry that `mcp-policy-entry-schema` reports is not valid. Claude Code strips it, so the
// rule neither counts it nor reports it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { lastMembers, SERVER_NAME_PATTERN } from '../mcp-servers.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readManagedSource } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'mcp-allowlist-servername-dead' as const

/** An allowlist entry that Claude Code keeps. A name entry holds its `serverName`. */
type Kept = { kind: 'url' | 'command' } | { kind: 'name'; server: string }

/** The parsed value of the string, array or object `node`. Another value is undefined, because
 *  the entry check reads strings, arrays and objects only. Of two members with one name, the
 *  last stays, as `JSON.parse` keeps it. */
function plainOf(node: ValueNode): unknown {
  if (node.type === 'String') {
    return node.value
  }
  if (node.type === 'Array') {
    return node.elements.map(({ value }) => plainOf(value))
  }
  if (node.type === 'Object') {
    return Object.fromEntries(
      lastMembers(node.members).map((m) => [keyOf(m.name), plainOf(m.value)]),
    )
  }
  return undefined
}

/** The kept form of an allowlist entry: an object with one key, `serverUrl`
 *  or `serverName` with a string, or `serverCommand` with an array of strings. A name must
 *  also match the allowlist pattern. The result is undefined for any other entry. */
function keptOf(entry: unknown): Kept | undefined {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return undefined
  }
  const [pair, ...others] = Object.entries(entry)
  if (pair === undefined || others.length > 0) {
    return undefined
  }
  const [key, value] = pair
  if (key === 'serverUrl' && typeof value === 'string') {
    return { kind: 'url' }
  }
  if (
    key === 'serverCommand' &&
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string')
  ) {
    return { kind: 'command' }
  }
  if (key === 'serverName' && typeof value === 'string' && SERVER_NAME_PATTERN.test(value)) {
    return { kind: 'name', server: value }
  }
  return undefined
}

const rule: JSONRuleDefinition<{ MessageIds: 'dead' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Do not list a serverName in an allowlist that has serverUrl and serverCommand entries',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      dead: 'The serverName entry "{{server}}" never matches. The allowlist has serverUrl and serverCommand entries, so Claude Code admits a remote server by URL and a stdio server by command, and a name admits neither. Remove the entry, or use a serverUrl or serverCommand entry.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const list = lastMember(node.body, 'allowedMcpServers')?.value
        if (list?.type !== 'Array') {
          return
        }
        const entries = list.elements.map(({ value }) => ({
          node: value,
          kept: keptOf(plainOf(value)),
        }))
        const names = entries.flatMap(({ node: entry, kept }) =>
          kept?.kind === 'name' ? [{ node: entry, server: kept.server }] : [],
        )
        if (names.length === 0) {
          return
        }
        const kinds = new Set<string>(
          entries.flatMap(({ kept }) => (kept === undefined ? [] : [kept.kind])),
        )
        if (!(kinds.has('url') && kinds.has('command'))) {
          // The lists of the sibling files combine with this one. A sibling that cannot be read
          // adds no kind here, so the rule stays silent if this file alone is not enough.
          const siblings = readManagedSource(context.filename)
          for (const sibling of siblings === UNREADABLE ? [] : siblings) {
            const other = sibling.allowedMcpServers
            for (const entry of Array.isArray(other) ? other : []) {
              const kept = keptOf(entry)
              if (kept !== undefined) {
                kinds.add(kept.kind)
              }
            }
          }
        }
        if (kinds.has('url') && kinds.has('command')) {
          for (const { node: entry, server } of names) {
            context.report({ node: entry, messageId: 'dead', data: { server } })
          }
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
