// `docker` does not work inside the sandbox, and the docs advise an `excludedCommands` pattern such
// as `docker compose *` (https://code.claude.com/docs/en/sandboxing#docker-commands-fail). The
// rule lints the shared project file. It asks the git index (`src/permission-project.ts`) for the
// signs of Docker use in the project folder: a tracked `Dockerfile`, `docker-compose.yml` or
// `docker-compose.yaml`, and a `docker` command in a script of a tracked `package.json`
// (docs/rules/sandbox-docker-excluded.md). It adds up the project pair and makes no report when it
// cannot read a file, when git cannot answer, or for a managed file, which belongs to no project.
// A user file can hold the entry, which is why the rule is `off` in `recommended`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { projectFacts } from '../permission-project.ts'
import { valueAt } from '../permission-sandbox.ts'
import { at, boolOf, sandboxOn, sourceOf, stringsAt } from '../permission-source.ts'
import { kindOf } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'sandbox-docker-excluded' as const

const FILES = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']
/** A `docker` command at the start of a script or after a shell operator. */
const DOCKER_COMMAND = /(?:^|[\s;&|(])docker(?:-compose)?(?=[\s;&|)]|$)/

/** True when the entry `text` takes `docker` out of the sandbox: it starts with `docker` or
 *  `docker-compose`, or it is a star. */
function excludesDocker(text: string): boolean {
  const words = commandWords(text)
  return (
    ['docker', 'docker-compose'].includes(words[0] as string) ||
    (words.length > 0 && words.every((word) => word === '*'))
  )
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'docker' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Exclude docker from the sandbox in a project that uses Docker',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      docker:
        'The sandbox is on, and the project uses Docker (`{{sign}}`), but no "excludedCommands" entry starts with `docker`. `docker` is incompatible with the sandbox, so its commands fail. The docs advise a pattern such as `docker compose *`. A narrower pattern takes fewer commands out of the sandbox. A user settings file can hold the entry, and this rule cannot see it.',
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
        if (
          !complete ||
          !sandboxOn(objects, false) ||
          stringsAt(objects, ['sandbox', 'excludedCommands']).some(excludesDocker)
        ) {
          return
        }
        const facts = projectFacts(context.filename)
        if (facts === UNREADABLE) {
          return
        }
        const sign =
          FILES.find((file) => facts.names.includes(file)) ??
          (facts.scripts.some((script) => DOCKER_COMMAND.test(script)) ? 'package.json' : null)
        if (sign !== null) {
          const own = boolOf(at(objects[0], ['sandbox', 'enabled']), false, true) === true
          context.report({
            node: own ? (valueAt(node, ['sandbox', 'enabled']) ?? node.body) : node.body,
            messageId: 'docker',
            data: { sign },
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
