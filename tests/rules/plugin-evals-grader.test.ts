// A grader file in `graders/` sets its `type`, and may set `weight` and `arm`. A `regex` grader takes
// `target` and `pattern`, and an `llm` grader takes `focus` (plugin evals page, "Grader frontmatter",
// "What a grader can look at" and "Grader types"). The trees are on disk, because the rule finds the
// plugin and the case around the file. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintEval, MANIFEST, PLUGIN, suite } from '../plugin-evals.test-support.ts'

const RULE = 'plugin-evals-grader'
const check = it
const linked = noLinks ? it.skip : check
const FILE = 'evals/first/graders/g.md'
const top = suite({ 'evals/first/prompt.md': 'x', [FILE]: 'x', 'evals/mocks/gh/t.md': 'x' })

/** The messages for a grader file with the frontmatter `fields`. */
const lint = (fields: string, file = FILE) =>
  lintEval(RULE, top, file, `---\n${fields}\n---\n\nPASS if the reply is short.\n`)
const messages = (fields: string) => lint(fields).map((m) => m.message)

const TYPES = '`regex`, `tool_used`, `tool_order`, `file_exists`, `llm` or `baseline`'
const NO_TYPE = `The grader has no \`type\`. Set it to one of ${TYPES}.`
const BAD_TYPE = (value: string) =>
  `\`type\` is ${value}, which is not a grader type. Use one of ${TYPES}.`
const WEIGHT = (value: string) => `\`weight\` is ${value}. It must be a positive number.`
const ARM = (value: string) =>
  `\`arm\` is ${value}. Use \`with-only\` or \`both\`, or leave \`arm\` out.`
const TARGET = (key: string, value: string) =>
  `\`${key}\` is ${value}. Use \`last_message\`, \`trace\`, \`files\`, \`mock_calls\`, or \`{ source: file, path: <path> }\`.`
const INLINE =
  'The pattern uses `(?i)`, which is not supported. Put case-insensitivity in `flags: i`.'

describe(RULE, () => {
  check('reports a type that is no grader type, on the value, with the full message', () => {
    const found = lint('type: contains')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'badType',
      message: BAD_TYPE('contains'),
      line: 2,
      column: 7,
      endLine: 2,
      endColumn: 15,
    })
  })

  check(
    'reports a type with the wrong case, a type that is not a string, and an empty type',
    () => {
      expect(messages('type: Regex')).toEqual([BAD_TYPE('Regex')])
      expect(messages('type: 5')).toEqual([BAD_TYPE('5')])
      expect(messages('type: [llm]')).toEqual([BAD_TYPE('[llm]')])
      expect(messages('type: "tool used"')).toEqual([BAD_TYPE('"tool used"')])
    },
  )

  check('stays silent for each grader type', () => {
    for (const type of ['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline']) {
      expect(messages(`type: ${type}`), type).toEqual([])
    }
  })

  check('reports a grader with no type, on the frontmatter, also a type with no value', () => {
    const found = lint('weight: 2')
    expect(found.map((m) => m.message)).toEqual([NO_TYPE])
    expect(found[0]).toMatchObject({ messageId: 'noType', line: 1, column: 1 })
    expect(messages('type:')).toEqual([NO_TYPE])
    expect(messages('type: null')).toEqual([NO_TYPE])
  })

  check('reports a grader with no frontmatter, at the start', () => {
    const found = lintEval(RULE, top, FILE, 'PASS if the reply is short.\n')
    expect(found.map((m) => m.message)).toEqual([NO_TYPE])
    expect(found[0]).toMatchObject({ line: 1, column: 1 })
    expect(lintEval(RULE, top, FILE, '')).toHaveLength(1)
  })

  check('reports a weight that is not a positive number', () => {
    const found = lint('type: llm\nweight: 0')
    expect(found.map((m) => m.message)).toEqual([WEIGHT('0')])
    expect(found[0]).toMatchObject({ messageId: 'badWeight', line: 3, column: 9, endColumn: 10 })
    expect(messages('type: llm\nweight: -1')).toEqual([WEIGHT('-1')])
    expect(messages('type: llm\nweight: heavy')).toEqual([WEIGHT('heavy')])
    expect(messages('type: llm\nweight: "2"')).toEqual([WEIGHT('"2"')])
    expect(messages('type: llm\nweight: .nan')).toEqual([WEIGHT('.nan')])
  })

  check('stays silent for a positive weight, also a fraction', () => {
    expect(messages('type: llm\nweight: 2')).toEqual([])
    expect(messages('type: llm\nweight: 0.5')).toEqual([])
    expect(messages('type: llm\nweight:')).toEqual([])
  })

  check('reports an arm that is neither with-only nor both', () => {
    const found = lint('type: tool_used\narm: without')
    expect(found.map((m) => m.message)).toEqual([ARM('without')])
    expect(found[0]).toMatchObject({ messageId: 'badArm', line: 3, column: 6 })
    expect(messages('type: llm\narm: With-Only')).toEqual([ARM('With-Only')])
    expect(messages('type: llm\narm: true')).toEqual([ARM('true')])
  })

  check('stays silent for each arm, and for no arm', () => {
    expect(messages('type: llm\narm: with-only')).toEqual([])
    expect(messages('type: llm\narm: both')).toEqual([])
    expect(messages('type: llm\narm:')).toEqual([])
  })

  check('reports a regex target that is no value of the table, on the value', () => {
    const found = lint('type: regex\ntarget: reply')
    expect(found.map((m) => m.message)).toEqual([TARGET('target', 'reply')])
    expect(found[0]).toMatchObject({ messageId: 'badTarget', line: 3, column: 9 })
    expect(messages('type: regex\ntarget: Trace')).toEqual([TARGET('target', 'Trace')])
    expect(messages('type: regex\ntarget: 3')).toEqual([TARGET('target', '3')])
  })

  check('reports an llm focus that is no value of the table', () => {
    expect(messages('type: llm\nfocus: output')).toEqual([TARGET('focus', 'output')])
  })

  check('reports a source map that is not file with a path', () => {
    expect(messages('type: regex\ntarget: { source: dir, path: a }')).toHaveLength(1)
    expect(messages('type: regex\ntarget: { source: file }')).toHaveLength(1)
    expect(messages('type: regex\ntarget: { source: file, path: "" }')).toHaveLength(1)
    expect(messages('type: regex\ntarget: { source: file, path: 5 }')).toHaveLength(1)
    expect(messages('type: regex\ntarget: { path: a }')).toHaveLength(1)
    expect(messages('type: regex\ntarget: [trace]')).toHaveLength(1)
  })

  check('stays silent for each target and focus of the table', () => {
    for (const value of ['last_message', 'trace', 'files', 'mock_calls']) {
      expect(messages(`type: regex\ntarget: ${value}`), value).toEqual([])
      expect(messages(`type: llm\nfocus: ${value}`), value).toEqual([])
    }
    expect(messages('type: regex\ntarget: { source: file, path: out/report.md }')).toEqual([])
    expect(messages('type: llm\nfocus:\n  source: file\n  path: out/report.md')).toEqual([])
    expect(messages('type: regex\ntarget:')).toEqual([])
  })

  check('reads target for regex and focus for llm only', () => {
    expect(messages('type: llm\ntarget: reply')).toEqual([])
    expect(messages('type: regex\nfocus: output')).toEqual([])
    expect(messages('type: tool_used\ntarget: reply\nfocus: output')).toEqual([])
    expect(messages('type: baseline\nfocus: output')).toEqual([])
  })

  check('reports an inline (?i) in a regex pattern, on the value', () => {
    const found = lint('type: regex\npattern: "(?i)hello"')
    expect(found.map((m) => m.message)).toEqual([INLINE])
    expect(found[0]).toMatchObject({ messageId: 'inlineFlag', line: 3, column: 10 })
    expect(messages("type: regex\npattern: '^foo(?i)bar$'")).toEqual([INLINE])
  })

  check('stays silent for a pattern with the flag in flags, or an (?i) in another grader', () => {
    expect(messages('type: regex\npattern: hello\nflags: i')).toEqual([])
    expect(messages('type: regex\npattern: "(?:i)hello"')).toEqual([])
    expect(messages('type: tool_used\ntool: Skill\ninput_match: "(?i)x"')).toEqual([])
    expect(messages('type: regex\npattern: 5')).toEqual([])
    expect(messages('type: llm\npattern: "(?i)x"')).toEqual([])
    expect(messages('type: baseline\npattern: "(?i)x"')).toEqual([])
  })

  check('reports each fault of one file', () => {
    expect(messages('type: nope\nweight: 0\narm: x')).toEqual([
      BAD_TYPE('nope'),
      WEIGHT('0'),
      ARM('x'),
    ])
  })

  check('does not read an inherited name as a type', () => {
    expect(messages('type: constructor')).toEqual([BAD_TYPE('constructor')])
    expect(messages('type: llm\narm: toString')).toEqual([ARM('toString')])
    expect(messages('type: regex\ntarget: __proto__')).toEqual([TARGET('target', '__proto__')])
  })

  check('stays silent for a key that an alias writes, because the rule cannot place it', () => {
    expect(messages('k: &k type\n*k : nope')).toEqual([])
    expect(messages('type: llm\nk: &k weight\n*k : 0')).toEqual([])
  })

  check('stays silent for a block that does not parse or is not a map', () => {
    expect(messages('type: [')).toEqual([])
    expect(lintEval(RULE, top, FILE, '---\n- a\n---\n')).toEqual([])
    expect(lintEval(RULE, top, FILE, '---\n---\nbody\n')).toEqual([])
  })

  check('stays silent for a prompt, a mock, a nested file, and a grader of no case', () => {
    const fields = 'type: nope'
    expect(lint(fields, 'evals/first/prompt.md')).toEqual([])
    expect(lint(fields, 'evals/mocks/gh/t.md')).toEqual([])
    expect(lint(fields, 'evals/first/graders/sub/g.md')).toEqual([])
    expect(lint(fields, 'evals/other/graders/g.md')).toEqual([])
    expect(lint(fields, 'graders/g.md')).toEqual([])
  })

  check('reads the graders of a case that has a case.yaml only, and of experimental.evals', () => {
    const yaml = suite({ 'evals/c/case.yaml': 'x', 'evals/c/graders/g.md': 'x' })
    expect(lintEval(RULE, yaml, 'evals/c/graders/g.md', '---\ntype: nope\n---\n')).toHaveLength(1)
    const custom = suite({
      [MANIFEST]: JSON.stringify({ name: 'p', experimental: { evals: 'qa' } }),
      'qa/c/prompt.md': 'x',
      'qa/c/graders/g.md': 'x',
      'evals/c/prompt.md': 'x',
      'evals/c/graders/g.md': 'x',
    })
    expect(lintEval(RULE, custom, 'qa/c/graders/g.md', '---\ntype: nope\n---\n')).toHaveLength(1)
    expect(lintEval(RULE, custom, 'evals/c/graders/g.md', '---\ntype: nope\n---\n')).toEqual([])
  })

  check('stays silent when the plugin cannot be seen', () => {
    const broken = suite({ [MANIFEST]: '{', 'evals/first/prompt.md': 'x', [FILE]: 'x' })
    expect(lintEval(RULE, broken, FILE, 'text\n')).toEqual([])
    expect(lintEval(RULE, tree({}), FILE, 'text\n')).toEqual([])
  })

  linked('stays silent when the root of the plugin links out of the repository', () => {
    // The folder has no `.git`, so it is out of the repository of `inner`.
    const outside = tree({ [MANIFEST]: PLUGIN, 'evals/first/prompt.md': 'x', [FILE]: 'x' }, false)
    const inner = suite()
    link(inner, 'plug', outside)
    expect(lintEval(RULE, inner, `plug/${FILE}`, 'text\n')).toEqual([])
  })
})
