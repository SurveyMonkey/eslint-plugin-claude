// A variable reference in a server entry that Claude Code does not expand
// (docs/rules/mcp-env-var-syntax.md). The MCP page lists two forms: `${VAR}` and
// `${VAR:-default}`. In `command`, `args`, `env`, `url` and `headers`, any other form stays as
// written: `$VAR`, `%VAR%`, and a `${VAR` followed by another operator. The shell of a shell
// command reads its own arguments, so the rule skips the `args` of such a command. That list is
// a choice of the plugin, not a list of the docs. `${user_config.KEY}` and `${CLAUDE_PLUGIN_ROOT}`
// have no operator, so the rule leaves them. A `%XX%` with two hex digits is part of a
// percent-encoded text, so the rule leaves it too. `mcp-env-expansion-field` owns the fields
// where Claude Code expands nothing.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { lastMembers, lintedServers } from '../mcp-servers.ts'

const name = 'mcp-env-var-syntax' as const

type StringNode = Extract<ValueNode, { type: 'String' }>

/** The program names of a shell. A shell expands `$VAR`, and `cmd` expands `%VAR%`, in its own
 *  arguments. */
const SHELLS = ['sh', 'bash', 'zsh', 'dash', 'fish', 'ksh', 'cmd', 'powershell', 'pwsh']

// A variable form that Claude Code does not expand. `$NAME` is not `$$NAME`. `${NAME` with an
// operator other than `:-` is the other kind. `%NAME%` is the Windows kind, and a name of two hex
// digits is a percent-encoded byte.
const FORMS = [
  /(?<!\$)\$[A-Za-z_][A-Za-z0-9_]*/,
  /\$\{[A-Za-z_][A-Za-z0-9_]*(?:-|:=|=|:\?|\?|:\+|\+)[^}]*\}?/,
  /%(?![0-9A-Fa-f]{2}%)[A-Za-z_][A-Za-z0-9_]*%/,
]

/** The first text in `text` that has a form that Claude Code does not expand. */
const faultIn = (text: string) => FORMS.map((form) => form.exec(text)?.[0]).find(Boolean)

/** True when `command` runs a shell, with or without a directory or `.exe`. */
function isShell(command: ValueNode | undefined): boolean {
  if (command?.type !== 'String') {
    return false
  }
  const program = path.basename(command.value.replaceAll('\\', '/')).replace(/\.exe$/i, '')
  return SHELLS.includes(program)
}

/** The string nodes that Claude Code expands in the server entry `entry`, each with its field. */
function expanded(entry: ValueNode): { node: StringNode; field: string }[] {
  const out: { node: StringNode; field: string }[] = []
  const command = lastMember(entry, 'command')?.value
  const url = lastMember(entry, 'url')?.value
  for (const [field, node] of [
    ['command', command],
    ['url', url],
  ] as const) {
    if (node?.type === 'String') {
      out.push({ node, field })
    }
  }
  const args = lastMember(entry, 'args')?.value
  if (args?.type === 'Array' && !isShell(command)) {
    for (const { value } of args.elements) {
      if (value.type === 'String') {
        out.push({ node: value, field: 'args' })
      }
    }
  }
  for (const field of ['env', 'headers']) {
    const map = lastMember(entry, field)?.value
    if (map?.type === 'Object') {
      for (const member of lastMembers(map.members)) {
        if (member.value.type === 'String') {
          out.push({ node: member.value, field })
        }
      }
    }
  }
  return out
}

const rule: JSONRuleDefinition<{ MessageIds: 'syntax' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: `Write an MCP variable reference as \${VAR} or \${VAR:-default}`,
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      syntax: `The \`{{field}}\` of the server "{{server}}" holds \`{{form}}\`. Claude Code expands \`\${VAR}\` and \`\${VAR:-default}\` only, so this text stays as written. Write one of those forms.`,
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          for (const { node: text, field } of expanded(server.member.value)) {
            const form = faultIn(text.value)
            if (form !== undefined) {
              context.report({
                node: server.pinned ?? text,
                messageId: 'syntax',
                data: { field, server: server.name, form },
              })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
  rule,
}
