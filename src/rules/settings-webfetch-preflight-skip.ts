// `skipWebFetchPreflight: true` while no `WebFetch(...)` permission rule restricts the domains
// (docs/rules/settings-webfetch-preflight-skip.md). With the check skipped, WebFetch attempts any
// URL without the blocklist. The settings reference says to pair the key with `WebFetch` rules.
// The rule looks for a rule in the linted file, and in the files that Claude Code merges with it:
// the other project file of the same `.claude/` folder, or the other files of the managed source.
// It reads no path out of the repository (ADR 001, Decision 14). A file that it cannot read can
// hold the rule, so the rule then makes no report. `permissions` is a list key, so the rule reads
// each file on its own and does not use `readSettings`.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import {
  isHiddenDropIn,
  kindOf,
  MANAGED_SETTINGS_FILES,
  readManagedSource,
} from '../settings-files.ts'
import { readJson, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'settings-webfetch-preflight-skip' as const

const LISTS = ['allow', 'ask', 'deny']

/** True when one of the texts is a `WebFetch(...)` rule with a specifier. A bare `WebFetch` and
 *  `WebFetch()` name no domain. */
function hasDomainRule(texts: unknown[]): boolean {
  return texts.some((text) => {
    const parsed = typeof text === 'string' ? parsePermissionRule(text) : undefined
    return (
      parsed?.ok === true && parsed.tool === 'WebFetch' && (parsed.specifier ?? '').trim() !== ''
    )
  })
}

/** The entries of the permission lists of the parsed settings object `data`. */
function entriesOf(data: Record<string, unknown>): unknown[] {
  const permissions = data.permissions
  if (permissions === null || typeof permissions !== 'object') {
    return []
  }
  const lists = permissions as Record<string, unknown>
  return LISTS.flatMap((list) => (Array.isArray(lists[list]) ? (lists[list] as unknown[]) : []))
}

/** The entries of the permission lists of the linted document. */
function entriesOfNode(body: ValueNode): unknown[] {
  const permissions = lastMember(body, 'permissions')?.value
  return LISTS.flatMap((list) => {
    const value = lastMember(permissions, list)?.value
    return value?.type === 'Array'
      ? value.elements.flatMap(({ value: element }) =>
          element.type === 'String' ? [element.value] : [],
        )
      : []
  })
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The parsed objects of the other settings files that Claude Code merges with `filename`, or
 *  `UNREADABLE` when one of them cannot be seen. */
function siblingsOf(filename: string): Record<string, unknown>[] | typeof UNREADABLE {
  if (kindOf(filename) === 'managed') {
    return readManagedSource(filename)
  }
  const dir = path.dirname(path.resolve(filename))
  const other =
    path.basename(filename) === 'settings.json' ? 'settings.local.json' : 'settings.json'
  const parsed = readJson(path.join(dir, other), repositoryRoot(dir))
  if (parsed === null) {
    return []
  }
  return parsed === UNREADABLE || !isObject(parsed.data) ? UNREADABLE : [parsed.data]
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'skipped' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Pair skipWebFetchPreflight with a WebFetch permission rule',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      skipped:
        '"skipWebFetchPreflight": true skips the WebFetch domain safety check, and no "WebFetch(...)" permission rule restricts the domains. WebFetch then attempts any URL.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const skip = lastMember(node.body, 'skipWebFetchPreflight')?.value
        if (skip?.type !== 'Boolean' || !skip.value || hasDomainRule(entriesOfNode(node.body))) {
          return
        }
        const siblings = siblingsOf(context.filename)
        if (siblings === UNREADABLE || siblings.some((data) => hasDomainRule(entriesOf(data)))) {
          return
        }
        context.report({ node: skip, messageId: 'skipped' })
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
