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
source of each rule in `src/rules/`. Each source has a `url` on `code.claude.com/docs` and a `heading`. A
later check will add a `hash` to each source. Do not set `hash` by hand.

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
