// The `minVersion` option of the rules that check a Claude Code version. A
// rule with this option reports only when the option is set and is lower
// than the version that fixed the problem. With no option, the rule is
// inactive, because the file does not show which versions its users run.

/** The schema of the options of such a rule. A version is `major.minor.patch`. */
export const MIN_VERSION_SCHEMA = {
  type: 'object',
  properties: { minVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' } },
  additionalProperties: false,
} as const

/** The options of such a rule. */
export type MinVersionOptions = [{ minVersion?: string }]

/** True when the version `version` is lower than `required`. Both are
 *  `major.minor.patch`. */
export function isBelow(version: string, required: string): boolean {
  const have = version.split('.').map(Number)
  const need = required.split('.').map(Number)
  for (const [index, part] of need.entries()) {
    const own = have[index] as number
    if (own !== part) {
      return own < part
    }
  }
  return false
}
