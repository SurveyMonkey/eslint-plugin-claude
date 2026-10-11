// A `CLAUDE.md` or `.claude/rules/` symlink that leads to a network path
// (docs/rules/memory-symlink-network-target.md). Claude Code does not follow such a link. A
// lookup of the path can contact the host that it names. The rule reads the text of the link
// only. It never follows the link, as `realpath` and `stat` would, so it contacts no host.
import { lstatSync, readlinkSync } from 'node:fs'
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'memory-symlink-network-target' as const

// A UNC share: two backslashes and a host. The hosts `\\wsl$` and `\\wsl.localhost` lead to a
// Linux distribution on the same machine. The docs say that `\\wsl$` paths are not network
// paths. A long path (`\\?\C:\`) and a device path (`\\.\pipe\`) are local. A long UNC path
// (`\\?\UNC\server\share`) is a share.
const UNC = /^\\\\(?:\?\\UNC\\|(?![?.]\\)(?!wsl\$(?:\\|$))(?!wsl\.localhost(?:\\|$)))/i
// A path under `/net` or `/Network`, or the folder itself.
const MOUNT = /^\/(?:net|Network)(?:\/|$)/

/** True when `target`, the text of a link, is a network path. */
function isNetworkTarget(target: string): boolean {
  return UNC.test(target) || MOUNT.test(target)
}

/** The text of the link at `entry`, or null when `entry` is no link or cannot be read. */
function targetOf(entry: string): string | null {
  try {
    return lstatSync(entry).isSymbolicLink() ? readlinkSync(entry) : null
  } catch {
    return null
  }
}

/** The paths of a rule file that can be a link. They are the `.claude/rules`
 *  folder, each folder below it, and the file. They come from the top down. A look at a path
 *  below a link to the network would follow the link. The classifier gives the
 *  kind `rule` only for a path with a `.claude/rules` folder. */
function ruleEntries(file: string): string[] {
  const parts = file.split(path.sep)
  const start = parts.findIndex((part, i) => part === '.claude' && parts[i + 1] === 'rules') + 1
  return parts.slice(start).map((_, i) => parts.slice(0, start + i + 1).join(path.sep))
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'network' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not link a CLAUDE.md or a rule to a network path',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      network:
        '`{{link}}` is a link to the network path `{{target}}`. Claude Code does not follow it, so the instructions do not load. Copy the files into the repository, or link to a local path.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'rule') {
      return {}
    }
    const file = path.resolve(context.filename)
    return {
      root() {
        for (const entry of kind === 'claude-md' ? [file] : ruleEntries(file)) {
          const target = targetOf(entry)
          if (target !== null && isNetworkTarget(target)) {
            context.report({
              loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
              messageId: 'network',
              data: {
                link: path.relative(context.cwd, entry).split(path.sep).join('/'),
                target,
              },
            })
            // A look at a path below this link would follow it.
            return
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md', '**/.claude/rules/**/*.md'],
  rule,
}
