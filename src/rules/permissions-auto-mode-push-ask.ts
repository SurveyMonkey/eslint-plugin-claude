// Auto mode pushes to most branches of the repository without a prompt. An `ask` rule that matches
// `git push` is the human checkpoint (docs/rules/permissions-auto-mode-push-ask.md). A file does
// not show whether a session runs in auto mode, so the rule is a heuristic. It reads managed
// files, where `permissions.defaultMode: "auto"` takes effect. The value has no effect in the two
// project files, and `permissions-default-mode-project-ignored` reports it there. The rule reads
// the managed source and makes no report when it cannot read a file of it, when the source locks
// auto mode off, or when it holds a `PreToolUse` hook, which the docs name as the checkpoint that
// reads the full command.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandPatternMatches, isInputParameterRule } from '../permission-command.ts'
import { valueAt } from '../permission-sandbox.ts'
import {
  at,
  hasPreToolUseHook,
  isAutoModeLocked,
  listRules,
  type SettingsObject,
  sourceOf,
} from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-auto-mode-push-ask' as const

const SHELL_TOOLS = ['Bash', 'PowerShell']

/** A push with arguments. A rule covers a push when it matches this command. The permissions page
 *  gives `Bash(git push *)` for it. */
const PUSH = 'git push origin main'

/** True when an `ask` or `deny` rule of `objects` matches a push. A rule for the tool alone
 *  matches every command. A `deny` rule never runs the push, so it is a checkpoint too. */
function coversPush(objects: readonly SettingsObject[]): boolean {
  return (['ask', 'deny'] as const).some((list) =>
    listRules(objects, list).some(
      ({ tool, specifier }) =>
        SHELL_TOOLS.includes(tool) &&
        (specifier === null ||
          (!isInputParameterRule(list, specifier) && commandPatternMatches(specifier, PUSH))),
    ),
  )
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'noPushAsk' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add an ask rule for git push where a managed file turns on auto mode',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noPushAsk:
        'This managed source sets "defaultMode" to "auto" and holds no "ask" rule for `git push`. In auto mode, Claude pushes to most branches of the repository without a prompt. Add "Bash(git push *)" to "permissions.ask" for a checkpoint. A push that Claude writes another way, such as `git -C <dir> push`, does not match the rule. A PreToolUse hook can inspect the full command.',
    },
  },
  create(context) {
    // The files glob lists managed files only. This guards a config that lints a project file,
    // where `auto` has no effect.
    if (isHiddenDropIn(context.filename) || kindOf(context.filename) !== 'managed') {
      return {}
    }
    return {
      Document(node) {
        const value = valueAt(node, ['permissions', 'defaultMode'])
        if (value?.type !== 'String') {
          return
        }
        const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
        // The files of a managed source merge, and the docs do not say which file wins for a
        // value. A file that sets another mode makes the result unknown.
        const modes = objects.flatMap((object) => {
          const mode = at(object, ['permissions', 'defaultMode'])
          return mode === undefined ? [] : [mode]
        })
        if (
          !complete ||
          modes.some((mode) => mode !== 'auto') ||
          isAutoModeLocked(objects) ||
          hasPreToolUseHook(objects) ||
          coversPush(objects)
        ) {
          return
        }
        context.report({ node: value, messageId: 'noPushAsk' })
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: MANAGED_SETTINGS_FILES,
  rule,
}
