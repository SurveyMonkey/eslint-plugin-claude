// A frontmatter block can hold no field: it is empty, or it holds only
// comments. `parseFrontmatter` gives null for it, as it does for bad YAML.
// A rule that reports a missing field asks here to tell the two apart.
import { parse } from 'yaml'

/** True when the text is valid YAML with no content, such as an empty block or
 *  one with only comments. Such a block has no field. */
export function isEmptyBlock(text: string): boolean {
  try {
    return parse(text) === null
  } catch {
    return false
  }
}
