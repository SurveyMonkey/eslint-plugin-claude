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

/** Whether `dir` is a plugin root. The result is `UNREADABLE` when the check
 *  cannot see: a read of `.claude-plugin/` fails for a reason other than a
 *  missing file, or `.claude-plugin/` has a real path out of the repository
 *  (ADR 001, Decision 14). A caller makes no report on such a directory, and
 *  does not use the local logic of an outer `.claude/` directory. A
 *  directory that is not a plugin root gives false.
 *
 *  A `.claude-plugin/plugin.json` entry makes a plugin root. The check
 *  follows no link at that last step, so a link to any target counts, and a
 *  dangling link too. `readManifest` is the function that reads the content. */
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
