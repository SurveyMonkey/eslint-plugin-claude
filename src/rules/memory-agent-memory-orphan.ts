// A `.claude/agent-memory/<name>/` folder that no subagent owns
// (docs/rules/memory-agent-memory-orphan.md). A subagent with `memory: project` keeps its notes
// there. The rule scans the repository for a project or plugin subagent with that `name` and
// `memory: project`. A user subagent is out of the repository, and ADR 001, Decision 14 forbids
// a read there. So the option `allow` lists the names of such agents. The rule makes no report
// when it cannot read a part of the repository, because the missing part may hold the agent.
// A subagent file with no usable frontmatter has no name, and does not own a folder.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { gitTop } from '../memory-imports.ts'
import { frontmatterOfFile, markdownFiles, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'memory-agent-memory-orphan' as const

type Options = [{ allow?: string[] }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'orphan' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep agent memory only for a subagent that sets memory: project',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      orphan:
        'No project or plugin subagent in the repository has the name `{{agent}}` and sets `memory: project`. A user subagent can own this folder. List its name in the option `allow`, or delete the folder.',
    },
  },
  create(context) {
    const [{ allow = [] }] = context.options
    const folder = path.dirname(path.resolve(context.filename))
    const agent = path.basename(folder)
    const top = gitTop(folder)
    // Memory out of a repository belongs to the user, and the rule reads nothing there.
    if (top === null || allow.includes(agent)) {
      return {}
    }
    return {
      root() {
        const scan = markdownFiles(top, repositoryRoot(top))
        let unreadable = scan.unreadable || scan.outside
        for (const file of scan.files) {
          if (classifyAgentFile(file) === null) {
            continue
          }
          const fields = frontmatterOfFile(file)
          if (fields === UNREADABLE) {
            unreadable = true
          } else if (fields?.name === agent && fields.memory === 'project') {
            return
          }
        }
        if (!unreadable) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            messageId: 'orphan',
            data: { agent },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/agent-memory/*/MEMORY.md'],
  rule,
}
