// A settings file that sets `disableAllHooks` to true and also defines `hooks` (docs/rules/hooks-
// disabled-by-disableallhooks.md). Claude Code runs none of those hooks. A file of a higher scope can
// set the key again, so the rule reads the sibling files first. It reads the project file and the local
// file on disk, and the files of the managed source.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import {
  isHiddenDropIn,
  kindOf,
  MANAGED_SETTINGS_FILES,
  readManagedSource,
} from '../settings-files.ts'
import { readJson, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'hooks-disabled-by-disableallhooks' as const

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** True when a file of a higher scope, or a sibling, can set the key again, or the rule cannot
 *  see it. The local file is above the project file. The files of a managed source merge in an
 *  order that the rule does not follow, so a sibling that sets the key settles it. */
function setAgain(filename: string): boolean {
  const kind = kindOf(filename)
  if (kind === 'local') {
    return false
  }
  if (kind === 'managed') {
    const siblings = readManagedSource(filename)
    return siblings === UNREADABLE || siblings.some((fields) => 'disableAllHooks' in fields)
  }
  const dir = path.dirname(path.resolve(filename))
  const local = readJson(path.join(dir, 'settings.local.json'), repositoryRoot(dir))
  if (local === null) {
    return false
  }
  // A local file that cannot be read, or that does not parse to an object, can hold any value.
  if (local === UNREADABLE || !isObject(local.data)) {
    return true
  }
  return local.data.disableAllHooks === false
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'off' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not define hooks in a settings file that sets disableAllHooks to true',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      off: 'Claude Code runs none of the hooks in this file: "disableAllHooks" is true.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden drop-in, so it reads no key there.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const disabled = lastMember(node.body, 'disableAllHooks')?.value
        const hooks = lastMember(node.body, 'hooks')
        if (
          disabled?.type === 'Boolean' &&
          disabled.value &&
          hooks?.value.type === 'Object' &&
          hooks.value.members.length > 0 &&
          !setAgain(context.filename)
        ) {
          context.report({ node: hooks.name, messageId: 'off' })
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
