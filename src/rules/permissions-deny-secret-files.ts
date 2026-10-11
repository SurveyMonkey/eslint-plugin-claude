// A tracked `.env`, `.env.*` file or `secrets/` folder that no `Read` deny rule covers is open to
// Claude (docs/rules/permissions-deny-secret-files.md). The docs example of `permissions.deny`
// names the three. A heuristic. The rule asks the git index (`src/git-state.ts`) for the files that
// the project tracks, so a file that is not tracked or not there gives no report. It reads the
// project directory only: the folder that holds `.claude/`. It makes no report when git cannot
// answer, or when a project file cannot be read. A rule in user or managed settings, and the
// sandbox, are not visible, which is why the rule is `off`.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitChildren, gitTracksBelow } from '../git-state.ts'
import { denyPatternCovers, pathSpecifier } from '../permission-path.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { valueAt } from '../permission-sandbox.ts'
import { sourceOf, stringsAt } from '../permission-source.ts'
import { kindOf } from '../settings-files.ts'
import { realDirectory, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'permissions-deny-secret-files' as const

const ENV_FILE = /^\.env(?:\..+)?$/
/** A file that holds a template and no value: `.env.example` and its usual siblings. The docs name
 *  none of them, so this is the choice of the plugin. */
const PLACEHOLDER = /\.(?:example|sample|template)$/i
const SECRETS = 'secrets/'

/** The rule that covers an item, as the docs example writes it. */
const ADVICE = { env: 'Read(./.env)', envVariant: 'Read(./.env.*)', secrets: 'Read(./secrets/**)' }

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'open' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Deny Read for a tracked .env file or secrets folder in the project settings',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      open: 'No "Read" deny rule in the two project settings files covers {{items}}, which git tracks. Add {{rules}} to "permissions.deny". A rule in user or managed settings is not visible to this rule.',
    },
  },
  create(context) {
    // The shared file speaks for the project. The local file and the managed files do not.
    if (kindOf(context.filename) !== 'project') {
      return {}
    }
    return {
      Document(node) {
        // A file that is no object holds no key, and Claude Code reports it as an error.
        if (node.body.type !== 'Object') {
          return
        }
        const project = realDirectory(path.dirname(path.dirname(path.resolve(context.filename))))
        const bound = repositoryRoot(project)
        const children = gitChildren(bound, project)
        const secrets = gitTracksBelow(bound, path.join(project, SECRETS))
        if (children === UNREADABLE) {
          return
        }
        const tracked = [
          ...children
            .map(([file]) => file)
            .filter((file) => ENV_FILE.test(file) && !PLACEHOLDER.test(file)),
          ...(secrets === true ? [SECRETS] : []),
        ]
        if (tracked.length === 0) {
          return
        }
        const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
        if (!complete) {
          return
        }
        // A deny rule for the tool alone covers every file. A parameter rule such as
        // `Read(offset:5)` is no path.
        const patterns = stringsAt(objects, ['permissions', 'deny']).flatMap((text) => {
          const parsed = parsePermissionRule(text)
          return parsed.ok && parsed.tool === 'Read'
            ? [
                parsed.specifier === null
                  ? '**'
                  : pathSpecifier({ list: 'deny', rule: parsed }, ['Read']),
              ]
            : []
        })
        const open = tracked.filter(
          (item) =>
            !patterns.some((pattern) => pattern !== null && denyPatternCovers(pattern, item)),
        )
        if (open.length === 0) {
          return
        }
        const rules = [
          ...(open.includes('.env') ? [ADVICE.env] : []),
          ...(open.some((item) => item !== '.env' && item !== SECRETS) ? [ADVICE.envVariant] : []),
          ...(open.includes(SECRETS) ? [ADVICE.secrets] : []),
        ]
        context.report({
          loc: (valueAt(node, ['permissions']) ?? node.body).loc,
          messageId: 'open',
          data: {
            items: open.map((item) => `\`${item}\``).join(', '),
            rules: rules.map((text) => `\`${text}\``).join(', '),
          },
        })
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json'],
}

export default rule
