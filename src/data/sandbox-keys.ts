// The type of each key in `sandbox`. Source: the entries of the sandbox settings in the settings
// reference (https://code.claude.com/docs/en/settings-reference#sandbox-settings), checked on
// Claude Code 2.1.296 on 2026-10-10. Review these types on or before 2027-04-10, the `stale_after`
// date of docs/rules/sandbox-schema.md.
//
// The names of the keys are in `src/data/settings-keys.ts`, with the scope of each. This module
// holds the types only. `tests/data/sandbox-keys.test.ts` checks that every key of `sandbox` in
// the index has a type here, and that no type here lacks a key.

/** The type of a value. A rule reads a value by its type, and reports the first fault. */
export type Shape =
  | { readonly type: 'boolean' }
  | { readonly type: 'string' }
  /** An array of strings. */
  | { readonly type: 'strings' }
  /** An array of strings in which a `*` may only end an entry (`allowMachLookup`). */
  | { readonly type: 'machNames' }
  /** A string that is an absolute path. Claude Code drops a relative path. */
  | { readonly type: 'absolutePath' }
  /** A number that is a TCP port. The docs say "a local TCP port", so the range is 1 to 65535. */
  | { readonly type: 'port' }
  | { readonly type: 'enum'; readonly values: readonly string[] }
  /** A string that is the name of an environment variable. */
  | { readonly type: 'envName' }
  /** An object that maps a command to an array of strings (`ignoreViolations`). */
  | { readonly type: 'violations' }
  /** An array of objects of one shape. */
  | { readonly type: 'list'; readonly item: Shape }
  /** An object. `fields` types the keys that it names, and `required` lists the keys it needs.
   *  The rule reports no other key of this object. */
  | {
      readonly type: 'object'
      readonly fields?: Readonly<Record<string, Shape>>
      readonly required?: readonly string[]
    }

const boolean: Shape = { type: 'boolean' }
const string: Shape = { type: 'string' }
const strings: Shape = { type: 'strings' }
const object: Shape = { type: 'object' }
const mode: Shape = { type: 'enum', values: ['deny', 'mask'] }

/** The fields that a `mask` entry of `credentials.files` and of `credentials.envVars` share. */
const MASK_FIELDS: Readonly<Record<string, Shape>> = {
  mode,
  extract: string,
  onExtractNoMatch: { type: 'enum', values: ['warn', 'deny', 'error'] },
  decode: { type: 'enum', values: ['jwt'] },
  maskClaims: strings,
  injectHosts: strings,
}

const sigv4: Shape = { type: 'enum', values: ['deny', 'passthrough'] }

/** The type of each key below `sandbox`, by its dotted name. */
export const SANDBOX_SHAPES: Readonly<Record<string, Shape>> = {
  'sandbox.enabled': boolean,
  'sandbox.failIfUnavailable': boolean,
  'sandbox.autoAllowBashIfSandboxed': boolean,
  'sandbox.excludedCommands': strings,
  'sandbox.allowUnsandboxedCommands': boolean,
  'sandbox.enableWeakerNestedSandbox': boolean,
  'sandbox.enableWeakerNetworkIsolation': boolean,
  'sandbox.allowAppleEvents': boolean,
  'sandbox.bwrapPath': { type: 'absolutePath' },
  'sandbox.socatPath': { type: 'absolutePath' },
  'sandbox.ignoreViolations': { type: 'violations' },
  'sandbox.ripgrep': {
    type: 'object',
    fields: { command: string, args: strings },
    required: ['command'],
  },
  'sandbox.filesystem': object,
  'sandbox.filesystem.allowWrite': strings,
  'sandbox.filesystem.denyWrite': strings,
  'sandbox.filesystem.denyRead': strings,
  'sandbox.filesystem.allowRead': strings,
  'sandbox.filesystem.allowManagedReadPathsOnly': boolean,
  'sandbox.filesystem.disabled': boolean,
  'sandbox.network': object,
  'sandbox.network.allowUnixSockets': strings,
  'sandbox.network.allowAllUnixSockets': boolean,
  'sandbox.network.allowLocalBinding': boolean,
  'sandbox.network.allowMachLookup': { type: 'machNames' },
  'sandbox.network.allowedDomains': strings,
  'sandbox.network.deniedDomains': strings,
  'sandbox.network.strictAllowlist': boolean,
  'sandbox.network.allowManagedDomainsOnly': boolean,
  'sandbox.network.httpProxyPort': { type: 'port' },
  'sandbox.network.socksProxyPort': { type: 'port' },
  'sandbox.network.tlsTerminate': {
    type: 'object',
    fields: { caCertPath: string, caKeyPath: string },
  },
  'sandbox.credentials': object,
  'sandbox.credentials.files': {
    type: 'list',
    item: {
      type: 'object',
      fields: { path: string, maskDuplicates: boolean, ...MASK_FIELDS },
      required: ['path', 'mode'],
    },
  },
  'sandbox.credentials.envVars': {
    type: 'list',
    item: {
      type: 'object',
      fields: { name: { type: 'envName' }, ...MASK_FIELDS },
      required: ['name', 'mode'],
    },
  },
  'sandbox.credentials.allowPlaintextInject': boolean,
  'sandbox.credentials.awsPairs': {
    type: 'list',
    item: {
      type: 'object',
      fields: { accessKeyIdVar: string, secretAccessKeyVar: string, sessionTokenVar: string },
      required: ['accessKeyIdVar', 'secretAccessKeyVar'],
    },
  },
  'sandbox.credentials.sigv4': {
    type: 'object',
    fields: { streaming: sigv4, presigned: sigv4, sigv4a: sigv4 },
  },
}

/** A list that a managed file cannot read, and the lists that Claude Code then withholds. Source:
 *  "Invalid values inside `sandbox`" on the managed settings page
 *  (https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox). The rule
 *  applies it to a managed file only. The repair of each field needs Claude Code 2.1.283 or later. */
export const WITHHELD_BY: Readonly<Record<string, readonly string[]>> = {
  'sandbox.network.deniedDomains': ['sandbox.network.allowedDomains'],
  'sandbox.filesystem.denyRead': ['sandbox.filesystem.allowRead', 'sandbox.filesystem.allowWrite'],
  'sandbox.filesystem.denyWrite': ['sandbox.filesystem.allowRead', 'sandbox.filesystem.allowWrite'],
}

/** The characters of an environment variable name. The entry for `sandbox.credentials.envVars`
 *  says that the name starts with a letter or an underscore, and holds letters, digits and
 *  underscores. */
export const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
