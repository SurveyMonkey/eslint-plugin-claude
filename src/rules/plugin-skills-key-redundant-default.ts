// The manifest key `skills` adds to the default `skills/` scan, so an entry that names `skills/`
// adds nothing (docs/rules/plugin-skills-key-redundant-default.md). The rule reads the spelling of
// each entry. It makes no report when it cannot see the plugin.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { pathNodes, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-skills-key-redundant-default' as const

/** True when a `..` part of `text` goes above the folder where `text` starts. */
function goesAbove(text: string): boolean {
  let depth = 0
  for (const part of text.split(/[\\/]/)) {
    if (part === '..') {
      depth -= 1
    } else if (part !== '' && part !== '.') {
      depth += 1
    }
    if (depth < 0) {
      return true
    }
  }
  return false
}

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
          // A path that is absolute, or that goes above the plugin root at some part, can leave
          // the plugin and come back. Claude Code rejects such a path, so it is not redundant.
          const leaves = path.isAbsolute(entry.value) || goesAbove(entry.value)
          if (!leaves && path.resolve(plugin.root, entry.value) === standard) {
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
