# eslint-plugin-claude

An ESLint plugin that lints Claude Code configuration files.

No rules ship yet.

## Install

```sh
pnpm add -D eslint eslint-plugin-claude
```

Requires ESLint 10 and Node `^22.13.0 || >=24`.

## Usage

```js
// eslint.config.js
import { defineConfig } from 'eslint/config'
import claude from 'eslint-plugin-claude'

export default defineConfig([{ plugins: { claude }, extends: ['claude/recommended'] }])
```

Rule IDs take the form `claude/<rule>`.

## Development

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

## Releases

[release-please](https://github.com/googleapis/release-please) reads the Conventional Commit
titles on `main` and opens a release pull request. It acts as an org GitHub App (secrets
`RELEASE_APP_CLIENT_ID` and `RELEASE_APP_PRIVATE_KEY`), so CI runs on that pull request.
Merging it tags the release, and `.github/workflows/release.yml` publishes to npm through
[trusted publishing](https://docs.npmjs.com/trusted-publishers). There is no npm token secret.

## License

MIT
