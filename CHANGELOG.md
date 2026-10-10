# Changelog

## [0.9.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.8.0...v0.9.0) (2026-10-10)


### Features

* add the script path and executable bit rules ([#146](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/146)) ([fc9eb74](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/fc9eb74a4929bf038f9cb6712b36e23c3ceb15c1))
* add the untracked and gitignored file rules ([#176](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/176)) ([28b9562](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/28b9562bab17daddbc530c771d55550d7d6ddd45))
* **docs-watch:** detect a moved section and open one issue for its footnotes ([#200](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/200)) ([68f8c0a](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/68f8c0a11c3dc178c26bcc2b6f0b858533eaed46)), closes [#152](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/152)
* **docs-watch:** raise the requirement no-threshold and classify a large block by its diff ([#171](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/171)) ([cce153b](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/cce153bce6b3179729121f28acedb9473aa3a010)), closes [#150](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/150) [#137](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/137)
* **docs-watch:** treat a block that an inventory row cites as tracked ([#182](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/182)) ([1e34d33](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/1e34d33883910b86dddb62b7cc5bf684782e9f5b)), closes [#149](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/149)
* **settings:** add the model and conflicting key rules ([#115](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/115)) ([2a47e2f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/2a47e2fb91d8eecc732a57d95e08b89de9109064))
* **settings:** lint the managed settings files with the policy and grammar rules ([#114](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/114)) ([ecb4504](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/ecb45046c1436f18a59665f0481c21a76f452f36))


### Bug Fixes

* **settings:** read the User scope in settings-key-scope ([#216](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/216)) ([07965dc](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/07965dc94f0cb45757e1686c2219703ce544b21f))
* **settings:** skip a hidden drop-in in settings-file-size ([#136](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/136)) ([de380f9](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/de380f9064b30d785266e33870bdbe978a580818))

## [0.8.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.7.0...v0.8.0) (2026-10-09)


### Features

* **settings:** add the settings env and removed key rules ([#108](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/108)) ([95815ac](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/95815acc817d6480b4cfd6f74edd6b2b222ad037))
* **settings:** add the settings scope and managed file rules ([#107](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/107)) ([010e94a](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/010e94a4f9872d9f33bd68f5854eef4760dc634e))


### Bug Fixes

* **docs:** quote a rule doc description that breaks the docs watch ([#101](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/101)) ([ee50bd5](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/ee50bd58396d4f0c973f241c689258e2ea4e9d23)), closes [#100](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/100)
* **skill-tree:** bound a missing file and a linked .claude ([#106](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/106)) ([c491e3a](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/c491e3af39dc349a53d5304bec2915e723bec8ec)), closes [#98](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/98) [#99](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/99)

## [0.7.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.6.0...v0.7.0) (2026-10-09)


### Features

* **marketplace:** add the marketplace settings cross-file rules ([#96](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/96)) ([b3aaa6c](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/b3aaa6c3c4a3e778bb3f2339d7fa5271fffd18fc))
* **marketplace:** add the marketplace settings schema rules ([#95](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/95)) ([9709a04](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/9709a04a06a53307bcac1f8bcb9172e925be395d))
* **marketplace:** add the marketplace.json entry rules ([#90](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/90)) ([1952c83](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/1952c8351d1797ef9c4d1d8bce3210a3c2c4f207))
* **marketplace:** add the marketplace.json schema rules ([#83](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/83)) ([f79e90e](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/f79e90e5be6c8c6217d2d6e74faff9bc5a6dc9db))
* **marketplace:** add the marketplace.json source rules ([#89](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/89)) ([04c50d5](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/04c50d522cbbac18383e1ab5dbb5c6712b0132c8))


### Bug Fixes

* **agents:** follow the changed agent docs and bound the agent walk ([#88](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/88)) ([f71216d](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/f71216dbe2a78960e58af2ed5e467e7e7e9daeb2)), closes [#84](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/84) [#85](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/85) [#86](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/86)
* **agents:** give the agent and skill rules one scope and bound ([#82](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/82)) ([5e92773](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/5e9277377247493a0f981248bb9dfb59431475f5)), closes [#77](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/77) [#78](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/78) [#79](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/79) [#80](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/80)
* **marketplace:** test a ".." path segment, not a substring ([#94](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/94)) ([648ae51](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/648ae51093d95d082c20f7cf53fea5b453ef5b38)), closes [#92](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/92)

## [0.6.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.5.0...v0.6.0) (2026-10-06)


### Features

* **agents:** add the cross-file subagent error rules ([#67](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/67)) ([eb0a48f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/eb0a48f52155929310f8d5d93fd209e1a78f1703)), closes [#64](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/64)


### Bug Fixes

* **agents:** finish the follow-ups of the cross-file agent rules ([#75](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/75)) ([274268d](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/274268dd3c76e83ae21ae5eab77caf0dd36120a0)), closes [#72](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/72) [#71](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/71)
* keep each rule read in the repository ([#74](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/74)) ([c92861a](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/c92861aa0a421e44bdfdf24b6a60a410c8fea91e)), closes [#69](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/69) [#70](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/70)
* **plugins:** make no report that rests on an unseen .claude-plugin directory ([#66](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/66)) ([10a433e](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/10a433eb4a028ebc1201cbbbdf13c26c4b158f4a)), closes [#63](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/63)

## [0.5.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.4.0...v0.5.0) (2026-10-04)


### Features

* make each rule threshold a rule option ([#60](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/60)) ([dc7e1ec](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/dc7e1ec3fa8cd491c062201423c48dbdc97cb0cf)), closes [#54](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/54) [#56](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/56)
* **permissions:** check the tool lists in skill and agent frontmatter ([#62](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/62)) ([75ee7b5](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/75ee7b5b4bea5a2fba46e0578e4949c3eb095d20)), closes [#9](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/9) [#15](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/15) [#33](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/33)


### Bug Fixes

* **plugins:** make no report that rests on a dangling plugin.json ([#61](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/61)) ([676f7f2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/676f7f28eeeb2a32bf859349d248297943a75b98)), closes [#55](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/55)

## [0.4.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.3.0...v0.4.0) (2026-10-02)


### Features

* **agents:** add single-file subagent and output style error rules ([#48](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/48)) ([62c7e9f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/62c7e9f6e2acd6ae60c1ddbe080a35bba04ce427)), closes [#9](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/9)
* **permissions:** add the permission rule parser and grammar error rules ([#53](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/53)) ([1bdf61e](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/1bdf61eca589085526ff7e811a316c226ca8e1ce)), closes [#15](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/15)


### Bug Fixes

* **plugins:** stop reports that rest on a plugin manifest a rule cannot see ([#52](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/52)) ([8e4c5f5](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/8e4c5f579b02ba4282c1b822d1ac73b5dbb0fa61)), closes [#49](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/49)
* **skills:** stop false reports when a cross-file read fails ([#47](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/47)) ([c7b3445](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/c7b3445e6bc4e0bee349de667ec389aa8a1c4dd3)), closes [#46](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/46)

## [0.3.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.2.0...v0.3.0) (2026-10-01)


### Features

* classify docs changes and open issues ([#31](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/31)) ([63578fb](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/63578fbc15e244d3d215a9721991c69db11b8a5e)), closes [#25](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/25)
* **skills:** add cross-file skill error rules ([#41](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/41)) ([faaba44](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/faaba44a2a79a498812f73da5c2219736cbe59c2)), closes [#8](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/8)
* **skills:** add single-file skill error rules ([#40](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/40)) ([1b08a94](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/1b08a9457f3eb2f2eee5a7cc9f9eff72b618dd34)), closes [#8](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/8)

## [0.2.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.1.0...v0.2.0) (2026-09-30)


### ⚠ BREAKING CHANGES

* source rules from the Claude Code docs only ([#24](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/24))

### Bug Fixes

* source rules from the Claude Code docs only ([#24](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/24)) ([e7af8ad](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/e7af8ada9cbdf9886b806a1ed8c7c57ff409fda0)), closes [#23](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/23)

## 0.1.0 (2026-09-30)


### Features

* port the original implementation ([#19](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/19)) ([0d65f9a](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/0d65f9aa6625224a905dfc3231aeb1432789d6bf)), closes [#6](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/6)
