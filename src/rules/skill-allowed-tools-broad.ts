// `allowed-tools` in a skill grants a tool with no workspace trust. A bare
// `Bash`, or a rule for a whole MCP server, grants every use of it
// (docs/rules/skill-allowed-tools-broad.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { MCP_PREFIX } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { skillEntries } from '../permission-entries.ts'
import { SKILL_TARGET } from '../permission-listener.ts'
import type { ParsedRule } from '../permission-rule.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-allowed-tools-broad' as const

type Options = [{ allow: string[] }]

/** The tools whose bare name grants every use of the tool. */
const BARE_BROAD = ['Bash', 'PowerShell', 'Write', 'Edit', 'WebFetch']

/** The tools whose `(*)` form is the same as the bare name. The permissions
 *  page says so for Bash and PowerShell. */
const STAR_BROAD = ['Bash', 'PowerShell']

/** `mcp__<server>__*` and `mcp__<server>`. The permissions page says that
 *  each matches every tool of the server. A glob after the tool prefix, such
 *  as `mcp__<server>__get_*`, matches some tools. `mcp__*` is no grant.
 *  Claude Code skips it in an allow rule, and `permissions-tool-name-glob`
 *  reports it (the "Tool name wildcards" section of the permissions page). */
const MCP_SERVER_GRANT = /^mcp__(?:(?!__)[^*])+(?:__\*)?$/

/** True when `rule` grants every use of a tool, or every tool of an MCP
 *  server. */
function isBroad({ tool, specifier }: ParsedRule): boolean {
  if (tool.startsWith(MCP_PREFIX)) {
    return specifier === null && MCP_SERVER_GRANT.test(tool)
  }
  return specifier === null
    ? BARE_BROAD.includes(tool)
    : specifier === '*' && STAR_BROAD.includes(tool)
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'broad' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not give a skill an unscoped tool grant in allowed-tools',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      broad:
        '`{{rule}}` grants every use of a tool or of an MCP server, and Claude Code applies it with no workspace trust. Scope the rule to the commands or paths that the skill needs.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    const [{ allow }] = context.options
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const { list, loc, result } of skillEntries(fm, node.value)) {
          if (list !== 'allow' || !result.ok || !isBroad(result)) {
            continue
          }
          const text =
            result.specifier === null ? result.tool : `${result.tool}(${result.specifier})`
          if (!allow.includes(text)) {
            context.report({ loc, messageId: 'broad', data: { rule: text } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: SKILL_TARGET.files,
  rule,
}
