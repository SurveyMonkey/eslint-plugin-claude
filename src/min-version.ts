// The option `minVersion` of a rule that flags a feature by the Claude Code
// version that added it. The value is the oldest version that the repository
// supports. A rule reports only when the version is set and older than the fix.
// With no version set, the rule is inactive.
// No dependency parses a version here, because the docs write three numbers.

/** The schema of the option object `{ minVersion }`. */
export const MIN_VERSION_SCHEMA = {
  type: 'object',
  properties: {
    minVersion: {
      description: 'The oldest Claude Code version that the team supports, as major.minor.patch.',
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
    },
  },
  additionalProperties: false,
} as const

/** The three numbers of a version such as `2.1.239`. */
function parts(version: string): number[] {
  return version.split('.').map(Number)
}

/** True when the version `version` is older than `required`. The compare is numeric: `2.1.99` is
 *  older than `2.1.224`. Both must be `major.minor.patch`. The result is correct only for that
 *  form. Each `minVersion` schema pins it with the pattern `^\d+\.\d+\.\d+$`. Each other version
 *  is a literal in the code or in `src/data/`. A version with more or fewer numbers can give a
 *  wrong result. */
export function isBelow(version: string, required: string): boolean {
  const have = parts(version)
  const want = parts(required)
  const index = want.findIndex((n, i) => n !== have[i])
  return index !== -1 && (have[index] as number) < (want[index] as number)
}

/** True when `minVersion` is set and older than `fixed`. Then a Claude Code
 *  older than `fixed` can run the file. It is false when `minVersion` is unset. */
export function supportsBefore(minVersion: string | undefined, fixed: string): boolean {
  return minVersion !== undefined && isBelow(minVersion, fixed)
}
