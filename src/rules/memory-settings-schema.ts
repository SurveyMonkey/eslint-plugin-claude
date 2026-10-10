// The memory keys of a settings file (docs/rules/memory-settings-schema.md). The types and
// values come from the settings reference and the memory page. The keys are
// `autoMemoryEnabled`, `autoMemoryDirectory` and `claudeMdExcludes`. The option
// `instructionFiles` of the built-in plugin that reads `AGENTS.md` is the fourth. The rule
// reads a `null` value as unset, as `settings-removed-key` does. The rule
// `claude-md-excludes-pattern` checks the patterns of `claudeMdExcludes`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'memory-settings-schema' as const

// Claude Code v2.1.285 renamed the built-in plugin and reads an entry under either ID.
const AGENTS_MD_PLUGINS = ['cc-plugin-agents-md@builtin', 'agents-md@builtin']

const INSTRUCTION_FILES = [
  'claude-md-or-agents-md',
  'claude-md-and-agents-md',
  'claude-md',
  'managed-only',
]

/** True for an absolute path on macOS, Linux or Windows, or a path that starts with `~/`. */
const isAbsoluteOrHome = (path: string) => /^(\/|~\/|[A-Za-z]:[\\/]|\\\\)/.test(path)

/** The node of a member of `object` that is not `null`, by key. */
function setMember(object: ValueNode | undefined, key: string): ValueNode | undefined {
  const value = lastMember(object, key)?.value
  return value?.type === 'Null' ? undefined : value
}

const rule: JSONRuleDefinition<{
  RuleOptions: []
  MessageIds: 'wrongType' | 'entryType' | 'directoryForm' | 'instructionFiles'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Give the memory keys of a settings file the types and values that Claude Code reads',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      wrongType: '"{{key}}" must be {{expected}}.',
      entryType: 'Each "claudeMdExcludes" entry must be a string.',
      directoryForm: '"autoMemoryDirectory" must be an absolute path or start with "~/".',
      instructionFiles: '"instructionFiles" must be one of {{allowed}}.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const top = (key: string) => setMember(node.body, key)

        const enabled = top('autoMemoryEnabled')
        if (enabled !== undefined && enabled.type !== 'Boolean') {
          context.report({
            node: enabled,
            messageId: 'wrongType',
            data: { key: 'autoMemoryEnabled', expected: 'a Boolean' },
          })
        }

        const directory = top('autoMemoryDirectory')
        if (directory !== undefined) {
          if (directory.type !== 'String') {
            context.report({
              node: directory,
              messageId: 'wrongType',
              data: { key: 'autoMemoryDirectory', expected: 'a string' },
            })
          } else if (!isAbsoluteOrHome(directory.value)) {
            context.report({ node: directory, messageId: 'directoryForm' })
          }
        }

        const excludes = top('claudeMdExcludes')
        if (excludes !== undefined) {
          if (excludes.type !== 'Array') {
            context.report({
              node: excludes,
              messageId: 'wrongType',
              data: { key: 'claudeMdExcludes', expected: 'an array of strings' },
            })
          } else {
            for (const { value } of excludes.elements) {
              if (value.type !== 'String') {
                context.report({ node: value, messageId: 'entryType' })
              }
            }
          }
        }

        const configs = top('pluginConfigs')
        for (const id of AGENTS_MD_PLUGINS) {
          const files = setMember(setMember(setMember(configs, id), 'options'), 'instructionFiles')
          if (
            files !== undefined &&
            !(files.type === 'String' && INSTRUCTION_FILES.includes(files.value))
          ) {
            context.report({
              node: files,
              messageId: 'instructionFiles',
              data: { allowed: INSTRUCTION_FILES.map((value) => `"${value}"`).join(', ') },
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
