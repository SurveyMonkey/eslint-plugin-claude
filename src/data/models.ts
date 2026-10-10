// The model aliases and the forms of a model ID that Claude Code accepts. Sources: the "Model
// aliases" table and the "Extended context" section of the model configuration page
// (https://code.claude.com/docs/en/model-config#model-aliases), the entry for `advisorModel` in
// the settings reference (https://code.claude.com/docs/en/settings-reference#advisormodel), and
// "Override model IDs per version" (https://code.claude.com/docs/en/model-config#override-model-ids-per-version).
// Checked on Claude Code 2.1.296 on 2026-10-09. Review these lists on or before 2027-04-09, the
// `stale_after` date of docs/rules/settings-model-value.md.

/** The families that have an alias. The `opus`, `sonnet`, `haiku` and `fable` aliases resolve to
 *  the newest model of the family. */
export const FAMILY_ALIASES: readonly string[] = ['fable', 'opus', 'sonnet', 'haiku']

/** The six aliases of the "Model aliases" table, apart from `default` and the `[1m]` spellings.
 *  `best` is the model that `fable` resolves to, or else the model of `opus`. `opusplan` uses
 *  `opus` in plan mode and `sonnet` after it. */
const BASE_ALIASES: readonly string[] = [...FAMILY_ALIASES, 'best', 'opusplan']

/** The value that clears a model override. The table says it is "not itself a model alias", yet
 *  `model` and `fallbackModel` accept it ("`default` expands to the default model"). */
export const DEFAULT_VALUE = 'default'

/** The aliases that `advisorModel` accepts. It also accepts a full model ID. */
export const ADVISOR_ALIASES: readonly string[] = ['fable', 'opus', 'sonnet']

/** The entries that `deniedModels` ignores, and that an `availableModelsMatch` of `"exact"`
 *  ignores in `availableModels`. */
export const IGNORED_IN_LISTS: readonly string[] = ['best', 'opusplan', DEFAULT_VALUE]

// The page says to append `[1m]` "to a model alias or a full model name".
const ONE_MILLION_SUFFIX = '[1m]'

/** True when `value` is an alias, or `default`. An alias takes the `[1m]` suffix. */
export function isModelAlias(value: string): boolean {
  if (value === DEFAULT_VALUE) {
    return true
  }
  return BASE_ALIASES.includes(withoutSuffix(value))
}

// The errors page says that an ID "starts with `claude-`". An ID has no space, and the only
// bracket text is the `[1m]` suffix.
const MODEL_ID = /^claude-[^\s[\]]+(?:\[1m\])?$/

/** True when `value` has the form of an Anthropic model ID: `claude-` and a name, with an optional
 *  `[1m]` suffix. The rule cannot tell whether the model exists. */
export function isModelId(value: string): boolean {
  return MODEL_ID.test(value)
}

// "Keys must be Anthropic model IDs as listed in the Models overview. For dated model IDs,
// include the date suffix exactly." A listed ID has lowercase letters, digits and hyphens.
const ANTHROPIC_MODEL_ID = /^claude-[a-z0-9-]+$/

/** True when `value` has the form of an ID in the Anthropic Models overview. A `modelOverrides`
 *  key has this form. A suffix, an alias and a provider ID do not have it. */
export function isAnthropicModelId(value: string): boolean {
  return ANTHROPIC_MODEL_ID.test(value)
}

/** `value` without the `[1m]` suffix. The page says Claude Code strips the suffix from an
 *  allowlist entry and from a requested model before it compares them. */
export function withoutSuffix(value: string): string {
  return value.endsWith(ONE_MILLION_SUFFIX) ? value.slice(0, -ONE_MILLION_SUFFIX.length) : value
}

// The family is a word of the ID between hyphens: `claude-opus-5-5`, `claude-3-5-haiku-latest`.
// A provider ID embeds it: `us.anthropic.claude-opus-4-8`. The page says that such an ID "counts as
// a specific entry for that family". A letter or a digit before `claude-` is part of another word.
const ID_FAMILY = /(?:^|[^a-z0-9])claude-(?:\d+-)*(fable|opus|sonnet|haiku)(?:-|[^a-z0-9]|$)/

/** True when `value` has a provider form that the docs name as valid: an Amazon Bedrock ARN, an
 *  `anthropic.` ID (a Mantle ID), or an ID that embeds a `claude-` model name, such as
 *  `us.anthropic.claude-opus-4-8` or `my-gateway/claude-opus-5-5`. The page says a deployment
 *  accepts "any string your API endpoint accepts", so the rule cannot judge any other form. */
export function hasProviderForm(value: string): boolean {
  return value.startsWith('arn:') || value.startsWith('anthropic.') || ID_FAMILY.test(value)
}

/** The family of an alias or an ID: `opus`, `sonnet`, `haiku` or `fable`. An ID can be a provider
 *  ID that embeds a `claude-` name. It is undefined for `best`, `opusplan`, `default` and any
 *  other value. */
export function familyOf(value: string): string | undefined {
  const base = withoutSuffix(value)
  return FAMILY_ALIASES.includes(base) ? base : ID_FAMILY.exec(value)?.[1]
}
