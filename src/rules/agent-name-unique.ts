// Two local agent files under one `.claude/agents/` tree must not share a
// `name` (docs/rules/agent-name-unique.md).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { agentScope } from '../agent-scope.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { frontmatterOfFile, markdownFiles, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'agent-name-unique' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'duplicate' }> = {
  meta: {
    type: 'problem',
    docs: { description: 'Give each local agent its own name', url: docsUrl(name) },
    schema: [],
    messages: {
      duplicate:
        '`{{name}}` is also the name of {{others}}. Claude Code loads only one of them, and the file system read order decides which. Rename one.',
    },
  },
  create(context) {
    const scope = agentScope(context.filename)
    if (scope === null || scope.plugin) {
      return {}
    }
    const self = path.resolve(context.filename)
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('name')
        const own = fm?.data.name
        // A name that is not a string, or is empty, is no name to compare.
        if (fm === null || field === undefined || typeof own !== 'string' || own === '') {
          return
        }
        const agents = path.join(scope.root, 'agents')
        // A scan that is `unreadable` or `outside` has fewer files. That can only hide a
        // duplicate, never add one, so the rule ignores both flags.
        const { files } = markdownFiles(agents, repositoryRoot(scope.root))
        const others = files.filter((file) => {
          if (path.resolve(file) === self) {
            return false
          }
          const fields = frontmatterOfFile(file)
          // A file that the rule cannot read, or that has no name, gives no name to compare.
          return fields !== UNREADABLE && fields?.name === own
        })
        if (others.length > 0) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'duplicate',
            data: {
              name: own,
              others: others
                .map((file) => `\`${path.relative(agents, file).split(path.sep).join('/')}\``)
                .join(', '),
            },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
