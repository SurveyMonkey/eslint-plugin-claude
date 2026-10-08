// The marketplaces that `extraKnownMarketplaces` registers in a project
// settings file (docs/rules/settings-extra-known-marketplaces-schema.md). A
// value is `{source, autoUpdate?}`. The rule checks the type of `source` and
// the fields of each type that Claude Code loads. It reads no other key.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  ANTHROPIC_MARKETPLACE_NAMES,
  CLAUDEAI_PREFIX,
  INTERNAL_MARKETPLACE_NAMES,
  PACKAGE_MANAGER_NAMES,
} from '../data/marketplace-reserved-names.ts'
import {
  MARKETPLACE_SOURCE_TYPES,
  UNLOADED_MARKETPLACE_SOURCE_TYPES,
} from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ObjectNode, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isSpellingOf } from './marketplace-name-reserved.ts'

const name = 'settings-extra-known-marketplaces-schema' as const

type LoadedType = (typeof MARKETPLACE_SOURCE_TYPES)[keyof typeof MARKETPLACE_SOURCE_TYPES]

const LOADED: readonly string[] = Object.values(MARKETPLACE_SOURCE_TYPES)
const TYPE_LIST = LOADED.join(', ')

/** The kinds of value that a field takes. */
type Kind = 'string' | 'boolean' | 'object' | 'array' | 'strings'

const FITS: Record<Kind, (value: ValueNode) => boolean> = {
  string: (value) => value.type === 'String',
  boolean: (value) => value.type === 'Boolean',
  object: (value) => value.type === 'Object',
  array: (value) => value.type === 'Array',
  strings: (value) =>
    value.type === 'Array' && value.elements.every((element) => element.value.type === 'String'),
}

/** What a message says that the value must be, for each kind. */
const EXPECTED: Record<Kind, string> = {
  string: 'a string',
  boolean: 'true or false',
  object: 'an object',
  array: 'an array',
  strings: 'an array of strings',
}

/** The fields of each source type that Claude Code loads, as the marketplace
 *  reference lists them. A source with another field, such as `skipLfs`, gives
 *  no report. */
const FIELDS: Record<
  LoadedType,
  { required: Record<string, Kind>; optional: Record<string, Kind> }
> = {
  github: {
    required: { repo: 'string' },
    optional: { ref: 'string', path: 'string', sparsePaths: 'strings' },
  },
  git: {
    required: { url: 'string' },
    optional: { ref: 'string', path: 'string', sparsePaths: 'strings' },
  },
  url: { required: { url: 'string' }, optional: { headers: 'object', headersHelper: 'string' } },
  file: { required: { path: 'string' }, optional: {} },
  directory: { required: { path: 'string' }, optional: {} },
  settings: { required: { name: 'string', plugins: 'array' }, optional: {} },
}

/** The fields of an item in the `plugins` of a `settings` source. */
const ITEM_FIELDS: Record<string, Kind> = {
  name: 'string',
  description: 'string',
  version: 'string',
  strict: 'boolean',
  headers: 'object',
  headersHelper: 'string',
}

// `owner/repo`: one slash, and no white space or second slash.
const REPO = /^[^/\s]+\/[^/\s]+$/
// The path of a `file` source ends with this, after a separator or at the start.
const MARKETPLACE_FILE = /(?:^|[\\/])\.claude-plugin[\\/]marketplace\.json$/

/** True when Claude Code reserves `text` as a marketplace name. A `settings`
 *  source is not a `github` or `git` source under `github.com/anthropics/`.
 *  So the exception for the Anthropic names does not apply. */
function reserved(text: string): boolean {
  return (
    ANTHROPIC_MARKETPLACE_NAMES.some((official) => isSpellingOf(text, official)) ||
    INTERNAL_MARKETPLACE_NAMES.includes(text) ||
    PACKAGE_MANAGER_NAMES.includes(text.toLowerCase()) ||
    text.startsWith(CLAUDEAI_PREFIX)
  )
}

type MessageIds =
  | 'valueNotObject'
  | 'sourceMissing'
  | 'sourceNotObject'
  | 'autoUpdateType'
  | 'typeMissing'
  | 'typeNotString'
  | 'typeUnknown'
  | 'typeNpm'
  | 'typeUnloaded'
  | 'missingField'
  | 'fieldType'
  | 'repoWildcard'
  | 'repoForm'
  | 'filePath'
  | 'nameMismatch'
  | 'nameReserved'
  | 'pluginNotObject'
  | 'pluginSource'
  | 'pluginFieldType'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write each extraKnownMarketplaces entry with a source that Claude Code loads',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      valueNotObject:
        'The "extraKnownMarketplaces" value of "{{key}}" must be an object with a "source" object and an optional "autoUpdate".',
      sourceMissing: 'The marketplace "{{key}}" needs a "source" object.',
      sourceNotObject: 'The "source" of the marketplace "{{key}}" must be an object.',
      autoUpdateType: 'The "autoUpdate" of the marketplace "{{key}}" must be true or false.',
      typeMissing:
        'The marketplace source has no "source" type. Set it to one of these types: {{types}}.',
      typeNotString:
        'The "source" type of a marketplace source must be a string. Set it to one of these types: {{types}}.',
      typeUnknown:
        '"{{type}}" is not a marketplace source type. Use one of these types: {{types}}.',
      typeNpm:
        'Claude Code cannot load an "npm" marketplace source: "NPM marketplace sources not yet implemented". Use one of these types: {{types}}.',
      typeUnloaded:
        'Claude Code does not load a "{{type}}" source in "extraKnownMarketplaces" ("Unsupported marketplace source type"). It is valid in the policy lists only. Use one of these types: {{types}}.',
      missingField: 'A "{{type}}" source needs the field "{{field}}".',
      fieldType: 'The "{{field}}" of a "{{type}}" source must be {{expected}}.',
      repoWildcard:
        'The "repo" of a "github" source must name one repository, and "{{value}}" has a "*". Claude Code takes it literally, and the clone fails.',
      repoForm: 'The "repo" of a "github" source must be "owner/repo", and "{{value}}" is not.',
      filePath:
        'The "path" of a "file" source must end with ".claude-plugin/marketplace.json". Claude Code takes the directory two levels up as the marketplace root.',
      nameMismatch:
        'The "name" of a "settings" source must equal the marketplace key "{{key}}", and "{{name}}" does not.',
      nameReserved:
        'The "name" of a "settings" source is "{{name}}", a name that Claude Code reserves.',
      pluginNotObject: 'Each item in "plugins" of a "settings" source must be an object.',
      pluginSource:
        'Each item in "plugins" of a "settings" source needs a "source" object. A relative path has no repository to resolve against.',
      pluginFieldType: 'The "{{field}}" of an item in "plugins" must be {{expected}}.',
    },
  },
  create(context) {
    const report = (node: ObjectNode | ValueNode, messageId: MessageIds, data = {}) =>
      context.report({ node, messageId, data })

    /** The items of the `plugins` of a `settings` source. */
    function checkItems(plugins: ValueNode & { type: 'Array' }) {
      for (const element of plugins.elements) {
        const item = element.value
        if (item.type !== 'Object') {
          report(item, 'pluginNotObject')
          continue
        }
        const source = lastMember(item, 'source')?.value
        if (source?.type !== 'Object') {
          report(source ?? item, 'pluginSource')
        }
        for (const [field, kind] of Object.entries(ITEM_FIELDS)) {
          const value = lastMember(item, field)?.value
          if (value !== undefined && !FITS[kind](value)) {
            report(value, 'pluginFieldType', { field, expected: EXPECTED[kind] })
          }
        }
      }
    }

    /** The checks of one field value that has the right kind. */
    function checkValue(type: LoadedType, key: string, field: string, value: ValueNode) {
      if (value.type === 'Array' && field === 'plugins') {
        checkItems(value)
      } else if (value.type !== 'String') {
        return
      } else if (type === 'github' && field === 'repo') {
        if (value.value.includes('*')) {
          report(value, 'repoWildcard', { value: value.value })
        } else if (!REPO.test(value.value)) {
          report(value, 'repoForm', { value: value.value })
        }
      } else if (type === 'file' && field === 'path' && !MARKETPLACE_FILE.test(value.value)) {
        report(value, 'filePath')
      } else if (type === 'settings' && field === 'name') {
        if (value.value !== key) {
          report(value, 'nameMismatch', { key, name: value.value })
        }
        if (reserved(value.value)) {
          report(value, 'nameReserved', { name: value.value })
        }
      }
    }

    /** The fields of `source`, a source of the loaded `type` under the marketplace `key`. */
    function checkFields(source: ObjectNode, type: LoadedType, key: string) {
      const { required, optional } = FIELDS[type]
      for (const [field, kind] of [...Object.entries(required), ...Object.entries(optional)]) {
        const value = lastMember(source, field)?.value
        if (value === undefined) {
          if (field in required) {
            report(source, 'missingField', { type, field })
          }
        } else if (FITS[kind](value)) {
          checkValue(type, key, field, value)
        } else {
          report(value, 'fieldType', { type, field, expected: EXPECTED[kind] })
        }
      }
    }

    /** The `source` type of a marketplace `key`, and then its fields. */
    function checkSource(source: ObjectNode, key: string) {
      const type = lastMember(source, 'source')?.value
      const data = { types: TYPE_LIST }
      if (type === undefined) {
        report(source, 'typeMissing', data)
      } else if (type.type !== 'String') {
        report(type, 'typeNotString', data)
      } else if (LOADED.includes(type.value)) {
        checkFields(source, type.value as LoadedType, key)
      } else if (type.value === UNLOADED_MARKETPLACE_SOURCE_TYPES.npm) {
        report(type, 'typeNpm', data)
      } else if (Object.values<string>(UNLOADED_MARKETPLACE_SOURCE_TYPES).includes(type.value)) {
        report(type, 'typeUnloaded', { ...data, type: type.value })
      } else {
        report(type, 'typeUnknown', { ...data, type: type.value })
      }
    }

    return {
      Document(node) {
        const marketplaces = lastMember(node.body, 'extraKnownMarketplaces')?.value
        if (marketplaces?.type !== 'Object') {
          return
        }
        for (const member of marketplaces.members) {
          const key = keyOf(member.name)
          // Two members with one name read as the last, as `JSON.parse` does.
          if (lastMember(marketplaces, key) !== member) {
            continue
          }
          const entry = member.value
          if (entry.type !== 'Object') {
            report(entry, 'valueNotObject', { key })
            continue
          }
          const autoUpdate = lastMember(entry, 'autoUpdate')?.value
          if (autoUpdate !== undefined && autoUpdate.type !== 'Boolean') {
            report(autoUpdate, 'autoUpdateType', { key })
          }
          const source = lastMember(entry, 'source')?.value
          if (source === undefined) {
            report(entry, 'sourceMissing', { key })
          } else if (source.type !== 'Object') {
            report(source, 'sourceNotObject', { key })
          } else {
            checkSource(source, key)
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
