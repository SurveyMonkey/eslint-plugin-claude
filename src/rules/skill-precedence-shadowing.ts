// An enterprise skill beats a personal skill, and a personal skill beats a project skill, when
// they share a name (docs/rules/skill-precedence-shadowing.md). The rule cannot see personal or
// enterprise skills. It reports only the names that its options give.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile, type SkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { realDirectory, repositoryRoot, scopeRoot } from '../skill-tree.ts'

const name = 'skill-precedence-shadowing' as const

type Options = [{ personalNames: string[]; enterpriseNames: string[] }]

const names = { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true } as const

/** The names that invoke the file. A skill folder is invoked by its folder name and by its `name`
 *  field. A command file is invoked by its path, with `:` for each folder. */
function invokedBy(file: SkillFile, given: unknown): string[] {
  if (file.kind === 'command') {
    return [file.names.join(':')]
  }
  return [file.names[0] as string, ...(typeof given === 'string' && given !== '' ? [given] : [])]
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'shadowed' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not name a project skill like a personal or enterprise skill',
      url: docsUrl(name),
    },
    // The rule has no list of its own. The lists are the names of skills that it cannot see.
    schema: [
      {
        type: 'object',
        properties: { personalNames: names, enterpriseNames: names },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ personalNames: [], enterpriseNames: [] }],
    messages: {
      shadowed:
        'A {{scope}} skill named `{{name}}` wins over this project {{kind}}. Claude Code runs `/{{name}}` from the {{scope}} skill, so this file never runs. Rename it.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    const [{ personalNames, enterpriseNames }] = context.options
    if (
      file === null ||
      file.plugin ||
      (personalNames.length === 0 && enterpriseNames.length === 0)
    ) {
      return {}
    }
    // Only the `.claude/` folder in the root of the repository is the project folder. The docs
    // name no rule for a nested folder.
    const scope = scopeRoot(context.filename, file)
    if (realDirectory(path.dirname(scope)) !== repositoryRoot(scope)) {
      return {}
    }
    return {
      root(node) {
        const first = node.children[0]
        const fm =
          first?.type === 'yaml' && file.kind === 'skill'
            ? readFrontmatter(context.sourceCode, first)
            : null
        const invoked = invokedBy(file, fm?.data.name)
        // The enterprise skill beats the personal skill, so it names the report first.
        for (const [scopeName, list] of [
          ['enterprise', enterpriseNames],
          ['personal', personalNames],
        ] as const) {
          const hit = invoked.find((candidate) => list.includes(candidate))
          if (hit !== undefined) {
            context.report({
              loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
              messageId: 'shadowed',
              data: {
                scope: scopeName,
                name: hit,
                kind: file.kind === 'skill' ? 'skill' : 'command',
              },
            })
            return
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
  rule,
}
