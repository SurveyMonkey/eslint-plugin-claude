# eslint-plugin-claude

An ESLint plugin that lints Claude Code configuration files.

No rules ship yet.

## Install

```sh
pnpm add -D eslint eslint-plugin-claude
```

Requires ESLint 10 and Node `^20.19.0 || ^22.13.0 || >=24`.

## Usage

```js
// eslint.config.js
import claude from 'eslint-plugin-claude'

export default [claude.configs.recommended]
```

Rules read `claude/<rule>` in a config.

## Development

```sh
pnpm install     # also installs the lefthook git hooks
pnpm test        # vitest, coverage at 100
pnpm typecheck   # tsc, no emit
pnpm lint        # biome ci
pnpm build       # tsc -p tsconfig.build.json, writes dist/
pnpm publint     # checks the packed package.json and exports
```

Source is TypeScript in `src/`. Imports name the `.ts` extension, and the build rewrites it to
`.js`. Only `dist/`, `README.md`, `LICENSE` and `package.json` are published.

## Releases

[release-please](https://github.com/googleapis/release-please) reads the Conventional Commit
titles on `main` and opens a release pull request. Merging it tags the release, and
`.github/workflows/release.yml` publishes to npm through
[trusted publishing](https://docs.npmjs.com/trusted-publishers). There is no npm token secret.

## License

MIT
