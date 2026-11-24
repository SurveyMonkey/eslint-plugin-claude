// A check of the plain values of a `sandbox` object against the types of `SANDBOX_SHAPES`. It
// reads the type of each known key, and the type of each array entry. It does not read an
// unknown key, a `null`, or anything below `credentials`. Before v2.1.283, Claude Code drops
// the managed `sandbox` block when one such value is invalid
// (https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox).
// `sandbox-schema` checks AST nodes and reads a managed quoted Boolean as valid. This check does
// not: a quoted `"true"` has the wrong type here.
import { SANDBOX_SHAPES, type Shape } from './data/sandbox-keys.ts'
import { isObject } from './permission-source.ts'

const isStrings = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/** True when `value` has the type that `shape` names. The check reads types only. */
function matches(value: unknown, shape: Shape): boolean {
  switch (shape.type) {
    case 'boolean':
      return typeof value === 'boolean'
    case 'port':
      return typeof value === 'number'
    case 'strings':
    case 'machNames':
      return isStrings(value)
    case 'violations':
      return isObject(value) && Object.values(value).every(isStrings)
    case 'object':
      return (
        isObject(value) &&
        Object.entries(shape.fields ?? {}).every(
          ([key, field]) =>
            value[key] === undefined || value[key] === null || matches(value[key], field),
        )
      )
    default:
      // string, absolutePath and enum are strings. A `list` shape is only below `credentials`,
      // which this check does not read.
      return typeof value === 'string'
  }
}

/** The value at the dotted `key` below `sandbox`, or undefined when a key on the way is not an
 *  object. */
function valueBelow(sandbox: Record<string, unknown>, key: string): unknown {
  let value: unknown = sandbox
  for (const part of key.split('.').slice(1)) {
    value = isObject(value) ? value[part] : undefined
  }
  return value
}

/** True when `sandbox` is an object with a known key, outside `credentials`, whose value has the
 *  wrong type. A value that is not an object has no key to read. */
export function hasInvalidSandboxValue(sandbox: unknown): boolean {
  if (!isObject(sandbox)) {
    return false
  }
  return Object.entries(SANDBOX_SHAPES).some(([key, shape]) => {
    if (key.startsWith('sandbox.credentials')) {
      return false
    }
    const value = valueBelow(sandbox, key)
    return value !== undefined && value !== null && !matches(value, shape)
  })
}
