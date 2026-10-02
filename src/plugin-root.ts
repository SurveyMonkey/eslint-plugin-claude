// Find out if a directory is the root of a Claude Code plugin. A glob cannot
// see a sibling file, so a rule that needs plugin context asks here.
import { lstatSync } from 'node:fs'
import path from 'node:path'
import {
  failure,
  isInside,
  realOf,
  repositoryRoot,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

/** True when `dir` is a plugin root, false when it is not, and `UNREADABLE`
 *  when the check cannot see. The check cannot see in two cases. A read of
 *  `.claude-plugin/` fails for a reason other than a missing file. Or
 *  `.claude-plugin/` has a real path out of the repository (ADR 001,
 *  Decision 14). A caller makes no report on such a directory. It does not
 *  use the local logic of an outer `.claude/` directory.
 *
 *  `UNREADABLE` is a truthy symbol. Test the result with `=== true`, or
 *  compare it to `UNREADABLE` first.
 *
 *  A `.claude-plugin/plugin.json` entry makes a plugin root. The check
 *  follows no link at that last step, so a link to any target counts, and a
 *  dangling link too. `readManifest` reads the content. */
export function isPluginRoot(dir: string): boolean | Unreadable {
  const real = realOf(path.join(dir, '.claude-plugin'))
  if (typeof real !== 'string') {
    return real ?? false
  }
  if (!isInside(real, repositoryRoot(dir))) {
    return UNREADABLE
  }
  try {
    lstatSync(path.join(real, 'plugin.json'))
    return true
  } catch (error) {
    return failure(error) ?? false
  }
}
