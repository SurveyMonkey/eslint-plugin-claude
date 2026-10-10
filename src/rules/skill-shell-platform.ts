// The `shell` key of a skill with injected commands. On some platforms, `shell: bash` fails and
// `shell: powershell` runs the commands in Bash (docs/rules/skill-shell-platform.md). The
// rule is inactive until the option `platforms` lists a platform.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { unfencedLines } from '../markdown-lines.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-shell-platform' as const

/** Where bash is not there: Windows without Git Bash. */
const NO_BASH = 'windows-no-git-bash'

/** Where the PowerShell tool is off until `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`. */
const NO_POWERSHELL = ['macos', 'linux', 'wsl', 'bedrock', 'vertex', 'foundry']

// An inline command placeholder at the start of a line or after whitespace.
const INLINE = /(?<!\S)!`[^`]+`/g

type Options = [{ platforms?: string[] }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'bash' | 'powershell' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set a shell that the target platforms of a skill can run',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          platforms: {
            type: 'array',
            items: { enum: [NO_BASH, ...NO_POWERSHELL] },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      bash: '`shell: bash` fails the invocation on Windows without Git Bash, before any injected command runs. Remove `shell`, or drop `windows-no-git-bash` from the option `platforms`.',
      powershell:
        '`shell: powershell` needs the PowerShell tool. It is off by default on {{platforms}}, and the injected commands then run in Bash. Set `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` there, or drop the platform from the option `platforms`.',
    },
  },
  create(context) {
    const [{ platforms = [] }] = context.options
    const file = classifySkillFile(context.filename)
    const noPowershell = platforms.filter((platform) => NO_POWERSHELL.includes(platform))
    if (file === null || (!platforms.includes(NO_BASH) && noPowershell.length === 0)) {
      return {}
    }
    const { sourceCode } = context
    let block = false
    // The ranges of inline code spans. A `!` inside a span is code text.
    const spans: [number, number][] = []
    return {
      code(node) {
        block ||= node.lang === '!'
      },
      inlineCode(node) {
        spans.push(sourceCode.getRange(node))
      },
      'root:exit'(node) {
        const first = node.children[0]
        // Without frontmatter, the skill has no `shell` key.
        const fm = first?.type === 'yaml' ? readFrontmatter(sourceCode, first) : null
        const field = fm?.fields.get('shell')
        const shell = fm?.data.shell
        if (
          first?.type !== 'yaml' ||
          !fm ||
          !field ||
          (shell !== 'bash' && shell !== 'powershell')
        ) {
          return
        }
        const after = sourceCode.getLoc(first).end.line
        const inline = unfencedLines(sourceCode, after).some(({ text, offset }) =>
          [...text.matchAll(INLINE)].some(
            (match) =>
              !spans.some(
                ([from, to]) => offset + match.index >= from && offset + match.index < to,
              ),
          ),
        )
        if (!block && !inline) {
          return
        }
        if (shell === 'bash' && platforms.includes(NO_BASH)) {
          context.report({ loc: fm.at(field.valueStart, field.valueEnd), messageId: 'bash' })
        }
        if (shell === 'powershell' && noPowershell.length > 0) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'powershell',
            data: { platforms: noPowershell.join(', ') },
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
