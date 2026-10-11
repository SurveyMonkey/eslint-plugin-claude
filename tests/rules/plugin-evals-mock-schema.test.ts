// A mock file in `mocks/<server>/` has the type `fixed` or `agent`. The key `error` works with `fixed`
// only, and the key `abort_when` with `agent` only (plugin evals page, "Mock files"). The trees are
// on disk, because the rule finds the plugin and the case around the file. The files glob is in
// tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintEval, MANIFEST, PLUGIN, suite } from '../plugin-evals.test-support.ts'

const RULE = 'plugin-evals-mock-schema'
const check = it
const linked = noLinks ? it.skip : check
const FILE = 'evals/mocks/gh/issue.md'
const top = suite({
  'evals/mocks/gh/issue.md': 'x',
  'evals/mocks/gh/_server.md': 'x',
  'evals/first/prompt.md': 'x',
  'evals/first/mocks/gh/issue.md': 'x',
  'evals/first/graders/g.md': 'x',
})

/** The messages for a mock file with the frontmatter `fields`. */
const lint = (fields: string, file = FILE) =>
  lintEval(RULE, top, file, `---\n${fields}\n---\n\nCreated issue 1.\n`)
const messages = (fields: string, file = FILE) => lint(fields, file).map((m) => m.message)

const BAD_TYPE = (value: string) =>
  `\`type\` is ${value}. A mock \`type\` is \`fixed\` or \`agent\`.`
const ERROR =
  '`error` works with `type: fixed` only, and this mock is `agent`. Set `type: fixed`, or remove `error`.'
const ABORT =
  '`abort_when` works with `type: agent` only, and this mock is `fixed`. Set `type: agent`, or remove `abort_when`.'

describe(RULE, () => {
  check('reports error with type agent, on the key, with the full message', () => {
    const found = lint('type: agent\nerror: true')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'errorAgent',
      message: ERROR,
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 6,
    })
  })

  check('reports abort_when with type fixed, also when type is not set', () => {
    const found = lint('type: fixed\nabort_when: never')
    expect(found.map((m) => m.message)).toEqual([ABORT])
    expect(found[0]).toMatchObject({ messageId: 'abortFixed', line: 3, column: 1, endColumn: 11 })
    expect(messages('abort_when: never')).toEqual([ABORT])
  })

  check('reports a type that is neither fixed nor agent, on the value', () => {
    const found = lint('type: dynamic')
    expect(found.map((m) => m.message)).toEqual([BAD_TYPE('dynamic')])
    expect(found[0]).toMatchObject({ messageId: 'badType', line: 2, column: 7, endColumn: 14 })
    expect(messages('type: Agent')).toEqual([BAD_TYPE('Agent')])
    expect(messages('type: 5')).toEqual([BAD_TYPE('5')])
    expect(messages('type: "fixed "')).toEqual([BAD_TYPE('"fixed "')])
  })

  check('reads no other key of a mock with a type that it cannot read', () => {
    expect(messages('type: dynamic\nerror: true\nabort_when: never')).toEqual([BAD_TYPE('dynamic')])
  })

  check('stays silent for a valid mock', () => {
    expect(messages('type: fixed\nerror: true')).toEqual([])
    expect(messages('error: true')).toEqual([])
    expect(messages('type: agent\nabort_when: the tool is called twice')).toEqual([])
    expect(messages('expect:\n  title: string')).toEqual([])
    expect(messages('type: fixed')).toEqual([])
    expect(messages('type: agent')).toEqual([])
  })

  check('stays silent for error that is false or empty, and for an empty abort_when', () => {
    expect(messages('type: agent\nerror: false')).toEqual([])
    expect(messages('type: agent\nerror:')).toEqual([])
    expect(messages('type: fixed\nabort_when:')).toEqual([])
    expect(messages('type: fixed\nabort_when: null')).toEqual([])
    expect(messages('type: agent\nerror: "true"')).toEqual([])
  })

  check('stays silent for a type that is empty', () => {
    expect(messages('type:')).toEqual([])
    expect(messages('type:\nerror: true\nabort_when: x')).toEqual([ABORT])
  })

  check('reads a _server.md as an agent mock, so it reports error and not abort_when', () => {
    const server = 'evals/mocks/gh/_server.md'
    expect(messages('tools: [issue]\nabort_when: x', server)).toEqual([])
    expect(messages('tools: [issue]\nerror: true', server)).toEqual([])
    expect(messages('type: agent\nerror: true', server)).toEqual([ERROR])
    expect(messages('type: fixed\nabort_when: x', server)).toEqual([ABORT])
  })

  check('reads a mock of a case', () => {
    expect(messages('type: agent\nerror: true', 'evals/first/mocks/gh/issue.md')).toEqual([ERROR])
  })

  check('stays silent for saved answers, fixtures, and a file that is no mock', () => {
    const fields = 'type: agent\nerror: true'
    expect(lint(fields, 'evals/mocks/.replay/gh/answer.md')).toEqual([])
    expect(lint(fields, 'evals/mocks/.replay/answer.md')).toEqual([])
    expect(lint(fields, 'evals/mocks/gh/fixtures/f.md')).toEqual([])
    expect(lint(fields, 'evals/mocks/answer.md')).toEqual([])
    expect(lint(fields, 'evals/first/graders/g.md')).toEqual([])
    expect(lint(fields, 'evals/first/prompt.md')).toEqual([])
    expect(lint(fields, 'mocks/gh/issue.md')).toEqual([])
    expect(lint(fields, 'evals/other/mocks/gh/issue.md')).toEqual([])
  })

  check(
    'stays silent for no frontmatter, a block that does not parse, or one that is no map',
    () => {
      expect(lintEval(RULE, top, FILE, 'Created issue 1.\n')).toEqual([])
      expect(lintEval(RULE, top, FILE, '---\ntype: [\n---\n')).toEqual([])
      expect(lintEval(RULE, top, FILE, '---\n- a\n---\n')).toEqual([])
      expect(lintEval(RULE, top, FILE, '---\n---\nbody\n')).toEqual([])
    },
  )

  check('does not read an inherited name as a type', () => {
    expect(messages('type: constructor')).toEqual([BAD_TYPE('constructor')])
    expect(messages('type: toString')).toEqual([BAD_TYPE('toString')])
  })

  check('reads the eval directory of experimental.evals', () => {
    const custom = suite({
      [MANIFEST]: JSON.stringify({ name: 'p', experimental: { evals: 'qa' } }),
      'qa/mocks/gh/issue.md': 'x',
      'evals/mocks/gh/issue.md': 'x',
    })
    const code = '---\ntype: agent\nerror: true\n---\n'
    expect(lintEval(RULE, custom, 'qa/mocks/gh/issue.md', code)).toHaveLength(1)
    expect(lintEval(RULE, custom, 'evals/mocks/gh/issue.md', code)).toEqual([])
  })

  check('stays silent when the plugin cannot be seen', () => {
    const broken = suite({ [MANIFEST]: '{', [FILE]: 'x' })
    expect(lintEval(RULE, broken, FILE, '---\ntype: nope\n---\n')).toEqual([])
    expect(lintEval(RULE, tree({}), FILE, '---\ntype: nope\n---\n')).toEqual([])
  })

  linked('stays silent when the root of the plugin links out of the repository', () => {
    // The folder has no `.git`, so it is out of the repository of `inner`.
    const outside = tree({ [MANIFEST]: PLUGIN, [FILE]: 'x' }, false)
    const inner = suite()
    link(inner, 'plug', outside)
    expect(lintEval(RULE, inner, `plug/${FILE}`, '---\ntype: nope\n---\n')).toEqual([])
  })
})
