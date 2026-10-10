// The agent and skill names that a project settings file can reach in the repository that holds
// it. A name lives in the `.claude/` folder of the project, or in one of the `.claude/` folders
// above the project, up to the repository root. A rule reads no file out of the repository
// (ADR 001, Decision 14). A name may be out of sight, so the result says so, and a rule makes no
// report that rests on a name that it cannot see. A user folder, a plugin and a folder added with
// `--add-dir` are not in the repository.
import path from 'node:path'
import {
  danglingOf,
  entriesOf,
  frontmatterOfFile,
  isInside,
  markdownFiles,
  realDirectory,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from './skill-tree.ts'

/** The names that a scan found. `unseen` is true when a name can be out of sight. These are the
 *  cases. A directory of the walk has a real path out of the repository. A link leads out of the
 *  repository. A link has no target. A path is not readable. */
export interface Names {
  names: string[]
  unseen: boolean
}

/** True when the rule cannot see `entry`: a link that leads out of `bound`, a link with no
 *  target, or a path that does not read. A path that is not there is seen. */
function isUnseen(entry: string, bound: string): boolean {
  const real = realOf(entry)
  if (real === null) {
    return danglingOf(entry) !== null
  }
  return real === UNREADABLE || !isInside(real, bound)
}

/** `start` and each directory above it, up to the real path `top`. The walk goes up the path as
 *  given. A directory counts when its real path is at or below `top`. A directory with a real
 *  path out of `top` is not in the chain, and `skipped` is true. The walk stops at the directory
 *  with the real path `top`. That directory is a parent of the path as given, so a link in the
 *  chain does not carry the walk above the repository. Each step only resolves a path, and reads
 *  no file. */
function ancestors(start: string, top: string): { chain: string[]; skipped: boolean } {
  const chain: string[] = []
  let skipped = false
  // The loop ends at the root of the file system, where `path.dirname` returns its argument.
  for (let at = start, last = ''; at !== last; last = at, at = path.dirname(at)) {
    const real = realDirectory(at)
    if (isInside(real, top)) {
      chain.push(at)
    } else {
      skipped = true
    }
    if (real === top) {
      break
    }
  }
  return { chain, skipped }
}

/** Visit the `.claude/` folder of the project and of each directory above it. `claudeDir` is the
 *  `.claude/` folder of the settings file. */
function collect(claudeDir: string, visit: (claude: string, bound: string, found: Names) => void) {
  const project = path.dirname(claudeDir)
  const bound = repositoryRoot(claudeDir)
  const walk = ancestors(project, repositoryRoot(project))
  const found: Names = { names: [], unseen: walk.skipped }
  for (const dir of walk.chain) {
    const claude = path.join(dir, '.claude')
    if (isUnseen(claude, bound)) {
      found.unseen = true
    } else {
      visit(claude, bound, found)
    }
  }
  return found
}

/** The `name` field of the frontmatter of `file`, if it is a string. A file that the rule cannot
 *  read sets `unseen`. */
function givenName(file: string, found: Names): string | undefined {
  const fields = frontmatterOfFile(file)
  if (fields === UNREADABLE) {
    found.unseen = true
    return undefined
  }
  return typeof fields?.name === 'string' ? fields.name : undefined
}

/** Add the `.md` files of `folder` to the scan result, with the name that `nameOf` gives each. */
function addMarkdown(
  folder: string,
  bound: string,
  found: Names,
  nameOf: (file: string) => string | undefined,
) {
  const scan = markdownFiles(folder, bound)
  found.unseen ||= isUnseen(folder, bound) || scan.outside || scan.unreadable
  for (const file of scan.files) {
    const given = nameOf(file)
    if (given !== undefined) {
      found.names.push(given)
    }
  }
}

/** The names of the agents of `.claude/agents/` in the project and above it. The name of an agent
 *  is the `name` field of its frontmatter. */
export function agentNames(claudeDir: string): Names {
  return collect(claudeDir, (claude, bound, found) => {
    addMarkdown(path.join(claude, 'agents'), bound, found, (file) => givenName(file, found))
  })
}

/** The names of the skills and commands in the project and above it. Each entry of
 *  `.claude/skills/` has its own name, a plain file included. A skill folder also has the `name`
 *  field of its `SKILL.md`. A command file of `.claude/commands/` has its file name. A file in a
 *  subfolder of `commands/` gives no name, as the caller does not look up a name with a colon. */
export function skillNames(claudeDir: string): Names {
  return collect(claudeDir, (claude, bound, found) => {
    const skills = path.join(claude, 'skills')
    const entries = entriesOf(skills)
    found.unseen ||= isUnseen(skills, bound) || entries === UNREADABLE
    for (const entry of Array.isArray(entries) ? entries : []) {
      const folder = path.join(skills, entry.name)
      if (isUnseen(folder, bound)) {
        found.unseen = true
        continue
      }
      found.names.push(entry.name)
      const file = path.join(folder, 'SKILL.md')
      // A `SKILL.md` that is a link out of the repository, or a link with no target, can hold a
      // name that the rule cannot see.
      if (isUnseen(file, bound)) {
        found.unseen = true
        continue
      }
      const given = givenName(file, found)
      if (given !== undefined) {
        found.names.push(given)
      }
    }
    const commands = path.join(claude, 'commands')
    addMarkdown(commands, bound, found, (file) =>
      path.dirname(file) === commands ? path.basename(file, '.md') : undefined,
    )
  })
}
