// The `agent` field of a skill or command file must name an agent that Claude
// Code can find (docs/rules/skill-agent-exists.md).
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { frontmatterOfFile, markdownFiles, readManifest, scopeRoot } from '../skill-tree.ts'

const name = 'skill-agent-exists' as const

type Options = [{ allow: string[] }]

// The built-in agents of https://code.claude.com/docs/en/sub-agents#built-in-subagents.
const BUILT_IN = [
  'Explore',
  'Plan',
  'general-purpose',
  'claude',
  'statusline-setup',
  'claude-code-guide',
]

/** The `name` of each agent file in `.claude/agents/` of `start` and of each
 *  directory above it, up to the first directory that holds `.git`. */
function projectAgents(start: string): string[] {
  const found: string[] = []
  for (let dir = start; ; dir = path.dirname(dir)) {
    for (const file of markdownFiles(path.join(dir, '.claude', 'agents'))) {
      const agent = frontmatterOfFile(file)?.name
      if (typeof agent === 'string') {
        found.push(agent)
      }
    }
    if (existsSync(path.join(dir, '.git')) || path.dirname(dir) === dir) {
      return found
    }
  }
}

/** The names that a skill in the plugin at `root` can use for each agent of
 *  the plugin: the bare name, and the scoped name. */
function pluginAgents(root: string, plugin: string): string[] {
  const agentsDir = path.join(root, 'agents')
  return markdownFiles(agentsDir).flatMap((file) => {
    const given = frontmatterOfFile(file)?.name
    const own = typeof given === 'string' ? given : path.basename(file, '.md')
    const folders = path.relative(agentsDir, path.dirname(file)).split(path.sep).filter(Boolean)
    return [own, [plugin, ...folders, own].join(':')]
  })
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name an agent that exists in the `agent` field of a skill',
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
      missing:
        '`{{agent}}` is not a built-in agent, and no agent file in {{where}} defines it. A forked skill cannot start it.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    if (file === null) {
      return {}
    }
    const [{ allow }] = context.options
    const root = scopeRoot(context.filename, file)
    const manifest = file.plugin ? readManifest(root) : null
    // The `agents` key replaces the scan of `agents/`, and the rule cannot read it.
    if (manifest !== null && 'agents' in manifest) {
      return {}
    }
    const plugin = typeof manifest?.name === 'string' ? manifest.name : path.basename(root)
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const agent = fm?.data.agent
        const field = fm?.fields.get('agent')
        if (fm === null || field === undefined || typeof agent !== 'string' || agent === '') {
          return
        }
        // A scoped name holds `:`, and names the agent of a plugin. A project
        // agent has no `:`. A plugin that the settings enable is out of sight.
        const scoped = agent.includes(':')
        if (scoped && (!file.plugin || !agent.startsWith(`${plugin}:`))) {
          return
        }
        const known = [
          ...BUILT_IN,
          ...allow,
          ...(file.plugin ? pluginAgents(root, plugin) : projectAgents(path.dirname(root))),
        ]
        if (!known.includes(agent)) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'missing',
            data: { agent, where: file.plugin ? '`agents/` of the plugin' : '`.claude/agents/`' },
          })
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
