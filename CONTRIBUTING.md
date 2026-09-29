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
