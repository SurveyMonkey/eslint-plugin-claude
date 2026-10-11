// A script that starts `claude` with `HTTPS_PROXY`, `HTTP_PROXY` or `NO_PROXY` puts the variable in
// the shell. A background agent does not run in that shell, so the docs say to set the proxy
// variables in the `env` block of settings (docs/rules/sandbox-proxy-env.md):
// https://code.claude.com/docs/en/sandboxing#network-isolation
// https://code.claude.com/docs/en/network-config#set-network-variables-in-settings-not-the-shell
// The rule lints the shared project file with the sandbox on. A script is a string of the `scripts`
// of a tracked `package.json` in the project folder (`src/permission-project.ts`). The rule adds
// up the project pair and makes no report when it cannot read a file or when git cannot answer. A
// user or managed `env` block is not visible, and the network page names those two files, which is
// why the rule is `off` in `recommended`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { projectFacts } from '../permission-project.ts'
import { valueAt } from '../permission-sandbox.ts'
import { at, boolOf, isObject, sandboxOn, sourceOf } from '../permission-source.ts'
import { kindOf } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'sandbox-proxy-env' as const

/** The variables of the corporate proxy entry, in the order of the docs. */
const PROXY_VARS = ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY']
/** An assignment of a proxy variable, bare or after `export`. The docs say that the lower-case
 *  names work too. */
const ASSIGNMENT = /(?:^|[\s;&|(])(https?_proxy|no_proxy)=/gi
const CLAUDE_COMMAND = /(?:^|[\s;&|(])claude(?=[\s;&|)]|$)/

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'env' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Set the proxy variables of a script that starts claude in the settings env block',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      env: 'A script of "package.json" starts `claude` with {{variables}} set in the shell. A background agent does not get a shell variable reliably, because the supervisor inherits the environment of the first shell that starts it. Put {{variables}} in the "env" block of settings, as the docs advise. A user or managed settings file can hold them, and this rule cannot see it.',
    },
  },
  create(context) {
    // The shared file speaks for the project. The local file and the managed files do not.
    if (kindOf(context.filename) !== 'project') {
      return {}
    }
    return {
      Document(node) {
        if (node.body.type !== 'Object') {
          return
        }
        const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
        if (!complete || !sandboxOn(objects, false)) {
          return
        }
        const facts = projectFacts(context.filename)
        if (facts === UNREADABLE) {
          return
        }
        const set = new Set(
          facts.scripts
            .filter((script) => CLAUDE_COMMAND.test(script))
            .flatMap((script) =>
              [...script.matchAll(ASSIGNMENT)].map((match) => (match[1] as string).toUpperCase()),
            ),
        )
        const inEnv = new Set(
          objects.flatMap((object) => {
            const env = at(object, ['env'])
            return isObject(env) ? Object.keys(env).map((key) => key.toUpperCase()) : []
          }),
        )
        const missing = PROXY_VARS.filter((variable) => set.has(variable) && !inEnv.has(variable))
        if (missing.length > 0) {
          // The report is on `enabled` when this file turns the sandbox on, else on the file.
          const own = boolOf(at(objects[0], ['sandbox', 'enabled']), false, true) === true
          const enabled = own ? valueAt(node, ['sandbox', 'enabled']) : undefined
          context.report({
            node: enabled ?? node.body,
            messageId: 'env',
            data: { variables: missing.map((variable) => `\`${variable}\``).join(', ') },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json'],
  rule,
}
