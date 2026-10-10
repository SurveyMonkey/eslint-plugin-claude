// A `FileChanged` matcher is split on `|`, and Claude Code registers each segment in the watch list
// as a literal file name (docs/rules/hooks-filechanged-star-matcher.md). A `"*"` segment also matches
// every changed file, but the watch list then holds a file named `*`. An omitted matcher matches every
// watched file and adds nothing to the list. `hooks-matcher-syntax` skips a `*` segment.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-filechanged-star-matcher' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Omit the matcher of a FileChanged hook instead of writing "*"',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      star: 'A "*" matcher on FileChanged also adds a file named "*" to the watch list. Omit the matcher to match every watched file.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        if (event === 'FileChanged' && matcher?.value.split('|').includes('*')) {
          context.report({ loc: matcher.loc, messageId: 'star' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
