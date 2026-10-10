// A command hook runs with the full user permissions, outside the sandbox (docs/rules/hooks-committed-command-review.md).
// The rule asks for a review of each command hook that a repository commits. It is a prompt to review, not a
// fault: a reviewed hook is correct. So the rule is `off` in `recommended`.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, stringOf } from '../hooks-config.ts'
import { kindOf } from '../settings-files.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'hooks-committed-command-review' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Review each command hook that the repository commits',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      committed:
        'This command hook runs with your full user permissions, outside the sandbox. In a "claude -p" or SDK session it runs in a folder that nobody trusted, with no dialog. Review the command.',
      plugin:
        'This plugin command hook runs with your full user permissions, outside the sandbox. Review the command before you publish or install the plugin.',
      agent:
        'This command hook runs with your full user permissions, outside the sandbox, after the user accepts the workspace trust dialog. Review the command.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      // The local file is not committed, and an administrator owns a managed file.
      if (source.kind === 'settings' && kindOf(context.filename) !== 'project') {
        return
      }
      const messageId =
        source.kind === 'agent'
          ? 'agent'
          : source.kind === 'plugin' ||
              (source.kind === 'skill' && classifySkillFile(context.filename)?.plugin)
            ? 'plugin'
            : 'committed'
      for (const { handler } of handlersOf(source)) {
        if (stringOf(handler, 'type') === 'command') {
          context.report({ loc: handler.loc, messageId })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
