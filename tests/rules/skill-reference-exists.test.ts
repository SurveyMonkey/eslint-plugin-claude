// A relative link in a `SKILL.md`, or a backticked path that starts with
// `${CLAUDE_SKILL_DIR}/`, must name a file in the skill folder. The folders
// are on disk under tests/fixtures/skill-reference-exists/: `summarize` holds
// the supporting files of the docs example, and `plugin` is a plugin with a
// skill and a root skill.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  chmodCannotBlock,
  lintMarkdown,
  markdownTester,
  ruleOf,
  withoutAccess,
} from '../rule-tester.test-support.ts'

const fixtures = path.join(import.meta.dirname, '../fixtures/skill-reference-exists')
const skill = path.join(fixtures, 'project', '.claude', 'skills', 'summarize', 'SKILL.md')
const deploy = path.join(fixtures, 'plugin', 'skills', 'deploy', 'SKILL.md')
const pluginRoot = path.join(fixtures, 'plugin', 'SKILL.md')
// Escaped, so that the template keeps the variable as text.
const skillDir = `\${CLAUDE_SKILL_DIR}`

const body = (text: string, filename = skill) => ({ code: `# S\n\n${text}\n`, filename })

markdownTester.run('skill-reference-exists', ruleOf('skill-reference-exists'), {
  valid: [
    // The example of the "Add supporting files" docs section.
    {
      code: '## Additional resources\n\n- For complete API details, see [reference.md](reference.md)\n- For usage examples, see [examples.md](examples.md)\n',
      filename: skill,
    },
    body('[a](./reference.md) [b](scripts/helper.py) [c](scripts/) [d](scripts/../examples.md)'),
    body('[a](reference.md#top) [b](reference.md?raw=1) [c](my%20file.md) [d](<my file.md>)'),
    body('![n](assets/notes.txt)'),
    body('[ref]: reference.md\n\nSee [ref].'),
    body(`Run \`${skillDir}/scripts/render.sh <csv-file>\` and \`${skillDir}/reference.md\`.`),
    body(`[r](${skillDir}/reference.md)`),
    // Not a path to a file in the folder: URL, anchor, absolute, home, drive, placeholder.
    body('[u](https://example.com/x.md) [m](mailto:a@example.com) [p](//example.com/x.md)'),
    body('[a](#section) [b](#) [c]()'),
    body('[a](/etc/hosts) [b](~/x.md) [c](C:\\x.md) [d](\\\\host\\x.md)'),
    body(
      '[g](docs/{a.md) [h](docs/a}.md) [e](docs/{a,b}.md) [f](docs/{a}.md) [a](<https://example.com/x>) [b](docs/*.md) [c]($HOME/x.md) [d](a|b.md)',
    ),
    // A path out of the skill folder is not the rule's to check.
    body('[a](../shared/other.md) [b](../missing.md) [c](../../../../../missing.md) [d](..)'),
    body('[a](.) [b](./) [c](scripts/..)'),
    // Fenced code is an example, not a link.
    body(`\`\`\`markdown\n[a](missing.md)\n\`${skillDir}/missing.sh\`\n\`\`\``),
    body('~~~\n[a](missing.md)\n~~~'),
    // A backticked word is not a path, even with a slash or an extension.
    body('Edit `src/index.ts`, `missing.md`, `./missing.sh`, `scripts/missing.py` and `a/b`.'),
    body('Run `./gradlew test` and `npm run build`.'),
    body(`Use \`echo ${skillDir}\` and \`python3 ${skillDir}/scripts/missing.py\`.`),
    body('Use `` and ` ` here.'),
    // Frontmatter is not body text.
    {
      code: '---\ndescription: See [x](missing.md)\n---\n\n# S\n',
      filename: skill,
    },
    // Bad frontmatter does not stop the rule, and a good body stays silent.
    { code: '---\nname: [unclosed\n---\n\n[a](reference.md)\n', filename: skill },
    // A plugin skill, and a plugin-root skill (its folder is the plugin root).
    body('[a](reference.md) [b](./reference.md)', deploy),
    body('[a](docs/guide.md)', pluginRoot),
    // Not a skill file: a `SKILL.md` outside a skills directory, a command file, other Markdown.
    body('[a](missing.md)', path.join(fixtures, 'docs', 'SKILL.md')),
    body('[a](missing.md)', path.join(fixtures, 'project', '.claude', 'commands', 'c.md')),
    body('[a](missing.md)', path.join(fixtures, 'docs', 'README.md')),
  ],
  invalid: [
    {
      ...body('See [more](missing.md) here.'),
      errors: [
        { messageId: 'missing', data: { target: 'missing.md' }, line: 3, column: 5, endColumn: 23 },
      ],
    },
    // A name that starts with two dots is in the folder.
    {
      ...body('[a](..hidden.md)'),
      errors: [{ messageId: 'missing', data: { target: '..hidden.md' } }],
    },
    {
      ...body('[a](./nested/missing.md)'),
      errors: [{ messageId: 'missing', data: { target: './nested/missing.md' } }],
    },
    {
      ...body('[a](scripts/missing.py)'),
      errors: [{ messageId: 'missing', data: { target: 'scripts/missing.py' } }],
    },
    // A fragment or a query is not part of the path.
    {
      ...body('[a](missing.md#top) [b](missing.md?raw=1)'),
      errors: [
        { messageId: 'missing', data: { target: 'missing.md' } },
        { messageId: 'missing', data: { target: 'missing.md' } },
      ],
    },
    // A name with a percent sequence that does not decode is read as written.
    {
      ...body('[a](100%.md) [b](%E0%A4%A.md)'),
      errors: [
        { messageId: 'missing', data: { target: '100%.md' } },
        { messageId: 'missing', data: { target: '%E0%A4%A.md' } },
      ],
    },
    {
      ...body('![d](assets/missing.png)'),
      errors: [{ messageId: 'missing', data: { target: 'assets/missing.png' } }],
    },
    {
      ...body('[ref]: missing.md\n\nSee [ref].'),
      errors: [{ messageId: 'missing', data: { target: 'missing.md' }, line: 3 }],
    },
    {
      ...body(`Run \`${skillDir}/scripts/missing.sh <arg>\`.`),
      errors: [
        { messageId: 'missing', data: { target: 'scripts/missing.sh' }, line: 3, column: 5 },
      ],
    },
    {
      ...body(`[a](${skillDir}/missing.md)`),
      errors: [{ messageId: 'missing', data: { target: 'missing.md' } }],
    },
    // Bad frontmatter does not stop the rule.
    {
      code: '---\nname: [unclosed\n---\n\n[a](missing.md)\n',
      filename: skill,
      errors: [{ messageId: 'missing', line: 5 }],
    },
    // The folder of a plugin skill, and of a plugin-root skill.
    {
      ...body('[a](missing.md)', deploy),
      errors: [{ messageId: 'missing', data: { target: 'missing.md' } }],
    },
    {
      ...body('[a](reference.md)', pluginRoot),
      errors: [{ messageId: 'missing', data: { target: 'reference.md' } }],
    },
    // A file of the sibling skill is not in this folder.
    {
      ...body('[a](other.md)', deploy),
      errors: [{ messageId: 'missing' }],
    },
  ],
})

// A read that fails with `EACCES` is not a missing file. The rule makes no report for a
// target that it cannot reach, and still reports a target that is absent.
describe.skipIf(chmodCannotBlock)('a path that the rule cannot read', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'skill-reference-exists-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))
  const folder = path.join(scratch, '.claude', 'skills', 's')
  const file = path.join(folder, 'SKILL.md')
  mkdirSync(path.join(folder, 'refs'), { recursive: true })
  writeFileSync(path.join(folder, 'refs', 'a.md'), '')
  const lint = (link: string) => lintMarkdown('skill-reference-exists', `# S\n\n${link}\n`, file)

  it('makes no report for a target in a directory that it cannot search', () => {
    expect(lint('[a](refs/missing.md)')).toHaveLength(1)
    withoutAccess(path.join(folder, 'refs'), () => {
      expect(lint('[a](refs/a.md)')).toEqual([])
      expect(lint('[a](refs/missing.md)')).toEqual([])
    })
  })

  it('makes no report for a target that exists but has no read mode', () => {
    withoutAccess(path.join(folder, 'refs', 'a.md'), () =>
      expect(lint('[a](refs/a.md)')).toEqual([]),
    )
    expect(lint('[a](refs/a.md)')).toEqual([])
  })

  it('makes no report for a skill folder that it cannot search', () => {
    withoutAccess(folder, () => expect(lint('[a](refs/a.md)')).toEqual([]))
  })

  it.skipIf(process.platform === 'win32')('reports a dangling link, which is absent', () => {
    symlinkSync('nowhere.md', path.join(folder, 'dangling.md'))
    expect(lint('[a](dangling.md)')).toHaveLength(1)
  })
})
