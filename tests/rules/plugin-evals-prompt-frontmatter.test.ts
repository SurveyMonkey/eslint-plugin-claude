// The frontmatter of an eval `prompt.md` takes 13 fields, and an unknown key is an error. Three
// number fields have limits, and the keys of `env` must match `EVAL_[A-Z0-9_]*` (plugin evals page,
// "prompt.md frontmatter"). The trees are on disk, because the rule finds the plugin and the case
// around the file. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintEval, MANIFEST, PLUGIN, suite } from '../plugin-evals.test-support.ts'

const RULE = 'plugin-evals-prompt-frontmatter'
const check = it
const linked = noLinks ? it.skip : check
const FILE = 'evals/first/prompt.md'

/** The messages for a `prompt.md` with the frontmatter `fields` and a body. */
const lint = (fields: string, file = FILE, files: Record<string, string> = {}) => {
  const top = suite({ [file]: 'x', ...files })
  return lintEval(RULE, top, file, `---\n${fields}\n---\n\nWrite a commit message.\n`)
}
const messages = (fields: string) => lint(fields).map((m) => m.message)

const UNKNOWN = (key: string) =>
  `\`${key}\` is not a frontmatter field of an eval \`prompt.md\`. The docs say that an unknown key is an error.`
const NEAR = (key: string, expected: string) => `${UNKNOWN(key)} Use \`${expected}\`.`
const RANGE = (key: string, value: string, limit: string) =>
  `\`${key}\` is ${value}, and the docs give the limit ${limit}.`
const ENV = (key: string) =>
  `\`env\` has the key "${key}". A key must match \`EVAL_[A-Z0-9_]*\`, and Claude Code fails the run for any other key.`

describe(RULE, () => {
  check('reports an unknown key, on the key, with the full message and the position', () => {
    const found = lint('max_turns: 10\nbogus: 1')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'unknownKey',
      message: UNKNOWN('bogus'),
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 6,
    })
  })

  check('reports a key of case.yaml that prompt.md does not take', () => {
    expect(messages('context: {}\nexecution: {}\ngraders: []')).toEqual([
      UNKNOWN('context'),
      UNKNOWN('execution'),
      UNKNOWN('graders'),
    ])
  })

  check('names the known key for a near miss', () => {
    expect(messages('maxTurns: 5\nallowed-tools: [Read]\nTimeout_Seconds: 5')).toEqual([
      NEAR('maxTurns', 'max_turns'),
      NEAR('allowed-tools', 'allowed_tools'),
      NEAR('Timeout_Seconds', 'timeout_seconds'),
    ])
  })

  check('stays silent for each of the 13 fields', () => {
    const fields = [
      'schema_version: "1.1"',
      'name: first',
      'description: d',
      'tags: [smoke]',
      'plugins: ["../.."]',
      'runs: 3',
      'expected_outcome: e',
      'model: sonnet',
      'max_turns: 10',
      'timeout_seconds: 300',
      'allowed_tools: [Read, Glob, Grep, Skill]',
      'append_system_prompt: p',
      'env: { EVAL_A: x }',
    ]
    expect(messages(fields.join('\n'))).toEqual([])
  })

  check('does not read an inherited name as a field', () => {
    expect(messages('constructor: 1\ntoString: 2')).toEqual([
      UNKNOWN('constructor'),
      UNKNOWN('toString'),
    ])
  })

  check.each([
    ['runs', '0', '0', '1 to 50'],
    ['runs', '51', '51', '1 to 50'],
    ['runs', '-1', '-1', '1 to 50'],
    ['max_turns', '201', '201', 'at most 200'],
    ['timeout_seconds', '3601', '3601', 'at most 3600'],
  ])('reports %s: %s, on the value', (key, written, shown, limit) => {
    const found = lint(`${key}: ${written}`)
    expect(found.map((m) => m.message)).toEqual([RANGE(key, shown, limit)])
    expect(found[0]).toMatchObject({ messageId: 'outOfRange', line: 2, column: key.length + 3 })
  })

  check.each([
    ['runs', '1'],
    ['runs', '50'],
    ['max_turns', '200'],
    ['max_turns', '1'],
    ['max_turns', '0'],
    ['timeout_seconds', '3600'],
    ['timeout_seconds', '0'],
  ])('stays silent for %s: %s', (key, value) => {
    expect(messages(`${key}: ${value}`)).toEqual([])
  })

  check('stays silent for a number field that is not a number', () => {
    expect(messages('runs: many\nmax_turns: "300"\ntimeout_seconds: [1]\nruns: null')).toEqual([])
    expect(messages('runs:')).toEqual([])
  })

  check('reports each env key that does not match, on the value of env', () => {
    const found = lint('env:\n  EVAL_A: x\n  PATH: y\n  eval_b: z\n  EVAL_a: w')
    expect(found.map((m) => m.message)).toEqual([ENV('PATH'), ENV('eval_b'), ENV('EVAL_a')])
    expect(found[0]).toMatchObject({ messageId: 'envKey', line: 3, column: 3 })
  })

  check('stays silent for env keys that match, and for an env that is no map', () => {
    expect(messages('env: { EVAL_: 1, EVAL_A1_B: 2, EVAL_9: 3 }')).toEqual([])
    expect(messages('env: [PATH]\nenv:')).toEqual([])
    expect(messages('env: PATH')).toEqual([])
    expect(messages('env: {}')).toEqual([])
  })

  check('reports a number as an env key', () => {
    expect(messages('env: { 1: x }')).toEqual([ENV('1')])
  })

  check(
    'stays silent for a file with no frontmatter, a block that is not a map, or bad YAML',
    () => {
      const top = suite({ [FILE]: 'x' })
      expect(lintEval(RULE, top, FILE, 'Just a prompt.\n')).toEqual([])
      expect(lintEval(RULE, top, FILE, '---\n- a\n---\n')).toEqual([])
      expect(lintEval(RULE, top, FILE, '---\nname: [\n---\n')).toEqual([])
      expect(lintEval(RULE, top, FILE, '---\n---\nbody\n')).toEqual([])
    },
  )

  check('reads a prompt.md in the eval directory of experimental.evals only', () => {
    const manifest = JSON.stringify({ name: 'p', experimental: { evals: 'qa' } })
    const files = { [MANIFEST]: manifest }
    expect(lint('bogus: 1', 'qa/c/prompt.md', files)).toHaveLength(1)
    expect(lint('bogus: 1', 'evals/c/prompt.md', files)).toEqual([])
  })

  check('stays silent for a prompt.md that is no case, and for a file outside any suite', () => {
    expect(lint('bogus: 1', 'prompt.md')).toEqual([])
    expect(lint('bogus: 1', 'docs/prompt.md')).toEqual([])
    expect(lint('bogus: 1', 'evals/first/fixtures/prompt.md', { [FILE]: 'x' })).toEqual([])
  })

  check('stays silent when the plugin cannot be seen', () => {
    expect(lint('bogus: 1', FILE, { [MANIFEST]: '{' })).toEqual([])
    expect(lint('bogus: 1', FILE, { [MANIFEST]: '[]' })).toEqual([])
  })

  linked('stays silent when the root of the plugin links out of the repository', () => {
    // The folder has no `.git`, so it is out of the repository of `top`.
    const outside = tree({ [MANIFEST]: PLUGIN, [FILE]: 'x' }, false)
    const top = suite()
    link(top, 'plug', outside)
    expect(lintEval(RULE, top, `plug/${FILE}`, '---\nbogus: 1\n---\n')).toEqual([])
  })
})
