// A version range does not match a pre-release version such as `2.0.0-beta.1` unless it opts in
// with a pre-release suffix such as `^2.0.0-0` (docs/rules/plugin-dependencies-prerelease-range.md).
// The rule reports the `version` range of a dependency object when a `-0` suffix on the versions of
// the range that have the major, minor and patch of the target would make the range match it.
// The target is the pre-release version of the dependency in its own `plugin.json`, or else in
// its entry in the `marketplace.json` that encloses the plugin, as the loading reference gives
// the order. Claude Code resolves a git source by tag, so the rule is a heuristic over the files.
// It makes no report when it cannot see the plugin, the marketplace or the manifest of the source.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { enclosingMarketplace, entriesIn } from '../marketplace-file.ts'
import { lastMember } from '../marketplace-json.ts'
import { marketplaceRootOf } from '../plugin-links.ts'
import { readPlugin } from '../plugin-manifest.ts'
import { isInside, missingOf, readManifest, realOf, UNREADABLE } from '../skill-tree.ts'
import { dependencyOf } from './plugin-dependencies-resolve.ts'
import { SEMVER } from './plugin-manifest-version-semver.ts'

const name = 'plugin-dependencies-prerelease-range' as const

type Triple = readonly [number, number, number]

/** A comparator of a range. The upper bound of a partial version has the suffix `-0` in
 *  `node-semver`. The rule needs no field for it: only a comparator with the numbers of the
 *  target counts, and `holds` reads that one as if it had the suffix. */
interface Comparator {
  readonly op: '>=' | '>' | '<' | '<='
  readonly version: Triple
}

// An optional operator and a version with one to three numbers. A range with an x, a `v`, a
// pre-release or a build, or any other form, does not match, and the rule makes no report.
const TOKEN = /^(\^|~>?|>=|<=|>|<|=)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/

/** The comparators of one token of a range, as `node-semver` reads it. The upper bound of a
 *  partial version has the suffix `-0`. */
function comparatorsOf(token: string): Comparator[] | undefined {
  const found = TOKEN.exec(token)
  if (found === null) {
    return undefined
  }
  const [, op = '', major, minor, patch] = found as unknown as [
    string,
    string | undefined,
    string,
    string | undefined,
    string | undefined,
  ]
  const [M, m, p] = [
    Number(major),
    minor === undefined ? undefined : Number(minor),
    patch === undefined ? undefined : Number(patch),
  ]
  const floor: Triple = [M, m ?? 0, p ?? 0]
  // The first version above every version that starts with the given parts.
  const next: Triple = m === undefined ? [M + 1, 0, 0] : [M, m + 1, 0]
  const lower = (version: Triple): Comparator => ({ op: '>=', version })
  const below = (version: Triple): Comparator => ({ op: '<', version })
  const full = p !== undefined
  switch (op) {
    case '>=':
      return [lower(floor)]
    case '>':
      return [full ? { op: '>', version: floor } : lower(next)]
    case '<':
      return [below(floor)]
    case '<=':
      return [full ? { op: '<=', version: floor } : below(next)]
    case '~':
    case '~>':
      return [lower(floor), below(m === undefined ? next : [M, m + 1, 0])]
    case '^': {
      // `^0.0.3` allows the patch only, and `^0.2` the minor. Every other caret range allows the
      // major.
      let upper: Triple = [M + 1, 0, 0]
      if (M === 0 && m !== undefined && (p === undefined || m > 0)) {
        upper = [0, m + 1, 0]
      } else if (M === 0 && m === 0 && p !== undefined) {
        upper = [0, 0, p + 1]
      }
      return [lower(floor), below(upper)]
    }
    default:
      return full ? [lower(floor), { op: '<=', version: floor }] : [lower(floor), below(next)]
  }
}

/** The alternatives of a range, each a list of comparators. The result is undefined when a token
 *  is not in the form above, and for the empty range. */
function setsOf(range: string): Comparator[][] | undefined {
  const sets = range.split('||').map((part) => part.split(/\s+/).filter(Boolean))
  const parsed = sets.map((tokens) => tokens.map(comparatorsOf))
  return sets.some((tokens) => tokens.length === 0) || parsed.some((set) => set.includes(undefined))
    ? undefined
    : parsed.map((set) => set.flatMap((comparators) => comparators as Comparator[]))
}

/** The numbers of the version `text`, when it is a semantic version with a pre-release part. */
function prereleaseOf(text: string): { version: Triple; zero: boolean } | undefined {
  if (!SEMVER.test(text)) {
    return undefined
  }
  const bare = text.split('+')[0] as string
  const dash = bare.indexOf('-')
  if (dash < 0) {
    return undefined
  }
  const [M, m, p] = bare.slice(0, dash).split('.').map(Number) as [number, number, number]
  return { version: [M, m, p], zero: bare.slice(dash + 1) === '0' }
}

const sameTriple = (a: Triple, b: Triple) => a.every((n, i) => n === b[i])

/** True when `comparator` holds for the target. The target has the numbers `target.version`. It is
 *  above that pre-release `-0` only when its own pre-release is not exactly `0`. A comparator with
 *  the numbers of the target must have the suffix. */
function holds(comparator: Comparator, target: { version: Triple; zero: boolean }): boolean {
  const { version, op } = comparator
  let order = 0
  for (const [i, n] of target.version.entries()) {
    if (order === 0) {
      order = n - (version[i] as number)
    }
  }
  if (order === 0) {
    // The same numbers. `needsSuffix` gives the suffix `-0` to each such comparator, and `-0` is
    // the lowest pre-release.
    order = target.zero ? 0 : 1
  }
  return op === '>=' ? order >= 0 : op === '>' ? order > 0 : op === '<' ? order < 0 : order <= 0
}

/** True when the range opts in for the target after a `-0` suffix on each version of the range
 *  that has the numbers of the target. The suffix must be useful: some set needs a version with
 *  those numbers, and all its comparators must hold. */
function needsSuffix(range: string, target: { version: Triple; zero: boolean }): boolean {
  return (setsOf(range) ?? []).some(
    (set) =>
      set.some((c) => sameTriple(c.version, target.version)) && set.every((c) => holds(c, target)),
  )
}

const rule: JSONRuleDefinition<{ MessageIds: 'prerelease' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Give a dependency range a pre-release suffix when it must match a pre-release',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      prerelease:
        'The range "{{range}}" of the dependency "{{name}}" does not match its pre-release version "{{target}}". A range matches a pre-release only with a pre-release suffix, such as `^2.0.0-0`.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        const dependencies = lastMember(node.body, 'dependencies')?.value
        const marketplace = plugin === undefined ? undefined : enclosingMarketplace(plugin)
        const entries = marketplace === undefined ? undefined : entriesIn(marketplace)
        const named = lastMember(node.body, 'name')?.value
        const root = plugin === undefined ? undefined : marketplaceRootOf(plugin)
        // The rule links a plugin to its marketplace by name, as `plugin-dependencies-resolve` does.
        if (
          plugin === undefined ||
          dependencies?.type !== 'Array' ||
          marketplace === undefined ||
          entries === undefined ||
          root === undefined ||
          named?.type !== 'String' ||
          !entries.some((entry) => entry.name === named.value)
        ) {
          return
        }
        for (const { value } of dependencies.elements) {
          const dependency = dependencyOf(value)
          const range = lastMember(value, 'version')?.value
          if (
            dependency === undefined ||
            range?.type !== 'String' ||
            (dependency.marketplace !== undefined && dependency.marketplace !== marketplace.name)
          ) {
            continue
          }
          const [entry, second] = entries.filter((other) => other.name === dependency.name)
          // With two entries of one name, the rule cannot tell which one counts.
          if (entry === undefined || second !== undefined) {
            continue
          }
          let text = typeof entry.version === 'string' ? entry.version : undefined
          const source = entry.source
          // A path that is `.` or a bare name under `pluginRoot` has a manifest that this rule does
          // not read. The entry `version` would then be the wrong target, so the rule is silent.
          if (typeof source === 'string' && !source.startsWith('./')) {
            continue
          }
          if (typeof source === 'string') {
            const dir = path.resolve(root, source)
            const real = realOf(dir)
            // A source folder that is not there has no manifest, and the entry gives the version. A
            // link with no target, or a path out of the repository, hides the folder.
            const seen =
              real === null
                ? missingOf(dir, plugin.bound) === null
                : typeof real === 'string' && isInside(real, plugin.bound)
            const manifest =
              typeof real === 'string' && seen ? readManifest(real, plugin.bound) : null
            if (!seen || manifest === UNREADABLE) {
              continue
            }
            text = typeof manifest?.version === 'string' ? manifest.version : text
          }
          const target = text === undefined ? undefined : prereleaseOf(text)
          if (target !== undefined && needsSuffix(range.value, target)) {
            context.report({
              node: range,
              messageId: 'prerelease',
              data: { range: range.value, name: dependency.name, target: text },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
