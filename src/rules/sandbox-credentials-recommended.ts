// The default read policy of the sandbox lets commands read credential files, and Claude Code
// protects only the entries that a source lists (docs/rules/sandbox-credentials-recommended.md).
// The managed settings advice is to add entries for `~/.aws` and `~/.ssh`
// (https://code.claude.com/docs/en/sandboxing#enforce-sandboxing-with-managed-settings). A
// `filesystem.denyRead` entry, a `credentials.files` entry (`deny` or `mask`) and a `Read` deny
// rule all count, because Claude Code adds the `Read` deny rules to `denyRead`
// (https://code.claude.com/docs/en/settings-reference#sandbox-filesystem). The rule adds up the
// project pair, or one managed source, and makes no report when it cannot read a file of the
// source. A user file is outside the repository (ADR 001, Decision 14) and can hold the entries,
// which is why the rule is `off` in `recommended`. `sandbox-filesystem-disabled-conflict` and
// `sandbox-weakening-options` own `filesystem.disabled`, so the rule is silent there.
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

/** True when the path `entry` keeps commands from reading `directory`: the directory, a path in
 *  it, or a directory above it that is the home directory or the root. */
function covers(entry: string, directory: string): boolean {
  const path = sandboxPath(entry)
  const segment = directory.slice(directory.lastIndexOf('/') + 1).replace('.', '\\.')
  return (
    ['~', '/', '/root'].includes(path) ||
    /^\/(?:Users|home)\/[^/]+$/.test(path) ||
    new RegExp(`(?:^|/)${segment}(?:/|$)`).test(path)
  )
}

/** The paths that the source keeps unreadable. */
function protectedPaths(objects: readonly SettingsObject[]): string[] {
  const files = objects.flatMap((object) => {
    const list = at(object, ['sandbox', 'credentials', 'files'])
    return Array.isArray(list)
      ? list.flatMap((item) =>
          isObject(item) &&
          typeof item.path === 'string' &&
          ['deny', 'mask'].includes(String(item.mode))
            ? [item.path]
            : [],
        )
      : []
  })
  // A `Read` rule with no specifier denies every file.
  const rules = listRules(objects, 'deny').flatMap((rule) =>
    rule.tool === 'Read' ? [rule.specifier ?? '~'] : [],
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
        // Without filesystem isolation, Claude Code enforces no read entry. With the block on,
        // sandboxed commands lose the home directory already.
        const lifted = objects.some(
          (object) =>
            boolOf(at(object, ['sandbox', 'filesystem', 'disabled']), isManaged, false) === true ||
            at(object, ['permissions', 'blockReadsOutsideWorkingDirectories']) === true,
        )
        const paths = protectedPaths(objects)
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
