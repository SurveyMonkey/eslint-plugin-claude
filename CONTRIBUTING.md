# Contributing

## Development

Development runs on Node 22.18.0, and pnpm at the version in `packageManager` in `package.json`.
22.18.0 is the lowest version that runs a `.ts` file with no flag. `.nvmrc` and `devEngines.runtime`
in `package.json` both pin it. The CI checks and the docs watch install it from `devEngines`, and
pnpm warns on any other version.

The published package needs Node `^22.13.0 || >=24` (`engines`), the same range as ESLint 10. It
ships JavaScript only. The CI test jobs run on 22.13.0, 24 and 26.

```sh
pnpm install     # also installs the lefthook git hooks
pnpm test        # vitest, 100% coverage required
pnpm typecheck   # tsc, no emit
pnpm lint        # biome ci
pnpm knip        # builds, then finds unused files, exports and dependencies
pnpm build       # tsc -p tsconfig.build.json, writes dist/
pnpm publint     # builds, then checks the packed package.json and exports
```

Source is TypeScript in `src/`. Imports name the `.ts` extension, and the build rewrites it to
`.js`. Only `dist/`, `README.md`, `LICENSE` and `package.json` are published.

The pre-commit hooks (`lefthook.yml`) sort a staged `package.json`, then run Biome, tsc and the
Vitest tests related to the staged files. CI runs every check again, and the "Require CI" and
"Require CodeQL" rulesets require each one on `main`.

## Design docs

- [Rule inventory](docs/rules-inventory.md): the candidate rules, with a group, a preset, a
  severity and a docs source for each.
- [ADR 001](docs/adr/001-eslint-plugin-for-claude-config.md): why this is an ESLint plugin on
  `@eslint/markdown` and `@eslint/json`. See the [ADR index](docs/adr/index.md) for later ADRs.

The Rules section of `README.md` has one table for each group of the rule inventory. Add a new
rule to the table of its group. The first rule of a group adds a `###` heading and a table for
that group. Keep the groups in the order of the inventory.

## Rule source map

`docs/rule-sources.json` lists the pages and headings of the Claude Code docs that are the
source of each rule in `src/rules/`. Each source has a `url` on `code.claude.com/docs` and a `heading`. The
docs watch sets a `hash` on each source. Do not set `hash` by hand. `pnpm docs:seed` keeps a
`hash` when the `url` and `heading` stay the same.

A new rule needs an entry. Add the docs links to the footnotes of `docs/rules/<rule>.md`. Then
run `pnpm docs:seed`, and then `pnpm docs:update`. Commit `docs/rule-sources.json` and
`docs/docs-snapshot/`. `pnpm docs:seed` makes no network call. `pnpm docs:update` runs
`node scripts/docs-watch.ts update`. It fetches the live docs and sets `hash` on each new source.
It also rewrites the snapshot of each page that the map cites. So it takes in each docs change
that nobody has triaged. Read the diff, and name each such change in the pull request.

Write each footnote on one line, as `[^id]: [Page title: Heading](url#anchor)`. Put no indent,
link title or text after the link. The script takes the text after the first colon and space
as the heading. The whole label is the heading when the link has no anchor, or when the label
has no colon and space. The script skips a link to a site other than claude.com, claude.ai or
anthropic.com.

The script stops with an error for a footnote that it cannot read. It also stops for a link to
claude.com, claude.ai or anthropic.com that is not under `https://code.claude.com/docs/`.

`tests/rule-sources.test.ts` runs in `pnpm test`. It fails in these cases:

- A rule has no entry.
- An entry has no rule file, or has no source.
- A source has no heading.
- A URL is not on `code.claude.com/docs`.
- The map is not the same as the output of the script.
- A source has no `hash`.
- A `hash` is not a SHA-256 hex string, or is not the hash that `docs/docs-snapshot/` stores for
  that heading.

## Docs watch

`.github/workflows/docs-watch.yml` runs every day and on `workflow_dispatch`. It commits nothing.
It runs `node scripts/docs-watch.ts check`, which fetches each page that the map cites (URL plus
`.md`) and compares it with `docs/docs-snapshot/`. When a page changed or the check failed, it
classifies the change and opens issues (see [Docs classifier](#docs-classifier)).

- `check` (the default) writes no file. It prints a JSON report to stdout, and a Markdown report
  to the run summary. For each changed page, it lists the blocks that changed, were added or were
  removed. It also counts the blocks that did not change.
- `check` exits 0 when a page changed, so a person must read the run summary. It exits 1 when a
  fetch or parse fails, or when the map cites no page. It exits 1 when a mapped heading is not on
  its page, or is on it more than once. It exits 1 for an unknown option, or for a map or
  snapshot file that it cannot read. A missing snapshot is not a failure: every page is then new.
- `update` writes the snapshot and sets `hash` on each source in the map. A person runs it, in a
  pull request. The scheduled job never runs it.

A block is a heading and its text, up to the next heading of any level. A heading is a Markdown
heading, or an HTML heading. The live pages write an HTML heading as three lines: `<h2 id="x">`,
the title, and `</h2>`. Each tag is alone on its line, and the title has at most five lines. A
line that looks like any other form of an HTML heading is an error, as is a code fence that is
never closed. Setext headings and indented Markdown headings are not supported.

The ID of an HTML heading is its `id` attribute. The ID of a Markdown heading is the heading text
without inline Markdown, in lowercase. It has no punctuation, a hyphen for each space, and a
hyphen for each dot.

A second block with the same ID gets a number suffix, such as `-1`. A heading in a code fence
starts no block. A heading at level 1 makes the whole page the source. A mapped heading is the
title that the page shows, for example "Choose where skills load". The script finds its block by
the ID. When no block has that ID, it finds the block by the slug of the title.

To refresh the snapshot after a docs change, run `node scripts/docs-watch.ts update`. Read the
diff of `docs/docs-snapshot/` and `docs/rule-sources.json`. Commit both in a pull request. The
command makes read-only network calls.

## Docs classifier

`node scripts/docs-classify.ts` reads each cited page again and asks TypeSafe Jev about each
changed, added or removed block. It needs the `TYPESAFE_API_KEY` secret when a block needs a
call. It prints the findings as JSON: `rule-update`, `rule-removal`, `new-rule` or
`needs-triage`. An error or an unclear answer gives `needs-triage`. These fail the job: a map
that cites no page, a failed docs fetch, a page that the block split cannot read, and a page with
no title.
[ADR 002](docs/adr/002-classify-docs-changes-with-jev.md) records the questions, the thresholds
and the spike data.

`node scripts/docs-issues.ts <findings.json>` opens one issue for each changed block, as the org
GitHub App. It uses a token with `permission-issues: write` only. A hidden marker with the block
hash and the rules stops a second issue for the same change. For a changed block, the body shows
a diff, then the full old and new sections in two collapsed parts. `--dry-run` prints each issue
and opens none. A manual run of the workflow takes a `dry_run` input.

To triage the issues, follow the [docs watch triage runbook](docs/runbooks/docs-watch-triage.md).

## Commits and pull requests

Pull requests are squash-merged, so the pull request title becomes the commit on `main`. Use
[Conventional Commits](https://www.conventionalcommits.org/) for it: release-please reads these
titles to pick the next version and write the changelog.

## Releases

[release-please](https://github.com/googleapis/release-please) reads the Conventional Commit
titles on `main` and opens a release pull request. It acts as an org GitHub App (secrets
`RELEASE_APP_CLIENT_ID` and `RELEASE_APP_PRIVATE_KEY`), so CI runs on that pull request.
Merging it tags the release, and `.github/workflows/release.yml` publishes to npm through
[trusted publishing](https://docs.npmjs.com/trusted-publishers). There is no npm token secret.
