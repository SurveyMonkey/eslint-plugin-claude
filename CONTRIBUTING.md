# Contributing

## Development

Requires Node `^22.13.0 || >=24` (`.nvmrc` pins the version CI uses) and pnpm, at the version in
`packageManager` in `package.json`.

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

## Rule source map

`docs/rule-sources.json` lists the pages and headings of the Claude Code docs that are the
source of each rule in `src/rules/`. Each source has a `url` on `code.claude.com/docs` and a `heading`. The
docs watch sets a `hash` on each source. Do not set `hash` by hand. `pnpm docs:seed` keeps a
`hash` when the `url` and `heading` stay the same.

A new rule needs an entry. Add the docs links to the footnotes of `docs/rules/<rule>.md`, then
run `pnpm docs:seed` and commit the new `docs/rule-sources.json`. The script makes no network
call.

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

`.github/workflows/docs-watch.yml` runs every day and on `workflow_dispatch`. It has read access
only. It opens no issue and commits nothing. It runs `node scripts/docs-watch.ts check`, which
fetches each page that the map cites (URL plus `.md`) and compares it with `docs/docs-snapshot/`.

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
command makes read-only network calls. Node 22.13 to 22.17 needs `--experimental-strip-types` to
run a `.ts` file.

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
