// The manifest key `skills` adds to the default `skills/` scan, so an entry that names `skills/`
// adds nothing (docs/rules/plugin-skills-key-redundant-default.md). The rule reads the spelling of
// each entry. It makes no report when it cannot see the plugin.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { pathNodes, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-skills-key-redundant-default' as const

const rule: JSONRuleDefinition<{ MessageIds: 'redundant' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not list the default skills directory in the skills key of a plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      redundant:
        'The `skills` entry "{{entry}}" names the default `skills/` directory. The `skills` key adds to the default scan, so Claude Code scans that directory without this entry.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        const standard = path.join(plugin.root, 'skills')
        for (const entry of pathNodes(lastMember(node.body, 'skills')?.value)) {
          if (path.resolve(plugin.root, entry.value) === standard) {
            context.report({ node: entry, messageId: 'redundant', data: { entry: entry.value } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
