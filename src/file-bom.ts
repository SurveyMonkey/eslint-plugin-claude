// The byte order mark at the start of a file on disk. ESLint removes the mark before a rule sees
// the text, so a rule that checks for it reads the first bytes of the file.
import { closeSync, openSync, readSync } from 'node:fs'

// The UTF-8 form of U+FEFF.
const BOM = Buffer.from([0xef, 0xbb, 0xbf])

/** True when the file `file` starts with the three bytes of a UTF-8 byte order mark. A file that
 *  the rule cannot read gives false. The caller decides if the rule can read the file at all. */
export function startsWithBom(file: string): boolean {
  const head = Buffer.alloc(BOM.length)
  try {
    const fd = openSync(file, 'r')
    try {
      readSync(fd, head, 0, head.length, 0)
    } finally {
      closeSync(fd)
    }
  } catch {
    return false
  }
  return head.equals(BOM)
}
