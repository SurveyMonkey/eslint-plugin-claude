// A plugin in `.claude/skills/<name>/` of a project loads with limits
// (docs/rules/plugin-project-skills-dir-limits.md). Claude Code loads no
// background monitor from it. It skips an MCP server that comes from a `.mcpb`
// or `.dxt` bundle, or from a file out of the plugin directory. The rule
// reports each such declaration in the manifest.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { ESCAPES, locate, type Plugin, pathNodes, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-project-skills-dir-limits' as const

// An MCP bundle path or URL ends in one of these (manifest reference, "mcpServers").
const BUNDLE = /\.(?:mcpb|dxt)$/

/** The plugin of the manifest at `file` when its root is `.claude/skills/<name>`. */
function skillsPlugin(file: string): Plugin | undefined {
  const root = path.dirname(path.dirname(path.resolve(file)))
  const skills = path.dirname(root)
  const isSkillsPlugin =
    path.basename(skills) === 'skills' && path.basename(path.dirname(skills)) === '.claude'
  return isSkillsPlugin ? readPlugin(file) : undefined
}

const rule: JSONRuleDefinition<{ MessageIds: 'monitors' | 'bundle' | 'outside' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use no monitor, MCP bundle or outside MCP file in a plugin in .claude/skills/',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      monitors:
        'Claude Code does not load background monitors from a plugin in `.claude/skills/`. Move the plugin to a marketplace, or remove the monitors.',
      bundle:
        'Claude Code skips the MCP bundle `{{path}}` in a plugin in `.claude/skills/`. Declare the server inline, or in a `.mcp.json` inside the plugin.',
      outside:
        'Claude Code skips the MCP server file `{{path}}` in a plugin in `.claude/skills/`, because the file is out of the plugin directory. Move the file into the plugin, or declare the servers inline.',
    },
  },
  create(context) {
    const plugin = skillsPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        // A key replaces the default `monitors/monitors.json`, so the default counts without a key.
        const keys = [
          lastMember(node.body, 'monitors'),
          lastMember(lastMember(node.body, 'experimental')?.value, 'monitors'),
        ].filter((member) => member !== undefined)
        for (const member of keys) {
          context.report({ node: member, messageId: 'monitors' })
        }
        if (keys.length === 0 && typeof locate(plugin, './monitors/monitors.json') === 'string') {
          context.report({ node, messageId: 'monitors' })
        }
        for (const entry of pathNodes(lastMember(node.body, 'mcpServers')?.value)) {
          const data = { path: entry.value }
          if (BUNDLE.test(entry.value)) {
            context.report({ node: entry, messageId: 'bundle', data })
          } else if (locate(plugin, entry.value) === ESCAPES) {
            context.report({ node: entry, messageId: 'outside', data })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/skills/*/.claude-plugin/plugin.json'],
  rule,
}
