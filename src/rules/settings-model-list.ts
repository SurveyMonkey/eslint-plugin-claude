// The model lists of a settings file (docs/rules/settings-model-list.md). Each check is a sentence
// of the model configuration page or the settings reference. The rule reads the linted file. For
// a managed file, it also reads the sibling files of the same managed source. A list in a file
// outside that source is not seen. The aliases and the ID forms are in `src/data/models.ts`.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  DEFAULT_VALUE,
  FAMILY_ALIASES,
  familyOf,
  IGNORED_IN_LISTS,
  isAnthropicModelId,
  isModelAlias,
  withoutSuffix,
} from '../data/models.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import {
  isHiddenDropIn,
  kindOf,
  MANAGED_SETTINGS_FILES,
  readManagedSource,
} from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'settings-model-list' as const

// The docs cap a fallback chain at three models, and no Claude Code setting moves the cap. So
// the schema sets that number as the maximum of the option `max` (CONTRIBUTING.md, "Rule
// thresholds").
const CHAIN_MAX = 3

type Options = [{ max: number }]
type MessageId =
  | 'tooMany'
  | 'overConfiguredLimit'
  | 'emptyList'
  | 'enforceNeedsList'
  | 'narrowed'
  | 'deniedIgnored'
  | 'overrideKey'
  | 'customOption'

/** The keys that name a model, and that an empty `availableModels` blocks. */
const NAMING_KEYS = ['model', 'fallbackModel', 'advisorModel']

/** The string entries of the array `value`, with their nodes. */
function stringEntries(value: ValueNode | undefined) {
  if (value?.type !== 'Array') {
    return []
  }
  return value.elements.flatMap(({ value: entry }) =>
    entry.type === 'String' ? [{ text: entry.value, node: entry }] : [],
  )
}

/** True when `value` names a model: a string other than `default`. */
function namesModel(value: ValueNode | undefined): boolean {
  return value?.type === 'String' && value.value !== DEFAULT_VALUE
}

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keep the model lists of a settings file consistent with the way Claude Code reads them',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1, maximum: CHAIN_MAX } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: CHAIN_MAX }],
    messages: {
      tooMany:
        'Claude Code keeps at most {{max}} distinct models in "fallbackModel" and ignores the rest. It ignores "{{value}}".',
      overConfiguredLimit:
        'The configured limit is {{max}} distinct models in "fallbackModel". The entry "{{value}}" is over it.',
      emptyList:
        'The empty "availableModels" blocks every named model. This file names a model in {{keys}}.',
      enforceNeedsList:
        '"enforceAvailableModels" has no effect while "availableModels" is unset or empty in this file.',
      narrowed:
        'The entry "{{alias}}" allows only the versions that "{{id}}" names. A specific entry disables the entry of its family.',
      deniedIgnored: 'Claude Code ignores "{{value}}" in "deniedModels".',
      overrideKey:
        'The key "{{key}}" of "modelOverrides" is not an Anthropic model ID. Claude Code ignores unknown keys.',
      customOption:
        'The custom model option "{{value}}" is not in "availableModels". Claude Code hides it from the picker and rejects it as a --model value.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const [{ max }] = context.options
    const isManaged = kindOf(context.filename) === 'managed'

    return {
      Document(node) {
        const body = node.body
        if (body.type !== 'Object') {
          return
        }
        const top = (key: string) => lastMember(body, key)?.value
        const available = top('availableModels')
        const entries = stringEntries(available)

        // The managed source is `managed-settings.json` and its drop-ins, merged. Lists combine.
        // A sibling that the rule cannot read can hold any list, so the three checks that need
        // the whole list stay silent.
        const siblings = isManaged ? readManagedSource(context.filename) : []
        const siblingEntries =
          siblings === UNREADABLE
            ? []
            : siblings.flatMap(({ availableModels }) =>
                Array.isArray(availableModels)
                  ? availableModels.filter((entry): entry is string => typeof entry === 'string')
                  : [],
              )
        const listUnknown = siblings === UNREADABLE || siblingEntries.length > 0

        // Claude Code caps a chain after it removes the duplicates.
        const distinct = new Set<string>()
        for (const { text, node: entry } of stringEntries(top('fallbackModel'))) {
          distinct.add(text)
          if (distinct.size > max) {
            context.report({
              node: entry,
              // At another value, the message names the configured limit and claims no docs limit.
              messageId: max === CHAIN_MAX ? 'tooMany' : 'overConfiguredLimit',
              data: { max: String(max), value: text },
            })
            break
          }
        }

        if (available?.type === 'Array' && available.elements.length === 0 && !listUnknown) {
          const keys = NAMING_KEYS.filter((key) => {
            const value = top(key)
            return value?.type === 'Array'
              ? stringEntries(value).some(({ text }) => text !== DEFAULT_VALUE)
              : namesModel(value)
          })
          if (keys.length > 0) {
            context.report({
              node: available,
              messageId: 'emptyList',
              data: { keys: keys.map((key) => `"${key}"`).join(', ') },
            })
          }
        }

        // Both keys go together in the managed source. A project file can pair with a list in the
        // user file, which the rule does not see.
        const enforce = lastMember(body, 'enforceAvailableModels')
        if (
          isManaged &&
          enforce?.value.type === 'Boolean' &&
          enforce.value.value &&
          !listUnknown &&
          !(available?.type === 'Array' && available.elements.length > 0)
        ) {
          context.report({ node: enforce.name, messageId: 'enforceNeedsList' })
        }

        for (const { text: alias, node: entry } of entries) {
          const family = FAMILY_ALIASES.includes(withoutSuffix(alias)) ? familyOf(alias) : undefined
          const specific = entries.find(
            ({ text }) => !isModelAlias(text) && family !== undefined && familyOf(text) === family,
          )
          if (specific !== undefined) {
            context.report({
              node: entry,
              messageId: 'narrowed',
              data: { alias, id: specific.text },
            })
          }
        }

        // `deniedModels` is a managed-only key. `settings-key-scope` reports it in a project file.
        if (isManaged) {
          for (const { text, node: entry } of stringEntries(top('deniedModels'))) {
            if (IGNORED_IN_LISTS.includes(text)) {
              context.report({ node: entry, messageId: 'deniedIgnored', data: { value: text } })
            }
          }
        }

        const overrides = top('modelOverrides')
        if (overrides?.type === 'Object') {
          for (const member of overrides.members) {
            const key = keyOf(member.name)
            // Two keys of one name: the last counts, as in `JSON.parse`.
            if (lastMember(overrides, key) === member && !isAnthropicModelId(key)) {
              context.report({ node: member.name, messageId: 'overrideKey', data: { key } })
            }
          }
        }

        const option = lastMember(top('env'), 'ANTHROPIC_CUSTOM_MODEL_OPTION')?.value
        if (
          option?.type === 'String' &&
          option.value !== '' &&
          available?.type === 'Array' &&
          siblings !== UNREADABLE &&
          ![...entries.map(({ text }) => text), ...siblingEntries].some((text) =>
            allows(text, option.value),
          )
        ) {
          context.report({ node: option, messageId: 'customOption', data: { value: option.value } })
        }
      },
    }
  },
}

/** True when the allowlist entry `entry` permits the model `id`. The page says that an allowlist
 *  entry matches an alias, a version prefix, or the full ID. A version prefix also matches "later
 *  model IDs that extend it with another segment". A family alias covers the models of its family.
 *  The rule takes a doubt as a yes, so that it reports a certain fault only. The aliases `best`,
 *  `opusplan` and `default` have no one family, so they permit every model. */
function allows(entry: string, id: string): boolean {
  const [from, model] = [withoutSuffix(entry), withoutSuffix(id)]
  if (isModelAlias(from)) {
    const family = familyOf(from)
    return family === undefined || family === familyOf(model)
  }
  // The next character of the model must start another segment: `claude-opus-5` does not permit
  // `claude-opus-55`.
  return model === from || (model.startsWith(from) && !/[a-z0-9]/i.test(model.charAt(from.length)))
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
