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

/** `dir` and each directory above it, up to the root of the file system. */
function ancestors(dir: string): string[] {
  const parent = path.dirname(dir)
  return parent === dir ? [dir] : [dir, ...ancestors(parent)]
}

/** The `name` of each agent file in `.claude/agents/` of `start`. The same
 *  for each directory above it, up to the first one that holds `.git`. */
function projectAgents(start: string): string[] {
  const found: string[] = []
  for (const dir of ancestors(start)) {
    for (const file of markdownFiles(path.join(dir, '.claude', 'agents'))) {
      const agent = frontmatterOfFile(file)?.name
      if (typeof agent === 'string') {
        found.push(agent)
      }
    }
    if (existsSync(path.join(dir, '.git'))) {
      break
    }
  }
  return found
}

/** The names that a skill in the plugin at `root` can use for each agent of
 *  the plugin. These are the scoped name and, to avoid a false report, the
 *  bare name, which the docs do not confirm. */
function pluginAgents(root: string, plugin: string): string[] {
  const agentsDir = path.join(root, 'agents')
  return markdownFiles(agentsDir).flatMap((file) => {
    const given = frontmatterOfFile(file)?.name
    const own = typeof given === 'string' ? given : path.basename(file, '.md')
    const folders = path.relative(agentsDir, path.dirname(file)).split(path.sep).filter(Boolean)
    return [own, [plugin, ...folders, own].join(':')]
  })
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'project' | 'plugin' }> = {
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
      project:
        '`{{agent}}` is not a built-in agent, and no file in `.claude/agents/` defines it. A forked skill cannot start it.',
      plugin:
        '`{{agent}}` is not a built-in agent, and no file in `agents/` of this plugin defines it. A forked skill cannot start it.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    if (file === null) {
      return {}
    }
    const [{ allow }] = context.options
    const root = scopeRoot(context.filename, file)
    const manifest = readManifest(root)
    // The `agents` key replaces the scan of `agents/`, and the rule cannot read it.
    if (manifest !== null && 'agents' in manifest) {
      return {}
    }
    // A project has no plugin name, and so no scoped names of its own.
    const plugin = file.plugin
      ? typeof manifest?.name === 'string'
        ? manifest.name
        : path.basename(root)
      : null
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        const agent = fm.data.agent
        if (typeof agent !== 'string' || agent === '') {
          return
        }
        // A scoped name holds `:`, and names the agent of a plugin. A project
        // agent has no `:`. A plugin that the settings enable is out of sight.
        if (agent.includes(':') && (plugin === null || !agent.startsWith(`${plugin}:`))) {
          return
        }
        // The docs do not say if Claude Code compares names with case.
        const same = (other: string) => other.toLowerCase() === agent.toLowerCase()
        if (BUILT_IN.some(same) || allow.some(same)) {
          return
        }
        const files =
          plugin === null ? projectAgents(path.dirname(root)) : pluginAgents(root, plugin)
        if (!files.some(same)) {
          const field = fm.fields.get('agent')
          context.report({
            // A key that is an alias has a value but no field.
            loc: field === undefined ? fm.at(0, 0) : fm.at(field.valueStart, field.valueEnd),
            messageId: plugin === null ? 'project' : 'plugin',
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
  files: ['**/SKILL.md', '**/commands/**/*.md'],
  rule,
}
