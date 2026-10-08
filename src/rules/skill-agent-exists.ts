// The `agent` field of a skill or command file must name an agent that Claude
// Code can find (docs/rules/skill-agent-exists.md).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  readManifest,
  realDirectory,
  repositoryRoot,
  scopeRoot,
  UNREADABLE,
} from '../skill-tree.ts'

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

/** The agent names that a scan found. `unseen` is true when the scan did not
 *  follow a link out of the repository. It is also true when the scan could
 *  not read a path. An agent can then be out of sight. */
interface Agents {
  names: string[]
  unseen: boolean
}

/** `dir` and each directory above it, up to `top`. The walk goes up the path as given, as
 *  `repositoryRoot` does. `top` is a real path, so the walk compares the real path of each
 *  directory with it. A project directory that is a link then does not hide `top`. */
function ancestors(dir: string, top: string): string[] {
  const parent = path.dirname(dir)
  return realDirectory(dir) === top || parent === dir ? [dir] : [dir, ...ancestors(parent, top)]
}

/** The `name` of each agent file in `.claude/agents/` of `start`, and of each
 *  directory above it up to `top`. The scans read no file out of `bound`. The
 *  two differ with no `.git`, where `bound` is `.claude/` and `top` is the
 *  directory that holds it. They also differ for a `.claude` link whose target
 *  holds its own `.git`. */
function projectAgents(start: string, top: string, bound: string): Agents {
  const found: Agents = { names: [], unseen: false }
  for (const dir of ancestors(start, top)) {
    const scan = markdownFiles(path.join(dir, '.claude', 'agents'), bound)
    found.unseen ||= scan.outside || scan.unreadable
    for (const file of scan.files) {
      const fields = frontmatterOfFile(file)
      found.unseen ||= fields === UNREADABLE
      const agent = fields === UNREADABLE ? undefined : fields?.name
      if (typeof agent === 'string') {
        found.names.push(agent)
      }
    }
  }
  return found
}

/** The names that a skill in the plugin at `root` can use for each agent of
 *  the plugin. These are the scoped name and, to avoid a false report, the
 *  bare name, which the docs do not confirm. */
function pluginAgents(root: string, plugin: string, bound: string): Agents {
  const agentsDir = path.join(root, 'agents')
  const scan = markdownFiles(agentsDir, bound)
  let unseen = scan.outside || scan.unreadable
  const names = scan.files.flatMap((file) => {
    const fields = frontmatterOfFile(file)
    unseen ||= fields === UNREADABLE
    const given = fields === UNREADABLE ? undefined : fields?.name
    const own = typeof given === 'string' ? given : path.basename(file, '.md')
    const folders = path.relative(agentsDir, path.dirname(file)).split(path.sep).filter(Boolean)
    return [own, [plugin, ...folders, own].join(':')]
  })
  return { names, unseen }
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
    // The rule reads no file out of the repository that holds the scope. The walk starts at the
    // scope root, as it does for the agent rules.
    const bound = repositoryRoot(root)
    // The directories above `.claude/` end at the repository that holds the project.
    const top = repositoryRoot(path.dirname(root))
    // A project `.claude/` has no manifest. Only a plugin root has one.
    const manifest = file.plugin ? readManifest(root, bound) : null
    // The `agents` key replaces the scan of `agents/`, and the rule cannot read it.
    // A manifest that the rule cannot see can hold the key, so the rule makes no report. A
    // manifest that the rule cannot read, or that is out of the repository, is such a manifest.
    if (manifest === UNREADABLE || (manifest !== null && 'agents' in manifest)) {
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
        const agents =
          plugin === null
            ? projectAgents(path.resolve(path.dirname(root)), top, bound)
            : pluginAgents(root, plugin, bound)
        // A link out of the repository, or a path that the rule cannot read,
        // can hold the agent, so the rule cannot prove that it is missing.
        if (!agents.unseen && !agents.names.some(same)) {
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
