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
pnpm lint        # biome ci, then eslint on src/rules/
pnpm knip        # builds, then finds unused files, exports and dependencies
pnpm build       # tsc -p tsconfig.build.json, writes dist/
pnpm publint     # builds, then checks the packed package.json and exports
pnpm docs:generate  # builds, then writes the generated parts of the docs
pnpm docs:check     # builds, then fails when a generated part is out of date
```

Source is TypeScript in `src/`. Imports name the `.ts` extension, and the build rewrites it to
`.js`. Only `dist/`, `README.md`, `LICENSE` and `package.json` are published.

`pnpm lint` runs Biome on the source. Then ESLint, with `eslint-plugin-eslint-plugin`, checks the
rule definitions in `src/rules/` (`eslint.config.mjs`, ADR 001 Decision 7). Each schema option
needs a `description`. A rule with a schema option needs `meta.defaultOptions`, and `create`
reads each default from it. `pnpm docs:generate` writes the options list of each rule doc from
`meta` (ADR 003). `tests/default-options.test.ts` checks the descriptions of a schema that a rule
imports, which the lint cannot see. Each module in `src/rules/` ends with `export default rule`.
If a module does not, the lint finds no rule in it, and checks nothing
(`tests/rule-export-last.test.ts`).

The pre-commit hooks (`lefthook.yml`) sort a staged `package.json`, then run Biome, tsc and the
Vitest tests related to the staged files. CI runs every check again, and the "Require CI" and
"Require CodeQL" rulesets require each one on `main`.

## Design docs

- [Rule inventory](docs/rules-inventory.md): the candidate rules, with a group, a preset, a
  severity and a docs source for each.
- [ADR 001](docs/adr/001-eslint-plugin-for-claude-config.md): why this is an ESLint plugin on
  `@eslint/markdown` and `@eslint/json`. See the [ADR index](docs/adr/index.md) for later ADRs.

eslint-doc-generator writes the rule list in the Rules section of `README.md`. It also writes the
header and options list of each rule doc
([ADR 003](docs/adr/003-generate-rule-docs-with-eslint-doc-generator.md)). Do not edit these
parts by hand. Add a new rule to the list of its group in `.eslint-doc-generatorrc.mjs`. Then
run `pnpm docs:generate`. The `docs` check fails when a generated part does not agree with the
code.

Under the generated header, each rule doc has a `| Category | Files |` table. The Files cell
gives the `files` globs of the rule. `tests/docs.test.ts` compares them.

Each rule doc has a `## Usage` section before `## Options`, or before `## Sources` when there is
no Options section. It gives the `rules` entry of the rule at its `recommended` severity. For a
rule that is off in `recommended`, it gives the `strict` severity.

## Rule source map

`docs/rule-sources.json` lists the pages and headings of the Claude Code docs that are the
source of each rule in `src/rules/`. Each source has a `url` on `code.claude.com/docs` and a
`heading`. The
docs watch sets a `hash` on each source. Do not set `hash` by hand. `pnpm docs:seed` keeps a
`hash` when the `url` and `heading` stay the same.

A new rule needs an entry. Add the docs links to the footnotes of `docs/rules/<rule>.md`. Then
run `pnpm docs:seed`, and then `pnpm docs:update`. Commit `docs/rule-sources.json` and
`docs/docs-snapshot/`. `pnpm docs:seed` makes no network call. `pnpm docs:update` runs
`node scripts/docs-watch.ts update`. It fetches the live docs and sets `hash` on each new source.
It also rewrites the snapshot of each page that the map cites. So it takes in each docs change
that nobody has triaged. The `docs-snapshot` check of CI fails the pull request for such a
change (see [Docs snapshot check](#docs-snapshot-check)).

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

## Rule thresholds

A new rule that checks a number takes the number as a rule option (ADR 001, Decision 2).

- The option is optional. Its default is the value from the Claude Code docs, set in
  `meta.defaultOptions`. Where the docs give no number, the inventory row says so.
- Claude Code can cut or skip the file at a number. If no Claude Code setting moves that number,
  it is a hard limit. Set `maximum` in the option schema to the docs value. ESLint then refuses
  a larger value. Set no maximum where a setting moves the number.
- Where Claude Code acts at the default value, report with one message there. At another value,
  use a second message that names the value as the configured limit. Do not say that Claude Code
  acts at that value.
- Name the option and its default in the rule row of `docs/rules-inventory.md`, and in `meta`.
  `pnpm docs:generate` writes them in the options list of the rule doc, and marks the rule in
  the README list. The `recommended` and `strict` configs set no option.

`tests/limit-options.test.ts` reads the `limit` rows of the inventory. It fails for a built
rule that lacks the option that its row names.

## Docs watch

`.github/workflows/docs-watch.yml` runs every day and on `workflow_dispatch`. It commits nothing.
It runs `node scripts/docs-watch.ts check`, which fetches each page that the map cites (URL plus
`.md`) and compares it with `docs/docs-snapshot/`. When a page changed or the check failed, it
classifies the change, opens issues and posts comments (see [Docs classifier](#docs-classifier)).

- `check` (the default) writes no file. It prints a JSON report to stdout, and a Markdown report
  to the run summary. For each changed page, it lists the blocks that changed, were added or were
  removed. It also counts the blocks that did not change.
- `check` exits 0 when a page changed, so a person must read the run summary. It exits 1 when a
  fetch or parse fails, or when the map cites no page. An HTML heading with an `id` that has a
  character other than `a-z`, `0-9`, `_` or `-` is a parse failure. It exits 1 when a mapped
  heading is not on its page, or is on it more than once. It exits 1 when a `hash` in the map is
  not the hash of its source in the snapshot. It exits 1 for an unknown option, or for a map or
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

A snapshot file holds `url`, `hash`, `text`, `blocks` and `sources` for one page. `text` is the
page text with LF line ends, and `hash` is its hash. The classifier splits `text` into blocks to
get the old text of each block. `update` writes `text`. A file with no `text` stays valid, and
`check` does not read it. With `text`, the snapshot takes about 6.5 MB, from 2.4 MB before.

Each block has `id` (its key), `hash` (the hash of its text) and an optional `bodyHash`.
`bodyHash` is the SHA-256 of the block text after its heading. The heading of a Markdown block
is its first line. The heading of an HTML block is all its lines, from the opening tag to the
closing tag. Blank lines at the start of the body and white space at its end do not count. A
block with no body has no `bodyHash`.

`update` writes `bodyHash`. A file with no `bodyHash` stays valid, and `check` does not read
it. The classifier uses it to find a moved section (see [Docs classifier](#docs-classifier)).

To refresh the snapshot after a docs change, run `node scripts/docs-watch.ts update`. Read the
diff of `docs/docs-snapshot/` and `docs/rule-sources.json`. Commit both in a pull request. The
command makes read-only network calls.

### Docs snapshot check

The `docs-snapshot` job in `ci.yml` runs `node scripts/docs-verify.ts <base>` on each pull
request. It passes at once when the diff does not change `docs/docs-snapshot/` or
`docs/rule-sources.json`.

Else it compares the head snapshot with the base snapshot, for each page that the head map
cites. When the page hash and each block hash of the head is the base, it runs `check` on the
head state with the stored page text in place of the live docs. A change of the snapshot format
or of the map then passes, when the docs change after `update`. This step reads no live page
and needs no key. It fails when the map changed and `update` did not run, or when `check` has
an error. Run `update` again, and push.

Else it runs the classifier on the base state, and the issue step in dry run, against the live
docs. Then it runs `check` on the head state. It fails in these cases:

- The dry run would open an issue or post a group issue comment for a block. No open issue or
  group issue comment has the key of that block. The rules do not count. The log names the
  kind, the page, the block and the hash of each block. A `needs-triage` block also has its
  reason. Run the docs watch workflow with `workflow_dispatch`, triage what it opens, run
  `update` again, and push. If the workflow opens no issue for a block, open one by hand. The
  log prints a marker line for each block with no key match. Start the issue body with it, and
  leave it open.
- The head snapshot is not the live docs. The docs changed after `update`, or the map changed
  and `update` did not run. Run `update` again, and push.
- `check` on the head has an error. Read the error. A map hash that is not the snapshot hash
  needs `update` again. Correct a heading that is not on the page, or that the page shows more
  than one time. Correct it in the map and the footnote. For a failed fetch, run the check
  again.
- `TYPESAFE_API_KEY` is not set. A pull request from a fork or from Dependabot gets no secret.
- A step throws, or gives an output that the gate cannot read.

The classifier reads the base map. So it does not read a page that the pull request cites for
the first time. It classifies a heading that the pull request cites for the first time as a
block that no rule cites. The
[triage runbook](docs/runbooks/docs-watch-triage.md#when-the-docs-snapshot-check-fails) has
the recovery steps.

## Docs classifier

`node scripts/docs-classify.ts` reads each cited page again and asks TypeSafe Jev about each
changed, added or removed block. It needs the `TYPESAFE_API_KEY` secret when a block needs a
call. It prints the findings as JSON: `rule-update`, `rule-removal`, `new-rule`,
`needs-triage` or `moved`. An error or an unclear answer gives `needs-triage`. A removed block
and an added block on one page with the same `bodyHash` are a move. A move gets no Jev call. It
gives one `moved` finding when a rule or an inventory row cites the old block. A removed heading
and an added heading can share three or more words. When neither block is part of a move, each
finding of the two blocks names the other block as a possible move. These fail the job: a map
that cites no page, a failed docs fetch, a page that the block split cannot read, and a page with
no title.
[ADR 002](docs/adr/002-classify-docs-changes-with-jev.md) records the questions, the thresholds
and the spike data.

The classifier also reads `docs/rules-inventory.md` as a second source map. Each inventory
footnote uses the one-line form of [Rule source map](#rule-source-map), and the classifier reads
it. The classifier reads the rule tables of each `###` section of "Rules by group". A footnote
finds its block by the anchor of its link first. When no block has that ID, the heading finds
the block. The classifier tracks a changed, added or removed block when an inventory footnote
cites it. A map heading that cites the block stops this, but a heading that cites the whole page
does not. The JSON lists each tracked block in `tracked`, with the rule rows that cite it in each
section.

`node scripts/docs-issues.ts <findings.json>` opens an issue for a changed block, as the org
GitHub App. It uses a token with `permission-issues: write` only. A hidden marker with the block
hash and the rules stops a second issue for the same change. For a changed block, the body shows
a diff, then the full old and new sections in two collapsed parts. Two or more `new-rule` or
`needs-triage` findings of one page that name no rule share a digest issue. A digest has a marker
and a section for each block. It holds at most 20 blocks, and its body takes at most 60,000
characters. A digest section has no collapsed parts, and it cuts each text at 280 characters. A
digest counts as one issue toward `--max`. For a moved block, the body names the old and new
headings, the new anchor and each footnote to change. For tracked blocks, it posts the blocks
that it did not post before on each open group issue (`GROUP_ISSUES`). Each comment takes at most
60,000 characters, so a run can post more than one comment on an issue.
While a group issue of a block is open, a finding of the block that names no rule opens no issue.
`--dry-run` prints each issue and each comment, and opens and posts none. A manual run of the
workflow takes a `dry_run` input.

To triage the issues and the comments, follow the
[docs watch triage runbook](docs/runbooks/docs-watch-triage.md).

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
