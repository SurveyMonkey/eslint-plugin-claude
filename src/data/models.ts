// The model aliases and the forms of a model ID that Claude Code accepts. Sources:
// - The "Model aliases" table and the "Extended context" section of the model configuration page
//   (https://code.claude.com/docs/en/model-config#model-aliases).
// - The entry for `advisorModel` in the settings reference
//   (https://code.claude.com/docs/en/settings-reference#advisormodel).
// - "Override model IDs per version" (https://code.claude.com/docs/en/model-config#override-model-ids-per-version).
// - "Merge behavior", "Add a custom model option" and "Pin models for third-party deployments" of
//   the same page, for the family of an ID and for the `[1m]` suffix.
// - The errors page, "Model is not a recognized model ID", for the `claude-` prefix
//   (https://code.claude.com/docs/en/errors#model-is-not-a-recognized-model-id).
// - "Extended context", "Adaptive reasoning and fixed thinking budgets" and "Extended thinking" of
//   the same page, for the model versions at the end of this file.
// Checked on Claude Code 2.1.296 on 2026-10-09. Review these lists on or before 2027-04-09, the
// `stale_after` date of docs/rules/settings-model-value.md. Review the model versions at the end
// on or before the `stale_after` date of docs/rules/settings-model-capability.md.

/** The families that have an alias. Each alias resolves to a model of its family. The model can
 *  differ by provider. */
export const FAMILY_ALIASES: readonly string[] = ['fable', 'opus', 'sonnet', 'haiku']

/** The six aliases of the "Model aliases" table, apart from `default` and the `[1m]` spellings.
 *  `best` is the model that `fable` resolves to, or else the model of `opus`. `opusplan` uses
 *  `opus` in plan mode and `sonnet` after it. */
const BASE_ALIASES: readonly string[] = [...FAMILY_ALIASES, 'best', 'opusplan']

/** The value that clears a model override. The table says it is "not itself a model alias". The
 *  `fallbackModel` entry says "`default` expands to the default model". The rule accepts it for
 *  `model` too. */
export const DEFAULT_VALUE = 'default'

/** The aliases that `advisorModel` accepts. It also accepts a full model ID. */
export const ADVISOR_ALIASES: readonly string[] = ['fable', 'opus', 'sonnet']

/** The entries that `deniedModels` ignores. The page says the same of `availableModels` when
 *  `availableModelsMatch` is `"exact"`. The rules do not check that case. */
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

// The errors page says that a pick from a Remote Control device must be an alias, a listed model,
// or an ID that "starts with `claude-`". The rule uses that form for a settings value.
// A gateway or a provider can accept other forms. An ID has no space.
// The only bracket text is the `[1m]` suffix.
const MODEL_ID = /^claude-[^\s[\]]+(?:\[1m\])?$/

/** True when `value` has the form of an Anthropic model ID: `claude-` and a name, with an optional
 *  `[1m]` suffix. The rule cannot tell whether the model exists. */
export function isModelId(value: string): boolean {
  return MODEL_ID.test(value)
}

// "Keys must be Anthropic model IDs as listed in the Models overview." A listed ID has lowercase
// letters, digits and hyphens. For a dated ID, the page says to include the date suffix exactly.
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
// A provider ID embeds it: `us.anthropic.claude-opus-4-8`. The page says that a custom ID that
// embeds a family name "counts as a specific entry for that family". The rule treats a provider ID
// the same way. A letter or a digit before `claude-` is part of another word.
const ID_FAMILY = new RegExp(
  `(?:^|[^a-z0-9])claude-(?:\\d+-)*(${FAMILY_ALIASES.join('|')})(?:-|[^a-z0-9]|$)`,
)

/** True when `value` has a provider form that the docs name as valid: an Amazon Bedrock ARN, an
 *  `anthropic.` ID (a Mantle ID), or an ID that embeds a `claude-` model name, such as
 *  `us.anthropic.claude-opus-4-8` or `my-gateway/claude-opus-5-5`. The docs say that Claude Code
 *  skips validation for the custom model option. They say that a deployment can take any string
 *  its endpoint accepts. So the rule cannot judge any other form. */
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

/** The family and the version of a model: `claude-opus-4-8` is `opus`, 4, 8. */
export interface ModelVersion {
  family: string
  major: number
  minor: number
}

// The name of an ID puts the family first, or the version first for the older models:
// `claude-sonnet-4-5-20250929`, `claude-3-5-haiku-latest`. A minor version has one or two digits.
// A date has eight, so a date is not a minor version.
const NAME_FIRST = new RegExp(
  `(?:^|[^a-z0-9])claude-(${FAMILY_ALIASES.join('|')})-(\\d+)(?:-(\\d{1,2})(?![0-9]))?`,
)
const VERSION_FIRST = new RegExp(
  `(?:^|[^a-z0-9])claude-(\\d+)(?:-(\\d{1,2})(?![0-9]))?-(${FAMILY_ALIASES.join('|')})`,
)

/** The family and the version of the model ID `value`. A provider ID that embeds a `claude-`
 *  name counts. The result is undefined for an alias, an ARN and any other text. A minor version
 *  that the ID omits is 0. */
export function modelVersionOf(value: string): ModelVersion | undefined {
  const named = NAME_FIRST.exec(value)
  if (named !== null) {
    return { family: named[1] as string, major: Number(named[2]), minor: Number(named[3] ?? 0) }
  }
  const early = VERSION_FIRST.exec(value)
  return early === null
    ? undefined
    : { family: early[3] as string, major: Number(early[1]), minor: Number(early[2] ?? 0) }
}

/** True when the version of `model` is `major.minor` or later. */
const isFrom = (model: ModelVersion, major: number, minor: number) =>
  model.major > major || (model.major === major && model.minor >= minor)

/** True when the model has a 1M context window. The page lists Fable, Sonnet 5 and later, Haiku
 *  5.5, Opus 4.6 and later, and Sonnet 4.6. Haiku before 5.5 and Sonnet or Opus before 4.6 have
 *  none, and the `[1m]` suffix does not give it. */
export function hasOneMillionContext(model: ModelVersion): boolean {
  if (model.family === 'fable') {
    return true
  }
  return model.family === 'haiku' ? isFrom(model, 5, 5) : isFrom(model, 4, 6)
}

/** True when thinking cannot be turned off. The page names Opus 5.5, Sonnet 5.5, Haiku 5.5 and
 *  the Fable models. `alwaysThinkingEnabled: false` and `MAX_THINKING_TOKENS=0` have no effect
 *  on them. */
export function alwaysThinks(model: ModelVersion): boolean {
  return model.family === 'fable' || (model.major === 5 && model.minor === 5)
}

/** True when the model always uses adaptive reasoning. The page names the Fable models, Sonnet 5
 *  and later, Haiku 5.5, and Opus 4.7 and later. `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` does not
 *  apply to them. */
export function alwaysAdaptive(model: ModelVersion): boolean {
  switch (model.family) {
    case 'fable':
      return true
    case 'opus':
      return isFrom(model, 4, 7)
    case 'sonnet':
      return isFrom(model, 5, 0)
    default:
      return isFrom(model, 5, 5)
  }
}

/** The model that an alias resolves to on the Anthropic API, from the table of the page. The
 *  model differs on another provider, so a caller must not use this where a provider is set. */
export const ANTHROPIC_API_ALIASES: ReadonlyMap<string, ModelVersion> = new Map([
  ['fable', { family: 'fable', major: 5, minor: 1 }],
  ['opus', { family: 'opus', major: 5, minor: 5 }],
  ['sonnet', { family: 'sonnet', major: 5, minor: 5 }],
  ['haiku', { family: 'haiku', major: 5, minor: 5 }],
])

/** The families that an alias resolves through. `opusplan` uses Opus and then Sonnet. `best` is
 *  the Fable model where Fable is available, and the Opus model otherwise. `default` is not an
 *  alias, and the other aliases are their own family. */
export const ALIAS_FAMILIES: ReadonlyMap<string, readonly string[]> = new Map([
  ...FAMILY_ALIASES.map((family): [string, readonly string[]] => [family, [family]]),
  ['opusplan', ['opus', 'sonnet']],
  ['best', ['fable', 'opus']],
])

/** The variable that pins the alias of `family` to a model: `ANTHROPIC_DEFAULT_OPUS_MODEL`. */
export const pinVariableOf = (family: string) => `ANTHROPIC_DEFAULT_${family.toUpperCase()}_MODEL`
