# Changelog

## [0.11.1](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.11.0...v0.11.1) (2026-10-23)


### Bug Fixes

* **ci:** find the entry file through a symlink, and check block hashes on the live path ([#547](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/547)) ([034a4a3](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/034a4a3f2251d2064566aa1fcacad788fa0c3386)), closes [#464](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/464) [#465](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/465)
* **hooks:** read past a wrapper given by a path, and past env in the deprecated flag rule ([#551](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/551)) ([a046af2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/a046af271dd0ab47fc80edc2e95eec0ffbd9d867)), closes [#457](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/457) [#456](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/456)
* **mcp:** pin the plugin root exemption, trim bundle paths as validate 2.1.307 does, and resolve sanitized server names ([#546](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/546)) ([f6a0ae4](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/f6a0ae44ecf81c2bf9b20b56d415f87d4cd13133)), closes [#461](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/461) [#463](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/463) [#366](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/366)
* **plugins:** leave a plugin root unseen for themes, monitors, a second entry and an unreadable agents key ([#550](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/550)) ([d707c83](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/d707c83570c9853df0623a618233f1919407bb0f)), closes [#454](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/454) [#455](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/455) [#466](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/466)
* **settings-env:** accept the k and M suffix of CLAUDE_CODE_AUTO_COMPACT_WINDOW ([#552](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/552)) ([81bfd9c](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/81bfd9c34bf1fbf9b82381ed0a2c4915b914c86a)), closes [#447](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/447)
* **settings:** match the settings key, sandbox and env var data to the 2026-10-22 docs ([#557](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/557)) ([f231176](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/f23117672588f9049fabb43dd8adcb65e428b6f2)), closes [#497](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/497) [#498](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/498) [#505](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/505)
* **skills:** compare a refused plugin skill folder under its loaded name ([#574](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/574)) ([886bad2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/886bad215686f18d2a6893b5bffdd1f3c9a70d2f)), closes [#459](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/459)
* **skills:** escape names in five more skill messages, and drop the trust clause for a plugin skill ([#549](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/549)) ([bba8dae](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/bba8daead91efa828606599c20d9f4e6ba13e745)), closes [#460](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/460) [#271](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/271)

## [0.11.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.10.0...v0.11.0) (2026-10-21)


### Features

* **agents:** add agent-permission-mode-auto-unavailable ([#371](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/371)) ([c5a69de](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/c5a69de1b5c304bd17f9ff40f074ea4dc15ab82a)), closes [#103](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/103)
* **agents:** add agent-skills-preload-limit for the 32 preloaded skills cap ([#359](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/359)) ([3255c64](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/3255c64fcbc21e4d0b8c1b31c133498e84b9b014)), closes [#118](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/118)
* **docs-watch:** store the text of each page in the snapshot ([#388](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/388)) ([e5c7fd1](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/e5c7fd1fdb633cc0c8aa45f8d31f968351f26491)), closes [#36](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/36)
* find a plugin root that a marketplace lists without a manifest ([#358](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/358)) ([4735cf3](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/4735cf3d032dbd83b350665f3d379fc103462389)), closes [#17](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/17)
* **hooks:** report the removed remote-control sandbox flags ([#357](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/357)) ([9217670](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/92176702584e83bb7fc7ac28e56a0ff17eaf523d)), closes [#335](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/335)
* **mcp:** add mcp-server-schema for project and managed MCP files ([#374](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/374)) ([066ee98](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/066ee9853765f1159df4f3ec97558792e6e40427)), closes [#355](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/355)
* **mcp:** report an http:// MCP bundle URL in plugin.json ([#373](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/373)) ([1d8b663](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/1d8b663c24381c428438569e0ba0e17e27b3a5a0)), closes [#43](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/43)
* **plugins:** add plugin-settings-keys for keys a plugin settings file drops ([#375](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/375)) ([ba09b4c](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/ba09b4cd82478591be9ee7ca9b2dfd5e9afedbe9)), closes [#354](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/354)
* report frontmatter that is not portable YAML ([#372](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/372)) ([b01c865](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/b01c8650f0da9566a0408778ef3b483df538a0dc)), closes [#228](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/228) [#288](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/288)
* report the MCP and plugin settings shapes that no rule owns ([#453](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/453)) ([9e08831](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/9e08831ee8c38c8f8b62e3255958549f9e8ec036)), closes [#383](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/383)
* **skills:** report a skill or command name over 256 characters ([#356](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/356)) ([8edadd5](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/8edadd5aba1069fcfb45c133584b71a4af3c4596)), closes [#330](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/330)


### Bug Fixes

* **agents:** lint an agent file that a plugin manifest names outside agents/ ([#429](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/429)) ([21c23f0](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/21c23f0649a49fa8a7cb187b6c974da4e9b00a02)), closes [#377](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/377)
* **ci:** compare the snapshot with the base when no page or block hash changes ([#427](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/427)) ([2e06684](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/2e06684cf02fb9f1d4408db61025289b7f467c2e)), closes [#419](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/419)
* **hooks:** report a removed flag after an env wrapper and in a Windows path ([#451](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/451)) ([ba7564f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/ba7564f87de3740854e1003212542ab3a20c1d7b)), closes [#381](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/381)
* **mcp:** read a root .mcp.json of a plugin repository as both kinds ([#426](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/426)) ([b162efd](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/b162efdd94d231695cdc93a5143d29fef108ce63)), closes [#376](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/376)
* **mcp:** read loopback hosts and the end of a bundle URL as Claude Code does ([#428](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/428)) ([63fe7b2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/63fe7b2444893911eecc1e0651606ecbe266b5a9)), closes [#378](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/378) [#379](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/379)
* **plugins:** read a listed plugin with no manifest, and report one agent key once ([#441](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/441)) ([b494f51](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/b494f5111ea31ce5c226e6c04a2038e400c016ee)), closes [#384](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/384) [#380](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/380)
* **settings-env:** add CLAUDE_CODE_DISABLE_MOUNTED_DRIVE_RM_PROMPT to the ignored variables ([#443](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/443)) ([65b18eb](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/65b18eba620d3a3931aedb280453f28f0599ce1a))
* **settings:** list CLAUDE_CODE_AUTO_MODE_MODEL in the env first-version list ([#395](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/395)) ([b22f9dd](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/b22f9dd01d332da4e31505775a41628a8e09511a)), closes [#390](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/390)
* **skills:** do not compare refused names in skill-name-unique ([#435](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/435)) ([023eeee](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/023eeee79ab6d01bfef95955747fd0ad6a55ea72)), closes [#327](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/327)
* **skills:** escape refused characters in the skill name messages ([#431](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/431)) ([974e57f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/974e57fea8e441bd608e9ebf6d757ba4f18336c1)), closes [#331](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/331)

## [0.10.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.9.1...v0.10.0) (2026-10-16)


### Features

* **docs-watch:** fail a pull request that stores an untriaged block hash ([#294](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/294)) ([89dd624](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/89dd624862a72d30db17df833f81634e416aa425)), closes [#293](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/293)
* **docs-watch:** open one auto-merge snapshot refresh at the end of triage ([#308](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/308)) ([23ec00f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/23ec00ff2b0079f284db22a07e51b4ece66c87a1)), closes [#307](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/307)
* **skills:** add skill-name-characters for names that Claude Code refuses ([#324](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/324)) ([07dd6aa](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/07dd6aa0af2e39c6637eba2b78e5d6e9ed15f69b)), closes [#304](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/304)


### Bug Fixes

* **docs-watch:** accept a block in docs-snapshot when an open marker has its key ([#319](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/319)) ([0a38247](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/0a382473ab906f0d74acda81a81f83560437c10a)), closes [#316](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/316)
* **docs-watch:** print the remedy when the docs-snapshot dry run fails ([#340](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/340)) ([0b282b4](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/0b282b4b5bb3c565724d482032e6b1a566109e6c)), closes [#328](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/328)
* **docs-watch:** run the drift tests before the triage refresh opens its pull request ([#317](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/317)) ([407e092](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/407e092d85f303c6c3cce4c5c3e96c5ac16e45d5)), closes [#312](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/312)
* give a missing bound its real path in realDirectory ([#343](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/343)) ([4a592f4](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/4a592f49fd1abd58b6638189bf017692f5573cef)), closes [#265](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/265) [#266](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/266)
* **settings:** ignore CLAUDE_CODE_DISABLE_FILE_MENTIONS in project env ([#311](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/311)) ([5f8375b](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/5f8375be9387ea7d20d0cf6b2eda31f2d1b3aab9)), closes [#280](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/280)
* **settings:** narrow the local gitignore and numeric spelling reports ([#342](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/342)) ([0a71bd4](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/0a71bd4591154fc90c2b1748f866c7884ad7f493)), closes [#272](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/272) [#326](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/326)
* **settings:** support the idleCompaction key ([#310](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/310)) ([be6063e](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/be6063e92acfc2b50d2a8f6384a1a84c970ec8d5)), closes [#279](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/279)
* support autoCompactWindow and add the numeric env value forms ([#318](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/318)) ([6798ef1](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/6798ef1b7e9684abb691041c65a059da2137a78a)), closes [#281](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/281) [#297](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/297)

## [0.9.1](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.9.0...v0.9.1) (2026-10-12)


### Bug Fixes

* close four unseen and reader gaps found in the last bug round ([#262](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/262)) ([7c22df4](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/7c22df47fb2a65d459dd205cddd2236626bd6c76)), closes [#254](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/254) [#256](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/256) [#257](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/257) [#258](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/258)
* configure the files of each off rule in the recommended config ([#247](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/247)) ([152b5ef](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/152b5ef38bed92e1c4f3f487b7f1c952e70e7b98)), closes [#238](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/238)
* **docs-watch:** pack the group comment, cap issue bodies and harden heading ids ([#246](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/246)) ([6f640cf](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/6f640cf8d310b3bdc8e65f7df247e92e77065373)), closes [#35](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/35) [#218](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/218) [#219](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/219)
* **hooks:** limit the merge key silence to the object that holds it ([#263](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/263)) ([d643f8f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/d643f8fdc17fbab3363c01c75d21d2d2402437ee)), closes [#252](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/252)
* **hooks:** read YAML aliases, leave merge keys unread and skip shell comments ([#250](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/250)) ([a1742ac](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/a1742ac4fb360cdd81a83cc66cf85a79b6c65177)), closes [#226](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/226) [#227](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/227)
* **settings:** report CLAUDE_CODE_ENABLE_CFC set to 1 in a project settings file ([#249](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/249)) ([d1fa6b2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/d1fa6b2b364e36b82fa6db759161afabd00aa989)), closes [#130](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/130)
* treat a dangling link and a special file in the skill tree as unseen ([#248](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/248)) ([a69f15c](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/a69f15c189e6deb7bd3fdbdde6f3cde32ab5a1d6)), closes [#225](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/225)

## [0.9.0](https://github.com/SurveyMonkey/eslint-plugin-claude/compare/v0.8.0...v0.9.0) (2026-10-11)


### Features

* add the script path and executable bit rules ([#146](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/146)) ([fc9eb74](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/fc9eb74a4929bf038f9cb6712b36e23c3ceb15c1))
* add the untracked and gitignored file rules ([#176](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/176)) ([28b9562](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/28b9562bab17daddbc530c771d55550d7d6ddd45))
* **agents:** add the agent and output style name rules ([#157](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/157)) ([2378c5e](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/2378c5e1883759d12283fdb0789cc928fe2462b1))
* **agents:** add the agent description and teammate off rules ([#188](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/188)) ([665a819](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/665a8192f7947578284ecb45f0a88a9151458556))
* **agents:** add the agent tools and skills off rules ([#175](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/175)) ([9f96a84](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/9f96a847ec305ec80965fdfcf6c138cd77c3175c))
* **agents:** add the subagent field warn rules ([#138](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/138)) ([398a52c](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/398a52cd992ffe5c201e448664f02a1fd654d200))
* **docs-watch:** detect a moved section and open one issue for its footnotes ([#200](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/200)) ([68f8c0a](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/68f8c0a11c3dc178c26bcc2b6f0b858533eaed46)), closes [#152](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/152)
* **docs-watch:** open one digest issue per page for the uncited blocks of a run ([#209](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/209)) ([453eb04](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/453eb04eec0dbf206d465113166c32d8de0cb34f)), closes [#151](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/151)
* **docs-watch:** raise the requirement no-threshold and classify a large block by its diff ([#171](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/171)) ([cce153b](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/cce153bce6b3179729121f28acedb9473aa3a010)), closes [#150](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/150) [#137](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/137)
* **docs-watch:** treat a block that an inventory row cites as tracked ([#182](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/182)) ([1e34d33](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/1e34d33883910b86dddb62b7cc5bf684782e9f5b)), closes [#149](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/149)
* **hooks:** add the hooks command and HTTP rules ([#184](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/184)) ([5b02682](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/5b0268254626ff3b0454d0899765f4a05426a224))
* **hooks:** add the hooks command off rules ([#208](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/208)) ([16396bf](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/16396bfb9833fd9d6463d4b4a955909154482c9d))
* **hooks:** add the hooks config and handler rules ([#148](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/148)) ([4987230](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/4987230701fccf4f911b552322418b9ab187cc69))
* **hooks:** add the hooks duplicate and event warn rules ([#202](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/202)) ([c9d03f7](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/c9d03f76bf6b3dc08dae23a9564c73436a5493f6))
* **hooks:** add the hooks exec form and script off rules ([#215](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/215)) ([5ca7906](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/5ca7906cbb80dd2b9fcfb4ede8dffd53fdd30529))
* **hooks:** add the hooks handler and matcher warn rules ([#191](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/191)) ([e39c3da](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/e39c3da10f4e6bc4ec34f9191e4d1deedc21a016))
* **hooks:** add the hooks matcher rules ([#169](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/169)) ([7e94200](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/7e94200c029814577f68cbce6d7a903a2f595392))
* **hooks:** add the hooks placeholder and exec form warn rules ([#196](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/196)) ([e5eea53](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/e5eea53c248b44487a07eceb320b5e2232955597))
* **marketplace:** add the marketplace manifest warn rules ([#141](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/141)) ([206d57c](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/206d57ce1adad0e340eadc13b2db13f9de619f11))
* **marketplace:** add the marketplace settings warn rules ([#173](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/173)) ([38141e0](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/38141e0247dce35ab586cf70000eb6cebbad6989))
* **marketplace:** add the marketplace source and rename rules ([#153](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/153)) ([bc9b5bc](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/bc9b5bc5541b63ea9681c10c1849c02fd13cc70d))
* **mcp:** add the .mcp.json rules ([#139](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/139)) ([45d2045](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/45d20451501630e0cc934b98375c4eaf1a0cf580))
* **mcp:** add the cross-file MCP and LSP rules ([#190](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/190)) ([8285737](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/82857377d889aa0c385ffbfb299e2e69b10fa10f))
* **mcp:** add the MCP key and LSP location off rules ([#212](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/212)) ([d25f1b0](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/d25f1b0802cf4f0ff0152cc65b27ae6ca90f2fb3))
* **mcp:** add the MCP OAuth and env rules ([#155](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/155)) ([844f09f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/844f09f9c3d07de25143b1bc65546285bbb69696))
* **mcp:** add the MCP policy and .lsp.json rules ([#180](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/180)) ([860c7fe](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/860c7fed0444abc7ae76e57cf7f2adb297c6703e))
* **mcp:** add the MCP server name and header warn rules ([#197](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/197)) ([639be3b](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/639be3b01644f0d32b14e636c382003e619e02e0))
* **mcp:** add the MCP settings and approval rules ([#172](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/172)) ([f72858d](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/f72858d03128cf2c26484623f0864bf1a3ee79b8))
* **mcp:** add the MCP tool and env off rules ([#207](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/207)) ([abba9cb](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/abba9cb0a5da82a51aa5b104e04c21ce89ba77a2))
* **mcp:** add the MCP URL and policy warn rules ([#203](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/203)) ([ea4fd4e](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/ea4fd4e35ab6d4be5c013a8e658f87674b99b425))
* **memory:** add the CLAUDE.md and rules file rules ([#140](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/140)) ([8d6d04d](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/8d6d04d11ad516253d1ca480dc35c8520b94a066))
* **memory:** add the CLAUDE.md off rules ([#193](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/193)) ([d07339c](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/d07339c4dcb6532e9075a7a788cb136158b35e45))
* **memory:** add the import and symlink rules ([#163](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/163)) ([911fefd](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/911fefd3a3c0672dc80cba52263992ca0ad62536))
* **memory:** add the memory index and CLAUDE.md heuristic rules ([#199](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/199)) ([f7cb6a2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/f7cb6a2922e4ef59e33b4e623144fd5767396db2))
* **memory:** add the memory size and import warn rules ([#185](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/185)) ([6aaf359](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/6aaf359c5fbe7cc8bb7d4cd1cf3b72a1744bbdda))
* **permissions:** add the auto mode and sandbox rules ([#186](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/186)) ([886c1df](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/886c1df66a5820596fdbdb165f85c14dfa94f2c9))
* **permissions:** add the auto mode and sandbox warn rules ([#211](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/211)) ([40750fa](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/40750fa72ead51449082afbbe51f09aafabf6c76))
* **permissions:** add the Bash and path off rules ([#214](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/214)) ([938d9b4](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/938d9b498384400945844078457d1b4b184a9d9e))
* **permissions:** add the Bash rule checks ([#161](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/161)) ([06de6b8](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/06de6b80a8eec0b6e049f93077a903046da72eb1))
* **permissions:** add the cross-file and auto mode off rules ([#222](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/222)) ([ff6e95f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/ff6e95f4245f06c1eacaaa4aafc840adc53a5776))
* **permissions:** add the cross-file permission and sandbox rules ([#195](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/195)) ([83ea009](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/83ea009fdc7c1939e107b8680cdb8ba9c3a1e381))
* **permissions:** add the path and WebFetch rule checks ([#174](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/174)) ([631afac](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/631afacbd88bdcef98b84cdd8214ad63b7179585))
* **permissions:** add the path and WebFetch warn rules ([#206](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/206)) ([369a27c](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/369a27c14761096461cac57be0e3039758a6c3b3))
* **permissions:** add the permission mode and Bash warn rules ([#201](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/201)) ([3ddf7c2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/3ddf7c2606cf995c3ea9c949ff76459d6e5ca798))
* **permissions:** add the permission mode rules ([#142](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/142)) ([158d2b5](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/158d2b582056edd1831ae07aca8fb8ea61948ef5))
* **permissions:** add the sandbox off rules ([#224](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/224)) ([182751a](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/182751a3f282eba061ca367d65a6aa54bf39b611))
* **plugins:** add the cross-file plugin rules ([#192](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/192)) ([086dc07](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/086dc0701a1f3d3b1b86025c116a1e81e1ddd438))
* **plugins:** add the plugin eval suite rules ([#223](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/223)) ([c9f9434](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/c9f943409946103d4a58b95fc526b24e7207fac6))
* **plugins:** add the plugin manifest location and layout rules ([#147](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/147)) ([593ed94](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/593ed943fa190db32c09ba8c969bc875a90818c6))
* **plugins:** add the plugin manifest metadata warn rules ([#198](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/198)) ([9ee45b2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/9ee45b2173ab4919bdd709cd11814ad7feefbdfc))
* **plugins:** add the plugin monitor, theme, bin and package warn rules ([#210](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/210)) ([7a04cca](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/7a04cca0394b4075d3c569153175c277f7c17a5d))
* **plugins:** add the plugin path and relevance off rules ([#221](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/221)) ([35cd2c0](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/35cd2c01e97d56d5c8071cb9b5ac3c36e96c6da5))
* **plugins:** add the plugin path and settings warn rules ([#205](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/205)) ([7ae6e87](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/7ae6e875d3fea5f099cab07ac03feee282789ce4))
* **plugins:** add the plugin symlink escape rules ([#181](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/181)) ([421ae49](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/421ae49f9bead191f5dca688d19b871cd5812d78))
* **plugins:** add the plugin user config and bin off rules ([#213](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/213)) ([312c1e2](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/312c1e246c5dc2f8a856a46c2044f5fc9b449f48))
* **plugins:** add the plugin user config, monitor and package rules ([#159](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/159)) ([b5f5bc4](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/b5f5bc4f8403c717b8666206aa6f4b1a1ec429cd))
* **settings:** add settings-schema ([#143](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/143)) ([da41510](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/da41510f0baf9ad53c1d958bb8f93dbb2394c539))
* **settings:** add the model and conflicting key rules ([#115](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/115)) ([2a47e2f](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/2a47e2fb91d8eecc732a57d95e08b89de9109064))
* **settings:** add the settings env and helper warn rules ([#179](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/179)) ([e21fb95](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/e21fb954ea7c8797b9edc784090a38833c1f8517))
* **settings:** add the settings global file and output style rules ([#167](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/167)) ([7475190](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/7475190da5d9f2bd9affb54c8d628349efdb8c01))
* **settings:** add the settings managed and status line warn rules ([#187](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/187)) ([bf2e61d](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/bf2e61dd6c906671b66b9f4e7156f61068f67e7d))
* **settings:** add the settings model and env off rules ([#194](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/194)) ([7169111](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/7169111a66771c4c65bca0794158fa33fe4c6d8a))
* **settings:** add the settings worktree, managed and status line off rules ([#204](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/204)) ([68b289a](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/68b289a40bffed1efadaaa8aebf5f1bae2dfd8a1))
* **settings:** lint the managed settings files with the policy and grammar rules ([#114](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/114)) ([ecb4504](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/ecb45046c1436f18a59665f0481c21a76f452f36))
* **skills:** add a docs-watch-triage skill for the docs watch issues ([#217](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/217)) ([7fd7318](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/7fd7318df37abd9714d8fd313612312e99ece210)), closes [#145](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/145)
* **skills:** add the skill budget and literal off rules ([#178](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/178)) ([2adf2e3](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/2adf2e31c96a9fb5ae0d41ce66d41a3ac34f08e3))
* **skills:** add the skill frontmatter warn rules ([#144](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/144)) ([d7132c9](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/d7132c9aadecf783249e070cd3ed626a0fdc26ee))
* **skills:** add the skill invocation and precedence off rules ([#189](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/189)) ([5c3da57](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/5c3da57ec0bcfe8f49daa2d00d3b81ad3f0c9e4e))
* **skills:** add the skill plugin and size warn rules ([#165](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/165)) ([80977f5](https://github.com/SurveyMonkey/eslint-plugin-claude/commit/80977f572acaf41a93acb42f1cbd05cd82e78576))


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
