// An MCP bundle in the `mcpServers` of a plugin under `.claude/skills/`, and an MCP path that
// leaves the plugin directory (docs/rules/mcp-project-plugin-bundle.md). A plugin in the skills
// directory of a project is checked into the repository. Claude Code skips each MCP server that
// such a plugin declares as an MCP bundle, a `.mcpb` or `.dxt` file. It also skips a path that
// resolves out of the plugin directory. `claude plugin validate` reports a path with `..`. It does
// not report an absolute path or a link that leads out, so this rule does. The rule reads the
// text of an absolute path. For a relative path, it reads the real path of the link, and only in
// the repository (ADR 001, Decision 14). A target out of the repository is not followed.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { realSource } from '../marketplace-source.ts'
import { declaredMcpStrings } from '../mcp-servers.ts'
import { isInside, realOf, repositoryRoot } from '../skill-tree.ts'
import { pathFault } from './marketplace-relative-source-format.ts'

const name = 'mcp-project-plugin-bundle' as const

const BUNDLE_EXTENSIONS = ['.mcpb', '.dxt']

// A URL has a scheme and two slashes. A drive letter has one letter, and `pathFault` reads it first.
const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//

/** The path part of a bundle URL, or `declared` itself when it is not a URL. A query or a
 *  fragment does not count as part of the file name. */
function pathOf(declared: string): string {
  try {
    return new URL(declared).pathname
  } catch {
    return declared
  }
}

const rule: JSONRuleDefinition<{ MessageIds: 'skipped' | 'outside' | 'escapes' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Declare the MCP servers of a project plugin inline or in a .mcp.json',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      skipped:
        'Claude Code skips the MCP bundle "{{bundle}}" in a plugin under .claude/skills/. Declare the server inline, or in a .mcp.json inside the plugin directory.',
      outside:
        'The MCP path "{{path}}" is an absolute path out of the plugin directory. Claude Code does not load it. Write a path from the plugin root.',
      escapes:
        'The MCP path "{{path}}" leads out of the plugin directory through a link. Claude Code does not load it. Keep the target of the link inside the plugin.',
    },
  },
  create(context) {
    // The plugin root is the directory that holds `.claude-plugin/`.
    const root = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        const declaredStrings = declaredMcpStrings(node.body)
        if (declaredStrings.length === 0) {
          return
        }
        const realRoot = realOf(root)
        const bound = repositoryRoot(root)
        for (const declared of declaredStrings) {
          const text = declared.value
          if (BUNDLE_EXTENSIONS.some((extension) => pathOf(text).endsWith(extension))) {
            context.report({ node: declared, messageId: 'skipped', data: { bundle: text } })
            continue
          }
          const fault = pathFault(text)
          if (fault === 'absolute' || fault === 'network') {
            // An absolute path that points into the plugin directory loads.
            if (!isInside(path.resolve(text), root)) {
              context.report({ node: declared, messageId: 'outside', data: { path: text } })
            }
            continue
          }
          // A path with `..` is for `claude plugin validate`. A URL is no file.
          if (fault === 'parent' || URL_SCHEME.test(text)) {
            continue
          }
          // The rule makes no report for a part that it cannot see, such as a link out of the
          // repository, a dangling link or a path that is not there.
          if (typeof realRoot !== 'string' || !isInside(realRoot, bound)) {
            continue
          }
          const real = realSource(root, realRoot, bound, path.resolve(root, text))
          if (typeof real === 'string' && !isInside(real, realRoot)) {
            context.report({ node: declared, messageId: 'escapes', data: { path: text } })
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
