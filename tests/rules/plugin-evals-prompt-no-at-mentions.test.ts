// Claude Code does not expand an `@path` mention in the body of an eval `prompt.md` into a file
// attachment (plugin evals page, "Set run limits and tools in prompt.md"). The trees are on disk,
// because the rule finds the plugin and the case around the file. The files glob is in
// tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintEval, MANIFEST, PLUGIN, suite } from '../plugin-evals.test-support.ts'

const RULE = 'plugin-evals-prompt-no-at-mentions'
const check = it.fails
const linked = noLinks ? it.skip : check
const FILE = 'evals/first/prompt.md'
const top = suite({ [FILE]: 'x', 'evals/first/graders/g.md': 'x', 'evals/mocks/gh/t.md': 'x' })

const lint = (code: string, file = FILE) => lintEval(RULE, top, file, code)
const messages = (code: string) => lint(code).map((m) => m.message)
const MENTION = (path: string) =>
  `The text \`@${path}\` in the prompt is not expanded into a file attachment, so Claude receives it as written. To let Claude read the file, list a tool for it in \`allowed_tools\`, such as \`Read\`.`

describe(RULE, () => {
  check('reports a mention in the body, on the token, with the full message', () => {
    const found = lint('---\nmax_turns: 5\n---\n\nSummarize @src/app.ts for me.\n')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'mention',
      message: MENTION('src/app.ts'),
      line: 5,
      column: 11,
      endLine: 5,
      endColumn: 22,
    })
  })

  check('reports each mention, also in a prompt with no frontmatter', () => {
    expect(messages('Compare @a.md and @docs/b.md.\n@c at the start of a line\n')).toEqual([
      MENTION('a.md'),
      MENTION('docs/b.md'),
      MENTION('c'),
    ])
  })

  check(
    'leaves the end punctuation of a sentence out of the path, and out of the report range',
    () => {
      const found = lint('See @a.md, @b.md; @c/d? and @e.\n')
      expect(found.map((m) => m.message)).toEqual([
        MENTION('a.md'),
        MENTION('b.md'),
        MENTION('c/d'),
        MENTION('e'),
      ])
      expect(found[0]).toMatchObject({ column: 5, endColumn: 10 })
    },
  )

  check('stays silent for a token that is only punctuation', () => {
    expect(messages('Use @. or @... or @?!\n')).toEqual([])
  })

  check('reports a path with an escaped space', () => {
    expect(messages('Read @my\\ notes.md now\n')).toEqual([MENTION('my notes.md')])
  })

  check('stays silent for a body with no mention', () => {
    expect(messages('---\nname: first\n---\n\nWrite me a commit message.\n')).toEqual([])
    expect(messages('')).toEqual([])
  })

  check('stays silent for an at sign that starts no mention', () => {
    expect(messages('Mail me: a@b.com, or use @ alone.\n')).toEqual([])
    expect(messages('Say "@foo" and \'@bar\' in quotes.\n')).toEqual([])
  })

  check('stays silent for a mention in a code span, a fenced block, or a comment', () => {
    expect(messages('Type `@src/app.ts` in the chat.\n')).toEqual([])
    expect(messages('```\n@src/app.ts\n```\n')).toEqual([])
    expect(messages('~~~text\n@src/app.ts\n~~~\n')).toEqual([])
    expect(messages('<!-- @src/app.ts -->\n')).toEqual([])
  })

  check('stays silent for an at sign in the frontmatter', () => {
    expect(messages('---\ndescription: ask @team\nname: "@x"\n---\n\nHello.\n')).toEqual([])
  })

  check('reads the body of a file whose frontmatter does not parse', () => {
    expect(messages('---\nname: [\n---\n\nSee @a.md\n')).toEqual([MENTION('a.md')])
  })

  check('stays silent for a grader, a mock, and a prompt.md outside the suite', () => {
    const code = 'See @src/app.ts\n'
    expect(lint(code, 'evals/first/graders/g.md')).toEqual([])
    expect(lint(code, 'evals/mocks/gh/t.md')).toEqual([])
    expect(lint(code, 'prompt.md')).toEqual([])
    expect(lint(code, 'evals/first/fixtures/prompt.md')).toEqual([])
  })

  check('reads the eval directory of experimental.evals', () => {
    const custom = suite({
      [MANIFEST]: JSON.stringify({ name: 'p', experimental: { evals: 'qa' } }),
    })
    expect(lintEval(RULE, custom, 'qa/c/prompt.md', 'See @a.md\n')).toHaveLength(1)
    expect(lintEval(RULE, custom, 'evals/c/prompt.md', 'See @a.md\n')).toEqual([])
  })

  check('stays silent when the plugin cannot be seen', () => {
    expect(lintEval(RULE, suite({ [MANIFEST]: '{' }), FILE, 'See @a.md\n')).toEqual([])
    expect(lintEval(RULE, tree({}), FILE, 'See @a.md\n')).toEqual([])
  })

  linked('stays silent when the root of the plugin links out of the repository', () => {
    // The folder has no `.git`, so it is out of the repository of `inner`.
    const outside = tree({ [MANIFEST]: PLUGIN, [FILE]: 'x' }, false)
    const inner = suite()
    link(inner, 'plug', outside)
    expect(lintEval(RULE, inner, `plug/${FILE}`, 'See @a.md\n')).toEqual([])
  })
})
