# eslint-plugin-claude

[![CI](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/ci.yml?query=branch%3Amain)
[![CodeQL](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/SurveyMonkey/eslint-plugin-claude/actions/workflows/codeql.yml?query=branch%3Amain)
[![npm](https://img.shields.io/npm/v/eslint-plugin-claude)](https://www.npmjs.com/package/eslint-plugin-claude)

> An ESLint plugin that lints Claude Code configuration files

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
