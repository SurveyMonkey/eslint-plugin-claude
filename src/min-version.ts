// The option `minVersion` of a rule that flags a feature by the Claude Code
// version that added it. The value is the oldest version that the repository
// supports. A rule reports when the version is unset or older than the fix.
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

/** True when a Claude Code older than `fixed` can run the file. That is true
 *  when `minVersion` is unset, and when it is older than `fixed`. */
export function supportsBefore(minVersion: string | undefined, fixed: string): boolean {
  if (minVersion === undefined) {
    return true
  }
  const have = parts(minVersion)
  const want = parts(fixed)
  const index = want.findIndex((n, i) => n !== have[i])
  return index !== -1 && (have[index] as number) < (want[index] as number)
}
