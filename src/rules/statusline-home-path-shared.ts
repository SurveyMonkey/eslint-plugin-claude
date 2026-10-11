// A `statusLine` command in the shared settings file that runs a script in the home `.claude/`
// folder (docs/rules/statusline-home-path-shared.md). The statusline page saves the script of
// the `/statusline` command to `~/.claude/`, a folder of one user. Another reader of the
// repository has no such script. A heuristic, and `off` in `recommended`: a team can put the
// script in every home folder. The rule reads the command text for `~/.claude/` and reads no
// file. The rule reads `.claude/settings.json` only.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'

const name = 'statusline-home-path-shared' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'home' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not point the shared statusLine command at the home .claude folder',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      home: 'The statusLine command points at "~/.claude/", a folder of one user. Each reader of the repository must supply the script. Commit the script in the repository, or set statusLine in your user settings.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const command = lastMember(lastMember(node.body, 'statusLine')?.value, 'command')?.value
        if (command?.type === 'String' && command.value.includes('~/.claude/')) {
          context.report({ node: command, messageId: 'home' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json'],
  rule,
}
