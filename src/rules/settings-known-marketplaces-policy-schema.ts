// The marketplace policy lists of a managed settings file
// (docs/rules/settings-known-marketplaces-policy-schema.md). Each entry of
// `strictKnownMarketplaces` (alias `allowedMarketplaces`) and of
// `blockedMarketplaces` is a source object. The rule checks the shape only. It
// reads no path target: an absolute path is out of the repository.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import {
  MARKETPLACE_SOURCE_TYPES,
  UNLOADED_MARKETPLACE_SOURCE_TYPES,
} from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ObjectNode, type ValueNode } from '../marketplace-json.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-known-marketplaces-policy-schema' as const

/** The source types that a policy entry can have. `npm` is not one of them: it parses and
 *  matches nothing (the marketplace reference, "Marketplace sources"). */
const { npm: NPM, ...POLICY_ONLY } = UNLOADED_MARKETPLACE_SOURCE_TYPES
const TYPES: readonly string[] = [
  ...Object.values(MARKETPLACE_SOURCE_TYPES),
  ...Object.values(POLICY_ONLY),
]
const TYPE_LIST = TYPES.join(', ')

type Kind = 'string' | 'object'

const FITS: Record<Kind, (value: ValueNode) => boolean> = {
  string: (value) => value.type === 'String',
  object: (value) => value.type === 'Object',
}
const EXPECTED: Record<Kind, string> = { string: 'a string', object: 'an object' }

/** The fields of each source type that the settings reference lists in "Allowed source types".
 *  A type that is not here has no field to check: `skills-dir` has none, and the page gives
 *  `settings` no row. A field that is not here gives no report. */
const FIELDS: Record<string, { required: Record<string, Kind>; optional: Record<string, Kind> }> = {
  github: { required: { repo: 'string' }, optional: { ref: 'string', path: 'string' } },
  git: { required: { url: 'string' }, optional: { ref: 'string', path: 'string' } },
  url: { required: { url: 'string' }, optional: { headers: 'object' } },
  file: { required: { path: 'string' }, optional: {} },
  directory: { required: { path: 'string' }, optional: {} },
  hostPattern: { required: { hostPattern: 'string' }, optional: {} },
  pathPattern: { required: { pathPattern: 'string' }, optional: {} },
}

/** The policy lists, each with the alias that Claude Code reads when the canonical key is not
 *  there ("Marketplace key aliases"). */
const LISTS: readonly { key: string; alias?: string }[] = [
  { key: 'strictKnownMarketplaces', alias: 'allowedMarketplaces' },
  { key: 'blockedMarketplaces' },
]

// An owner wildcard is `<owner>/*`. A `*` anywhere else makes the entry invalid.
const OWNER_WILDCARD = /^[^/*\s]+\/\*$/

/** True when `text` compiles as a JavaScript regular expression. */
function compiles(text: string): boolean {
  try {
    new RegExp(text)
    return true
  } catch {
    return false
  }
}

type MessageIds =
  | 'entryNotObject'
  | 'typeMissing'
  | 'typeNotString'
  | 'typeUnknown'
  | 'typeNpm'
  | 'missingField'
  | 'fieldType'
  | 'pathRelative'
  | 'patternInvalid'
  | 'repoWildcard'
  | 'trustMessageType'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write each marketplace policy entry as a source object that Claude Code reads',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      entryNotObject: 'Each entry of "{{key}}" must be a source object.',
      typeMissing: 'The source has no "source" type. Set it to one of these types: {{types}}.',
      typeNotString:
        'The "source" type of a policy entry must be a string. Set it to one of these types: {{types}}.',
      typeUnknown:
        '"{{type}}" is not a marketplace source type. Use one of these types: {{types}}.',
      typeNpm:
        'An "npm" entry in "{{key}}" parses and matches nothing, because nothing registers an npm marketplace. Use one of these types: {{types}}.',
      missingField: 'A "{{type}}" source needs the field "{{field}}".',
      fieldType: 'The "{{field}}" of a "{{type}}" source must be {{expected}}.',
      pathRelative:
        'The "path" of a "{{type}}" source must be an absolute path, and "{{value}}" is not.',
      patternInvalid:
        'The "{{field}}" of a "{{type}}" source must be a regular expression, and "{{value}}" does not compile.',
      repoWildcard:
        'A "*" in the "repo" of a "github" source is valid only as "<owner>/*". Claude Code ignores "{{value}}" as invalid, so it matches no repository.',
      trustMessageType: 'The "pluginTrustMessage" must be a string.',
    },
  },
  create(context) {
    const report = (node: ObjectNode | ValueNode, messageId: MessageIds, data = {}) =>
      context.report({ node, messageId, data })

    /** The checks of one field value that has the right kind. */
    function checkValue(type: string, field: string, value: ValueNode) {
      if (value.type !== 'String') {
        return
      }
      if (field === 'path' && (type === 'file' || type === 'directory')) {
        // Both forms of an absolute path, so that the result does not depend on the machine.
        if (!path.win32.isAbsolute(value.value)) {
          report(value, 'pathRelative', { type, value: value.value })
        }
      } else if (type === 'hostPattern' || type === 'pathPattern') {
        if (!compiles(value.value)) {
          report(value, 'patternInvalid', { type, field, value: value.value })
        }
      } else if (type === 'github' && field === 'repo') {
        if (value.value.includes('*') && !OWNER_WILDCARD.test(value.value)) {
          report(value, 'repoWildcard', { value: value.value })
        }
      }
    }

    /** The fields of `source`, a source of the known `type`. */
    function checkFields(source: ObjectNode, type: string) {
      const { required, optional } = FIELDS[type] ?? { required: {}, optional: {} }
      for (const [field, kind] of [...Object.entries(required), ...Object.entries(optional)]) {
        const value = lastMember(source, field)?.value
        if (value === undefined) {
          if (field in required) {
            report(source, 'missingField', { type, field })
          }
        } else if (FITS[kind](value)) {
          checkValue(type, field, value)
        } else {
          report(value, 'fieldType', { type, field, expected: EXPECTED[kind] })
        }
      }
    }

    /** The `source` type of one entry of the list `key`, and then its fields. */
    function checkEntry(source: ObjectNode, key: string) {
      const type = lastMember(source, 'source')?.value
      const data = { types: TYPE_LIST, key }
      if (type === undefined) {
        report(source, 'typeMissing', data)
      } else if (type.type !== 'String') {
        report(type, 'typeNotString', data)
      } else if (type.value === NPM) {
        report(type, 'typeNpm', data)
      } else if (TYPES.includes(type.value)) {
        checkFields(source, type.value)
      } else {
        report(type, 'typeUnknown', { ...data, type: type.value })
      }
    }

    return {
      Document(node) {
        // Claude Code ignores a hidden drop-in, so it reads no key there.
        if (isHiddenDropIn(context.filename)) {
          return
        }
        const { body } = node
        for (const { key, alias } of LISTS) {
          // With both spellings, Claude Code uses the canonical key and ignores the alias.
          const member =
            lastMember(body, key) ?? (alias === undefined ? undefined : lastMember(body, alias))
          if (member?.value.type !== 'Array') {
            continue
          }
          for (const { value: entry } of member.value.elements) {
            if (entry.type === 'Object') {
              checkEntry(entry, key)
            } else {
              report(entry, 'entryNotObject', { key })
            }
          }
        }
        const trust = lastMember(body, 'pluginTrustMessage')?.value
        // A `null` removes the key.
        if (trust !== undefined && trust.type !== 'String' && trust.type !== 'Null') {
          report(trust, 'trustMessageType')
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
