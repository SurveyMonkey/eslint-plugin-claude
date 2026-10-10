// The option `minVersion` of a rule that flags a feature by the Claude Code
// version that added it. The value is the oldest version that the repository
// supports. A rule reports only when the version is set and older than the fix.
// With no version set, the rule is inactive.
// No dependency parses a version here, because the docs write three numbers.

/** The schema of the option object `{ minVersion }`. */
export const MIN_VERSION_SCHEMA = {
  type: 'object',
  properties: { minVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' } },
  additionalProperties: false,
} as const

/** The three numbers of a version such as `2.1.239`. */
function parts(version: string): number[] {
  return version.split('.').map(Number)
}

/** True when `minVersion` is set and older than `fixed`. Then a Claude Code
 *  older than `fixed` can run the file. It is false when `minVersion` is unset. */
export function supportsBefore(minVersion: string | undefined, fixed: string): boolean {
  if (minVersion === undefined) {
    return false
  }
  const have = parts(minVersion)
  const want = parts(fixed)
  const index = want.findIndex((n, i) => n !== have[i])
  return index !== -1 && (have[index] as number) < (want[index] as number)
}
