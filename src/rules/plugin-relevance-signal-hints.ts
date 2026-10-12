// Two signals of a `relevance` block have a hint in the docs (docs/rules/plugin-relevance-signal-hints.md).
// Claude Code records one command name for each shell command, so a `cli` entry with white space
// never matches. A `manifestDeps` `file` pattern is matched against a path that is typically
// absolute, so a pattern that starts with `^` never matches. The rule is a heuristic. It reads the
// entries of `marketplace.json` and nothing else.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'

const name = 'plugin-relevance-signal-hints' as const

const rule: JSONRuleDefinition<{ MessageIds: 'cli' | 'file' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Write a relevance cli entry as one command name, and a file pattern with an end anchor',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      cli: 'The `cli` entry "{{entry}}" has white space. Claude Code records one command name for each shell command: the first token after any environment variable assignments and `sudo`. The entry is an exact match, so it never matches. Write the command name only.',
      file: 'The `file` pattern "{{pattern}}" starts with `^`. Claude Code matches it against the path of a manifest file, which is typically absolute, so it never matches. Anchor the pattern at the end, for example `[/\\\\]package\\\\.json$` in JSON.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const entry of pluginEntries(node)) {
          const signals = lastMember(lastMember(entry, 'relevance')?.value, 'signals')?.value
          const cli = lastMember(signals, 'cli')?.value
          for (const { value } of cli?.type === 'Array' ? cli.elements : []) {
            if (value.type === 'String' && /\s/.test(value.value)) {
              context.report({ node: value, messageId: 'cli', data: { entry: value.value } })
            }
          }
          const deps = lastMember(signals, 'manifestDeps')?.value
          for (const { value } of deps?.type === 'Array' ? deps.elements : []) {
            const file = lastMember(value, 'file')?.value
            if (file?.type === 'String' && file.value.startsWith('^')) {
              context.report({ node: file, messageId: 'file', data: { pattern: file.value } })
            }
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
}

export default rule
