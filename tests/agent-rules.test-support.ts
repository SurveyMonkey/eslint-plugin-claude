// A lint run of one plugin rule over an agent file, with rule options. The rule
// is looked up in the plugin by name, so a test for a rule that does not exist
// yet fails with a report and not with an import error. `lintMarkdown` in
// `rule-tester.test-support.ts` takes no options.
import path from 'node:path'
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import plugin from '../src/index.ts'

/** The messages of the rule `name` with `options` for `code` at the absolute path `filename`. */
export function lintAgent(name: string, code: string, filename: string, options: unknown[] = []) {
  return new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.md'],
        plugins: { markdown, claude: plugin },
        language: 'markdown/gfm',
        languageOptions: { frontmatter: 'yaml' },
        rules: { [`claude/${name}`]: ['error', ...options] },
      },
    ],
    { filename },
  )
}
