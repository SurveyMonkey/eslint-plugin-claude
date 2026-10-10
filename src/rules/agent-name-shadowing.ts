// A project agent in a nested `.claude/agents/` directory replaces an agent of
// the same name in a directory above it, up to the repository root
// (docs/rules/agent-name-shadowing.md). The rule walks up from the linted
// file, so it reports in the nearer file, the one that wins.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  frontmatterOfFile,
  isInside,
  markdownFiles,
  realDirectory,
  repositoryRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'agent-name-shadowing' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'shadows' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not reuse the name of an agent in a .claude/agents directory above',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      shadows:
        '`{{name}}` is also the name of {{others}}. Claude Code uses the definition closest to the working directory, so this agent replaces it in a session that starts in or below this folder. Rename one if that is not your intent.',
    },
  },
  create(context) {
    const scope = classifyAgentFile(context.filename)
    if (scope === null || scope.plugin) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('name')
        const own = fm?.data.name
        // A name that is not a string, or is empty, is no name to compare.
        if (fm === null || field === undefined || typeof own !== 'string' || own === '') {
          return
        }
        const project = path.dirname(scope.root)
        const bound = repositoryRoot(scope.root)
        const others: string[] = []
        // Each folder from the parent of this project folder up to the repository root. The
        // walk ends at the first folder out of the repository, or at the root of the file system.
        for (
          let dir = path.dirname(project);
          dir !== path.dirname(dir) && isInside(realDirectory(dir), bound);
          dir = path.dirname(dir)
        ) {
          // A scan that is `unreadable` or `outside` has fewer files. That can only hide a
          // match, never add one, so the rule ignores both flags.
          const { files } = markdownFiles(path.join(dir, '.claude', 'agents'), bound)
          for (const file of files) {
            const fields = frontmatterOfFile(file)
            // A file that the rule cannot read, or that has no name, gives no name to compare.
            if (fields !== UNREADABLE && fields?.name === own) {
              others.push(path.relative(project, file).split(path.sep).join('/'))
            }
          }
        }
        if (others.length > 0) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'shadows',
            data: { name: own, others: others.map((file) => `\`${file}\``).join(', ') },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
