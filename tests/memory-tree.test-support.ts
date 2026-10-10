// A repository on disk, for a rule that reads a file next to the linted file.
// `tree` and `link` come from the marketplace helper: each tree is a real
// directory in a temporary directory, with or without a `.git` directory.
// `lintMemory` runs one rule over one instruction file of a tree through
// `Linter`, because the case must build the file system around the lint.
import path from 'node:path'
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import plugin from '../src/index.ts'

export { link, noLinks, tree } from './marketplace-tree.test-support.ts'

/** The messages of the rule `name` for the text `code` of the file `file`,
 *  which is in the tree `dir`. The rule `name` is the only rule that runs. */
export function lintMemory(
  name: string,
  dir: string,
  file: string,
  code: string,
  options?: object,
) {
  const filename = path.join(dir, file)
  return new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.md'],
        plugins: { markdown, claude: plugin },
        language: 'markdown/gfm',
        languageOptions: { frontmatter: 'yaml' },
        rules: { [`claude/${name}`]: options === undefined ? 'error' : ['error', options] },
      },
    ],
    { filename },
  )
}
