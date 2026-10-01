// Checks on frontmatter keys and values that the rules for subagent and
// output style files share.

/** A key without case, hyphens, underscores and spaces: `max_turns` and
 *  `maxTurns` give the same text. */
function squash(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '')
}

/** The known key that `key` is a near miss of, or undefined. */
export function nearMissOf(key: string, known: readonly string[]): string | undefined {
  return known.find((k) => squash(k) === squash(key))
}

/** True when Claude Code reads `value` as a Boolean. The skills reference
 *  lists `yes`, `no`, `on`, `off`, `1` and `0` in any case, besides `true`
 *  and `false`. The subagent and output style references do not list the
 *  forms, so the rules accept the same ones. */
export function isBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean' || value === 0 || value === 1) {
    return true
  }
  return (
    typeof value === 'string' &&
    ['true', 'false', 'yes', 'no', 'on', 'off', '1', '0'].includes(value.toLowerCase())
  )
}

/** True when `value` is a map, and not a list. */
export function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
