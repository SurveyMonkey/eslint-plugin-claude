// A single slash in a `Read`, `Edit` or `Cd` rule anchors at the settings source, not at the file
// system root. A sandbox path that starts with a single slash is absolute, so a project path such
// as `/output` is likely meant to start at the project root
// (docs/rules/permissions-path-anchor.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { ABSOLUTE_ROOTS } from '../data/bash-commands.ts'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { PATH_TOOLS, pathSpecifier } from '../permission-path.ts'
import { stringEntries, valueAt } from '../permission-sandbox.ts'
import { kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-path-anchor' as const

const SANDBOX_LISTS = ['allowWrite', 'denyWrite', 'denyRead', 'allowRead']

/** True when `path` starts with one slash, and not two. */
const hasSingleSlash = (path: string) => path.startsWith('/') && !path.startsWith('//')

/** True when the first segment of the single-slash `path` is a root directory of a file system. */
const isRootPath = (path: string) => ABSOLUTE_ROOTS.includes(path.split('/')[1] as string)

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'singleSlash' | 'sandboxSlash' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Anchor a path rule at the file system root with //, and a project path with ./',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      singleSlash:
        '`{{rule}}` is not an absolute path: a single leading `/` anchors at the settings source. Write `{{fixed}}` for the absolute path.',
      sandboxSlash:
        '"{{path}}" is an absolute path in a sandbox list, and not a path in the project. Write "{{fixed}}" for the project root, or keep the path if you mean the file system root.',
    },
  },
  create(context) {
    const isManaged = kindOf(context.filename) === 'managed'
    return settingsListener(context, (entries, document) => {
      for (const entry of entries) {
        const specifier = pathSpecifier(entry, PATH_TOOLS)?.trimStart()
        if (specifier !== undefined && hasSingleSlash(specifier) && isRootPath(specifier)) {
          context.report({
            loc: entry.loc,
            messageId: 'singleSlash',
            data: {
              rule: `${entry.rule.tool}(${entry.rule.specifier})`,
              fixed: `${entry.rule.tool}(/${specifier.trimEnd()})`,
            },
          })
        }
      }
      // The docs give a single slash no project meaning in a managed file.
      if (isManaged) {
        return
      }
      for (const key of SANDBOX_LISTS) {
        for (const entry of stringEntries(valueAt(document, ['sandbox', 'filesystem', key]))) {
          if (hasSingleSlash(entry.value) && entry.value !== '/' && !isRootPath(entry.value)) {
            context.report({
              node: entry,
              messageId: 'sandboxSlash',
              data: { path: entry.value, fixed: `.${entry.value}` },
            })
          }
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
