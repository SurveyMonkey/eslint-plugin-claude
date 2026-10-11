// A `case.yaml` sets `schema_version: "1.1"` and `name`. The paths in `context.scaffold_script`,
// `context.history_file` and `context.add_dirs` are in the case directory (plugin evals page,
// "case.yaml fields" and "Seed the workspace or conversation"). ESLint has no YAML language, so the
// rule lints the manifest of the plugin and reads the case files from the eval directory. The
// trees are on disk. The files glob is in tests/configs.test.ts.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-evals-case-yaml'
const check = it.fails
const linked = noLinks ? it.skip : check
const CASE = 'evals/first/case.yaml'
const GOOD = 'schema_version: "1.1"\nname: first\n'

/** The messages for a plugin with the case files `files`, keyed by their path from the plugin
 *  root. A `prompt.md` makes the case folder, so a file such as `evals/first/fixture.sh` can sit
 *  beside the `case.yaml`. */
function messages(files: Record<string, string>, manifest: unknown = { name: 'p' }) {
  const { dir, code } = pluginTree(manifest, files)
  return lintPlugin(RULE, dir, code).map((m) => m.message)
}
const yaml = (text: string, files: Record<string, string> = {}) =>
  messages({ [CASE]: text, ...files })

const NO_VERSION =
  'The file "evals/first/case.yaml" has no `schema_version`. A case.yaml needs `schema_version: "1.1"`.'
const BAD_VERSION = (value: string) =>
  `The file "evals/first/case.yaml" sets \`schema_version\` to ${value}. A case.yaml needs \`schema_version: "1.1"\`.`
const NO_NAME = 'The file "evals/first/case.yaml" has no `name`. A case.yaml needs a `name`.'
const OUTSIDE = (key: string, value: string) =>
  `The file "evals/first/case.yaml" names "${value}" in \`context.${key}\`. The path is not inside the case directory, and the docs ask for a path inside it.`
const MISSING = (key: string, value: string) =>
  `The file "evals/first/case.yaml" names "${value}" in \`context.${key}\`, and the case directory has no such path.`

describe(RULE, () => {
  check('reports a missing schema_version, at the start of the manifest', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { [CASE]: 'name: first\n' })
    const found = lintPlugin(RULE, dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'noVersion',
      message: NO_VERSION,
      line: 1,
      column: 1,
    })
  })

  check('reports a schema_version that is not 1.1, as it is written', () => {
    expect(yaml('schema_version: "1.0"\nname: a')).toEqual([BAD_VERSION('"1.0"')])
    expect(yaml('schema_version: 2\nname: a')).toEqual([BAD_VERSION('2')])
    expect(yaml("schema_version: '1.10'\nname: a")).toEqual([BAD_VERSION("'1.10'")])
    expect(yaml('schema_version: [1.1]\nname: a')).toEqual([BAD_VERSION('[1.1]')])
  })

  check('stays silent for schema_version 1.1, quoted or not', () => {
    expect(yaml('schema_version: "1.1"\nname: a')).toEqual([])
    expect(yaml("schema_version: '1.1'\nname: a")).toEqual([])
    expect(yaml('schema_version: 1.1\nname: a')).toEqual([])
  })

  check('treats an empty schema_version as missing', () => {
    expect(yaml('schema_version:\nname: a')).toEqual([NO_VERSION])
    expect(yaml('schema_version: null\nname: a')).toEqual([NO_VERSION])
  })

  check('reports a missing, empty or null name', () => {
    expect(yaml('schema_version: "1.1"')).toEqual([NO_NAME])
    expect(yaml('schema_version: "1.1"\nname:')).toEqual([NO_NAME])
    expect(yaml('schema_version: "1.1"\nname: ""')).toEqual([NO_NAME])
    expect(yaml('schema_version: "1.1"\nname: null')).toEqual([NO_NAME])
  })

  check('reports both faults of one file, and of each case', () => {
    expect(yaml('description: d')).toEqual([NO_VERSION, NO_NAME])
    const found = messages({
      'evals/a/case.yaml': 'name: a',
      'evals/b/case.yaml': 'schema_version: "1.1"',
    })
    expect(found).toEqual([NO_VERSION.replace('first', 'a'), NO_NAME.replace('first', 'b')])
  })

  check('stays silent for a valid case.yaml, with or without a context', () => {
    expect(yaml(GOOD)).toEqual([])
    expect(yaml(`${GOOD}tags: [smoke]\ncontext: {}\nexecution:\n  max_turns: 5\n`)).toEqual([])
  })

  check('reports a scaffold script that is not there, and stays silent for one that is', () => {
    const context = 'context:\n  scaffold_script: fixture.sh\n'
    expect(yaml(GOOD + context)).toEqual([MISSING('scaffold_script', 'fixture.sh')])
    expect(yaml(GOOD + context, { 'evals/first/fixture.sh': '#!/bin/sh\n' })).toEqual([])
  })

  check('reports a history file that is not there, and stays silent for one that is', () => {
    const context = 'context:\n  history_file: history/run.jsonl\n'
    expect(yaml(GOOD + context)).toEqual([MISSING('history_file', 'history/run.jsonl')])
    expect(yaml(GOOD + context, { 'evals/first/history/run.jsonl': '{}\n' })).toEqual([])
  })

  check('reports each add_dirs entry that is not there', () => {
    const context = 'context:\n  add_dirs: [resources, other, "./nested/dir"]\n'
    expect(yaml(GOOD + context, { 'evals/first/other/x.txt': 'x' })).toEqual([
      MISSING('add_dirs', 'resources'),
      MISSING('add_dirs', './nested/dir'),
    ])
    const files = { 'evals/first/resources/a.txt': 'x', 'evals/first/nested/dir/b.txt': 'x' }
    expect(yaml(GOOD + context.replace(', other', ''), files)).toEqual([])
  })

  check('reports a path that leaves the case directory, also when it exists', () => {
    const files = { 'evals/shared.sh': '#!/bin/sh\n', 'outside.sh': '#!/bin/sh\n' }
    expect(yaml(`${GOOD}context:\n  scaffold_script: ../shared.sh\n`, files)).toEqual([
      OUTSIDE('scaffold_script', '../shared.sh'),
    ])
    expect(yaml(`${GOOD}context:\n  history_file: /etc/hosts\n`, files)).toEqual([
      OUTSIDE('history_file', '/etc/hosts'),
    ])
    expect(yaml(`${GOOD}context:\n  add_dirs: [../../.claude-plugin, a/../../x]\n`, files)).toEqual(
      [OUTSIDE('add_dirs', '../../.claude-plugin'), OUTSIDE('add_dirs', 'a/../../x')],
    )
  })

  check('stays silent for a path that goes up and comes back into the case directory', () => {
    const files = { 'evals/first/fixture.sh': 'x' }
    expect(yaml(`${GOOD}context:\n  scaffold_script: a/../fixture.sh\n`, files)).toEqual([])
    expect(yaml(`${GOOD}context:\n  add_dirs: [.]\n`)).toEqual([])
  })

  check('stays silent for an empty path, entries that are not strings, and odd shapes', () => {
    expect(
      yaml(
        `${GOOD}context:\n  scaffold_script: ""\n  history_file:\n  add_dirs: [5, null, {a: b}]\n`,
      ),
    ).toEqual([])
    expect(
      yaml(`${GOOD}context:\n  scaffold_script: 5\n  history_file: [a]\n  add_dirs: resources\n`),
    ).toEqual([])
    expect(yaml(`${GOOD}context: [a]\n`)).toEqual([])
    expect(yaml(`${GOOD}context: x\n`)).toEqual([])
    expect(yaml(`${GOOD}context:\n`)).toEqual([])
  })

  check('stays silent for a YAML text that does not parse or is not a map', () => {
    expect(yaml('name: [')).toEqual([])
    expect(yaml('- a\n- b\n')).toEqual([])
    expect(yaml('just text')).toEqual([])
    expect(yaml('')).toEqual([])
    expect(yaml('a: 1\na: 2\n')).toEqual([])
  })

  check('reads the case.yaml of a case that holds a prompt.md, and of a nested group', () => {
    expect(messages({ 'evals/g/h/case.yaml': 'name: x', 'evals/g/h/prompt.md': 'x' })).toHaveLength(
      1,
    )
  })

  check(
    'does not read a case.yaml below a case, in mocks or results, or outside the eval directory',
    () => {
      const text = 'name: x'
      expect(messages({ 'evals/first/prompt.md': 'x', 'evals/first/sub/case.yaml': text })).toEqual(
        [],
      )
      expect(
        messages({ 'evals/mocks/s/case.yaml': text, 'evals/results/t/case.yaml': text }),
      ).toEqual([])
      expect(messages({ 'other/first/case.yaml': text, 'case.yaml': text })).toEqual([])
      expect(messages({ 'evals/first/prompt.md': 'x' })).toEqual([])
    },
  )

  check('reads the eval directory of experimental.evals', () => {
    const manifest = { name: 'p', experimental: { evals: 'qa/e' } }
    const files = { 'qa/e/first/case.yaml': 'name: x', 'evals/first/case.yaml': 'name: x' }
    expect(messages(files, manifest)).toEqual([NO_VERSION.replace('evals/first', 'qa/e/first')])
  })

  check('stays silent when there is no eval directory', () => {
    expect(messages({ 'README.md': 'x' })).toEqual([])
  })

  check('stays silent when the manifest is in no plugin root', () => {
    const top = tree({ [CASE]: 'name: x' })
    const found = lintPlugin(RULE, path.join(top, 'p'), '{"name": "p"}')
    expect(found).toEqual([])
  })

  linked('reports a link that leaves the case directory for a place in the repository', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      { [CASE]: `${GOOD}context:\n  scaffold_script: run.sh\n`, 'scripts/run.sh': 'x' },
    )
    link(dir, 'evals/first/run.sh', '../../scripts/run.sh')
    expect(lintPlugin(RULE, dir, code).map((m) => m.message)).toEqual([
      OUTSIDE('scaffold_script', 'run.sh'),
    ])
  })

  linked('stays silent for a link that leaves the repository or leads nowhere', () => {
    const outside = tree({ 'run.sh': 'x' }, false)
    const { dir, code } = pluginTree(
      { name: 'p' },
      { [CASE]: `${GOOD}context:\n  scaffold_script: run.sh\n  history_file: gone.jsonl\n` },
    )
    link(dir, 'evals/first/run.sh', path.join(outside, 'run.sh'))
    link(dir, 'evals/first/gone.jsonl', 'nowhere.jsonl')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked(
    'stays silent for a link below the case directory that leads out of the repository',
    () => {
      const outside = tree({ 'x/run.sh': 'x' }, false)
      const { dir, code } = pluginTree(
        { name: 'p' },
        { [CASE]: `${GOOD}context:\n  scaffold_script: sub/run.sh\n` },
      )
      link(dir, 'evals/first/sub', path.join(outside, 'x'))
      expect(lintPlugin(RULE, dir, code)).toEqual([])
    },
  )

  linked('reads a case.yaml that is a link to a file in the repository', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      { 'src/case.yaml': 'name: x', 'evals/first/prompt.md': 'x' },
    )
    link(dir, 'evals/first/case.yaml', '../../src/case.yaml')
    expect(lintPlugin(RULE, dir, code)).toHaveLength(1)
  })

  linked('stays silent for a case.yaml that is a link out of the repository', () => {
    const outside = tree({ 'case.yaml': 'name: x' }, false)
    const { dir, code } = pluginTree({ name: 'p' }, { 'evals/first/prompt.md': 'x' })
    link(dir, 'evals/first/case.yaml', path.join(outside, 'case.yaml'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent when the root of the plugin links out of the repository', () => {
    const outside = tree(
      { [CASE]: 'name: x', '.claude-plugin/plugin.json': '{"name": "p"}' },
      false,
    )
    const top = tree({})
    link(top, 'plug', outside)
    expect(lintPlugin(RULE, path.join(top, 'plug'), '{"name": "p"}')).toEqual([])
  })

  linked('stays silent when the eval directory links out of the repository', () => {
    const outside = tree({ 'first/case.yaml': 'name: x' }, false)
    const { dir, code } = pluginTree({ name: 'p' })
    link(dir, 'evals', outside)
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('stays silent for a case.yaml that is a directory or larger than 1 MiB', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      { 'evals/big/case.yaml': `name: ${'x'.repeat(1_048_577)}` },
    )
    mkdirSync(path.join(dir, 'evals/dir/case.yaml'), { recursive: true })
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('reads a case.yaml of exactly 1 MiB', () => {
    const body = 'name: '
    const text = body + 'x'.repeat(1_048_576 - body.length)
    expect(messages({ 'evals/big/case.yaml': text })).toHaveLength(1)
  })

  const unreadable = chmodCannotBlock ? it.skip : check
  unreadable('stays silent for a case.yaml that cannot be read', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { [CASE]: 'name: x' })
    const found = withoutAccess(path.join(dir, CASE), () => lintPlugin(RULE, dir, code))
    expect(found).toEqual([])
  })

  unreadable('stays silent for a case directory that cannot be listed', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { [CASE]: 'name: x' })
    const found = withoutAccess(path.join(dir, 'evals/first'), () => lintPlugin(RULE, dir, code))
    expect(found).toEqual([])
  })
})
