// Claude Code warns at startup when the names and descriptions of the subagents, except the
// built-in ones, are over 15,000 tokens (docs/rules/agent-descriptions-budget.md). The docs give
// no characters per token, so the rule is a heuristic. It sums the agents of one scope, a
// `.claude/` directory or a plugin root, and reads no file out of the repository.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyLinted } from '../agent-files.ts'
import { scopeAgentFiles } from '../agent-project.ts'
import { BUILT_IN_AGENTS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { stringField } from '../frontmatter.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { frontmatterOfFile, UNREADABLE } from '../skill-tree.ts'

const name = 'agent-descriptions-budget' as const

// The documented limit, and the default of `maxTokens`.
const TOKEN_LIMIT = 15000

// The estimate of characters for each token, and the default of `charsPerToken`. The docs give none.
const CHARS_PER_TOKEN = 4

type Options = [{ maxTokens: number; charsPerToken: number }]

/** The characters that one agent file adds: its name plus its description. The result is null for
 *  a file that adds none: a built-in name, which has no file in the count, and a local file that
 *  Claude Code skips for no name or no description. A plugin agent with no name takes the name
 *  of its file. */
function addedChars(
  fields: Record<string, unknown> | null,
  plugin: boolean,
  file: string,
): number | null {
  const given = fields === null ? '' : stringField(fields, 'name').trim()
  const description = fields === null ? '' : stringField(fields, 'description')
  const label = given === '' && plugin ? path.basename(file, '.md') : given
  if (
    label === '' ||
    (BUILT_IN_AGENTS as readonly string[]).includes(label) ||
    (!plugin && description.trim() === '')
  ) {
    return null
  }
  return label.length + description.length
}

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'overDefault' | 'overConfigured'
}> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Keep the names and descriptions of the subagents of one scope within the token limit',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxTokens: { type: 'integer', minimum: 1 },
          charsPerToken: { type: 'number', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ maxTokens: TOKEN_LIMIT, charsPerToken: CHARS_PER_TOKEN }],
    messages: {
      overDefault:
        'The agents of this scope list about {{tokens}} tokens of names and descriptions ({{total}} characters at {{perToken}} characters per token), and this file adds {{own}} characters. The documented limit is {{max}} tokens. Claude Code shows a startup warning above it, and still loads every agent. The rule estimates the tokens.',
      overConfigured:
        'The agents of this scope list about {{tokens}} tokens of names and descriptions ({{total}} characters at {{perToken}} characters per token), and this file adds {{own}} characters. The configured limit is {{max}} tokens.',
    },
  },
  create(context) {
    const scope = classifyLinted(context)
    if (scope === null) {
      return {}
    }
    const [{ maxTokens, charsPerToken }] = context.options
    const self = path.resolve(context.filename)
    const { sourceCode } = context
    return {
      root(node) {
        const first = node.children[0]
        // The text of this file is the text in the editor, not the text on disk.
        const memory =
          first?.type === 'yaml' ? (readFrontmatter(sourceCode, first)?.data ?? null) : null
        const own = addedChars(memory, scope.plugin, self)
        if (own === null) {
          return
        }
        const files = scopeAgentFiles(scope)
        if (files === UNREADABLE) {
          return
        }
        let total = own
        for (const file of files) {
          if (file === self) {
            continue
          }
          const fields = frontmatterOfFile(file)
          // A file that the rule cannot read gives no sum to report.
          if (fields === UNREADABLE) {
            return
          }
          total += addedChars(fields, scope.plugin, file) ?? 0
        }
        const tokens = Math.ceil(total / charsPerToken)
        if (tokens > maxTokens) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
            messageId: maxTokens === TOKEN_LIMIT ? 'overDefault' : 'overConfigured',
            data: {
              tokens: String(tokens),
              total: String(total),
              perToken: String(charsPerToken),
              own: String(own),
              max: String(maxTokens),
            },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/*.md'], rule }
