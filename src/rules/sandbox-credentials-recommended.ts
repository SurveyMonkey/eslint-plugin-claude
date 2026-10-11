// The default read policy of the sandbox lets commands read credential files. Claude Code
// protects only the entries that a source lists (docs/rules/sandbox-credentials-recommended.md).
// The managed settings advice is to add entries for `~/.aws` and `~/.ssh`
// (https://code.claude.com/docs/en/sandboxing#enforce-sandboxing-with-managed-settings).
// These entries count: a `filesystem.denyRead` entry, a `credentials.files` entry, and a `Read`
// deny rule that starts with `~` or `//`. Claude Code adds the `Read` deny rules to `denyRead`
// (https://code.claude.com/docs/en/settings-reference#sandbox-filesystem). A `mask` entry counts
// in a managed file only: Claude Code drops it from the two project files. A `filesystem.disabled`
// value counts in a managed file only, for the same reason. The rule adds up the project pair, or
// one managed source. It makes no report when it cannot read a file of the source. A user file is
// outside the repository (ADR 001, Decision 14) and can hold the entries. For this reason the rule
// is `off` in `recommended`. `sandbox-filesystem-disabled-conflict` and `sandbox-weakening-options`
// own `filesystem.disabled`, so the rule is silent there. The rule does not read `allowRead`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import type { ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { sandboxPath, valueAt } from '../permission-sandbox.ts'
import {
  at,
  boolOf,
  isObject,
  listRules,
  type SettingsObject,
  sandboxOn,
  sourceOf,
  stringsAt,
} from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-credentials-recommended' as const

/** The directories that the docs name. */
const DIRECTORIES = ['~/.aws', '~/.ssh']

/** A home directory, in the forms of the sandbox path prefixes. */
const HOME = `(?:~|/Users/[^/]+|/home/[^/]+|/root)`

/** True when the path `entry` keeps commands from reading `directory`: the directory, a path in
 *  it, or the home directory or the root above it. A path with no prefix, or with `./`, is
 *  relative to the project, so it does not count. */
function covers(entry: string, directory: string): boolean {
  const path = sandboxPath(entry)
  const segment = directory.slice(directory.lastIndexOf('/') + 1).replace('.', '\\.')
  return path === '/' || new RegExp(`^${HOME}(?:/${segment}(?:/|$)|$)`).test(path)
}

/** The paths that the source keeps unreadable. */
function protectedPaths(objects: readonly SettingsObject[], isManaged: boolean): string[] {
  // Claude Code drops a `mask` entry from the two project files.
  const modes = isManaged ? ['deny', 'mask'] : ['deny']
  const files = objects.flatMap((object) => {
    const list = at(object, ['sandbox', 'credentials', 'files'])
    return Array.isArray(list)
      ? list.flatMap((item) =>
          isObject(item) && typeof item.path === 'string' && modes.includes(String(item.mode))
            ? [item.path]
            : [],
        )
      : []
  })
  // A `Read` rule with no specifier denies every file. In a `Read` rule, `/path` is relative to
  // the project, so only `~` and `//` forms name a path outside it.
  const rules = listRules(objects, 'deny').flatMap((rule) =>
    rule.tool === 'Read' && (rule.specifier === null || /^(?:~|\/\/)/.test(rule.specifier))
      ? [rule.specifier ?? '~']
      : [],
  )
  return [...stringsAt(objects, ['sandbox', 'filesystem', 'denyRead']), ...files, ...rules]
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'open' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Deny sandboxed commands the credential directories ~/.aws and ~/.ssh',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      open: 'The sandbox is on, and nothing in this source keeps sandboxed commands from reading {{directories}}. The default read policy still allows credential files. Add "sandbox.credentials" entries with `"mode": "deny"`, or "sandbox.filesystem.denyRead" paths. A user settings file can hold them, and this rule cannot see it.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return {
      Document(node) {
        const enabled = valueAt(node, ['sandbox', 'enabled'])
        const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
        if (
          boolOf(at(objects[0], ['sandbox', 'enabled']), isManaged, true) !== true ||
          !complete ||
          !sandboxOn(objects, isManaged)
        ) {
          return
        }
        // Without filesystem isolation, Claude Code enforces no read entry. It ignores `disabled`
        // in a project file. With the block on, sandboxed commands lose the home directory.
        const lifted = objects.some(
          (object) =>
            (isManaged &&
              boolOf(at(object, ['sandbox', 'filesystem', 'disabled']), true, false) === true) ||
            at(object, ['permissions', 'blockReadsOutsideWorkingDirectories']) === true,
        )
        const paths = protectedPaths(objects, isManaged)
        const open = DIRECTORIES.filter((dir) => !paths.some((entry) => covers(entry, dir)))
        if (!lifted && open.length > 0) {
          context.report({
            node: enabled as ValueNode,
            messageId: 'open',
            data: { directories: open.map((dir) => `\`${dir}\``).join(' and ') },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
