// The Boolean that Claude Code reads from a frontmatter value. The skills
// page accepts more forms than `true` and `false`. A rule that tests a
// Boolean field reads it here, so each rule reads the same forms.

/** The boolean that Claude Code reads from `value`: `true`, `false`, or one
 *  of `yes`, `no`, `on`, `off`, `1` and `0` in any letter case. Null for
 *  any other value, and for a list or a map. The function reads the parsed
 *  value, so it does not see the source form. A quoted `"yes"` reads as
 *  `true`, as does a number such as `1.0`, `01` or `0x1`. The skills page does
 *  not say that Claude Code reads these forms as `true`. */
export function readBoolean(value: unknown): boolean | null {
  if (!['boolean', 'number', 'string'].includes(typeof value)) {
    return null
  }
  const text = String(value).toLowerCase()
  if (['true', 'yes', 'on', '1'].includes(text)) {
    return true
  }
  return ['false', 'no', 'off', '0'].includes(text) ? false : null
}
