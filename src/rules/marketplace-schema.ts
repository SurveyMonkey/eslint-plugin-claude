// The top-level fields, the `owner`, and the entries of `marketplace.json`:
// the fields that the docs require, and the type of each field that the docs
// list (docs/rules/marketplace-schema.md). This rule reports a value of the
// wrong type for each field that another `marketplace-*` rule reads, and no
// other rule does.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ObjectNode, type ValueNode } from '../marketplace-json.ts'

const name = 'marketplace-schema' as const

type MessageIds =
  | 'notObject'
  | 'missing'
  | 'empty'
  | 'wrongType'
  | 'notStringElement'
  | 'renamesValue'
  | 'entryNotObject'

/** The kinds of value that a field takes, as the docs name them. */
type Kind = 'string' | 'boolean' | 'object' | 'array' | 'strings' | 'renames' | 'source' | 'hooks'

/** The node types that fit each kind. A `hooks` that is a string or an array
 *  is for `marketplace-entry-hooks-inline`, so it fits here. */
const ALLOWED: Record<Kind, readonly string[]> = {
  string: ['String'],
  boolean: ['Boolean'],
  object: ['Object'],
  array: ['Array'],
  strings: ['Array'],
  renames: ['Object'],
  source: ['String', 'Object'],
  hooks: ['String', 'Array', 'Object'],
}

/** What the message says that the value must be, for each kind. */
const EXPECTED: Record<Kind, string> = {
  string: 'a string',
  boolean: 'a boolean',
  object: 'an object',
  array: 'an array',
  strings: 'an array of strings',
  renames: 'an object',
  source: 'a string or an object',
  hooks: 'an object',
}

// The fields of the top level that the docs table lists, with their kinds.
const TOP_FIELDS: [string, Kind][] = [
  ['name', 'string'],
  ['owner', 'object'],
  ['plugins', 'array'],
  ['$schema', 'string'],
  ['description', 'string'],
  ['version', 'string'],
  ['forceRemoveDeletedPlugins', 'boolean'],
  ['allowCrossMarketplaceDependenciesOn', 'strings'],
  ['renames', 'renames'],
]
const METADATA_FIELDS = ['description', 'version', 'pluginRoot']
const ENTRY_FIELDS: [string, Kind][] = [
  ['name', 'string'],
  ['source', 'source'],
  ['description', 'string'],
  ['version', 'string'],
  ['category', 'string'],
  ['tags', 'strings'],
  ['strict', 'boolean'],
  ['defaultEnabled', 'boolean'],
  ['displayName', 'string'],
  ['headers', 'object'],
  ['headersHelper', 'string'],
  ['metadata', 'object'],
  ['experimental', 'object'],
  ['relevance', 'object'],
  ['hooks', 'hooks'],
]

const rule: JSONRuleDefinition<{ MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the fields of marketplace.json as the docs require',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject: 'The marketplace file must be a JSON object.',
      missing: 'The {{where}} needs "{{key}}".',
      empty: 'The "{{path}}" must not be empty.',
      wrongType: 'The "{{path}}" must be {{expected}}.',
      notStringElement: 'The "{{path}}" must hold strings only.',
      renamesValue:
        'Each value in "renames" must be a string, or null for a plugin that you removed.',
      entryNotObject: 'Each item in "plugins" must be an object.',
    },
  },
  create(context) {
    /** The members of `object` in `keys` that are missing. */
    function requireKeys(object: ObjectNode, keys: string[], where: string): void {
      for (const key of keys) {
        if (lastMember(object, key) === undefined) {
          context.report({ node: object, messageId: 'missing', data: { where, key } })
        }
      }
    }

    /** The type of the member `key` of `object`, when it is set. */
    function checkField(object: ObjectNode, key: string, kind: Kind, path: string): void {
      const value = lastMember(object, key)?.value
      if (value === undefined) {
        return
      }
      if (!ALLOWED[kind].includes(value.type)) {
        context.report({
          node: value,
          messageId: 'wrongType',
          data: { path, expected: EXPECTED[kind] },
        })
      } else if (value.type === 'Array' && kind === 'strings') {
        for (const element of value.elements) {
          if (element.value.type !== 'String') {
            context.report({ node: element.value, messageId: 'notStringElement', data: { path } })
          }
        }
      } else if (value.type === 'Object' && kind === 'renames') {
        for (const member of value.members) {
          if (member.value.type !== 'String' && member.value.type !== 'Null') {
            context.report({ node: member.value, messageId: 'renamesValue' })
          }
        }
      }
    }

    /** A string member that is set to the empty string. */
    function checkNotEmpty(object: ObjectNode, key: string, path: string): void {
      const value = lastMember(object, key)?.value
      if (value?.type === 'String' && value.value === '') {
        context.report({ node: value, messageId: 'empty', data: { path } })
      }
    }

    return {
      Document(node) {
        const body: ValueNode = node.body
        if (body.type !== 'Object') {
          context.report({ node: body, messageId: 'notObject' })
          return
        }
        requireKeys(body, ['name', 'owner', 'plugins'], 'marketplace file')
        for (const [key, kind] of TOP_FIELDS) {
          checkField(body, key, kind, key)
        }
        checkNotEmpty(body, 'name', 'name')
        const owner = lastMember(body, 'owner')?.value
        if (owner?.type === 'Object') {
          requireKeys(owner, ['name'], '"owner" object')
          checkField(owner, 'name', 'string', 'owner.name')
          checkNotEmpty(owner, 'name', 'owner.name')
        }
        const metadata = lastMember(body, 'metadata')?.value
        if (metadata?.type === 'Object') {
          for (const key of METADATA_FIELDS) {
            checkField(metadata, key, 'string', `metadata.${key}`)
          }
        }
        const plugins = lastMember(body, 'plugins')?.value
        if (plugins?.type !== 'Array') {
          return
        }
        for (const [index, element] of plugins.elements.entries()) {
          const entry = element.value
          if (entry.type !== 'Object') {
            context.report({ node: entry, messageId: 'entryNotObject' })
            continue
          }
          const path = `plugins[${index}]`
          requireKeys(entry, ['name', 'source'], `entry ${path}`)
          for (const [key, kind] of ENTRY_FIELDS) {
            checkField(entry, key, kind, `${path}.${key}`)
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}
