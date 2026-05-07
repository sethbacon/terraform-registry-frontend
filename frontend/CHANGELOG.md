<!-- markdownlint-disable MD013 MD024 MD041 -->
# Changelog

## [1.1.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v1.0.3...v1.1.0) (2026-05-07)


### Features

* add scan status filtering with pagination and namespace editing ([#271](https://github.com/sethbacon/terraform-registry-frontend/issues/271)) ([78f779d](https://github.com/sethbacon/terraform-registry-frontend/commit/78f779d7deae020ebdfdae3b05a0664caaaea3e3))


### Bug Fixes

* **tests:** update getScanningStats test to match new params signature ([#274](https://github.com/sethbacon/terraform-registry-frontend/issues/274)) ([133b2f9](https://github.com/sethbacon/terraform-registry-frontend/commit/133b2f914af0947aa607e0cd122c1b113dd1ae96))

## [1.0.3](https://github.com/sethbacon/terraform-registry-frontend/compare/v1.0.2...v1.0.3) (2026-05-05)


### Bug Fixes

* stable provider version sorts before pre-release in detail page ([#263](https://github.com/sethbacon/terraform-registry-frontend/issues/263)) ([c3bd3ac](https://github.com/sethbacon/terraform-registry-frontend/commit/c3bd3ac6a297e129d2ff58ba3d3542ff3a6d0f4f)), closes [#262](https://github.com/sethbacon/terraform-registry-frontend/issues/262)

## [1.0.2](https://github.com/sethbacon/terraform-registry-frontend/compare/v1.0.1...v1.0.2) (2026-05-04)


### Bug Fixes

* **users:** use inline memberships from list response to eliminate N+1 requests ([#260](https://github.com/sethbacon/terraform-registry-frontend/issues/260)) ([22e2ed3](https://github.com/sethbacon/terraform-registry-frontend/commit/22e2ed3016cb2de61598454c81256e78100b919a)), closes [#259](https://github.com/sethbacon/terraform-registry-frontend/issues/259)

## [1.0.1](https://github.com/sethbacon/terraform-registry-frontend/compare/v1.0.0...v1.0.1) (2026-04-30)


### Bug Fixes

* add CSV export to scanning findings modal ([#256](https://github.com/sethbacon/terraform-registry-frontend/issues/256)) ([8202642](https://github.com/sethbacon/terraform-registry-frontend/commit/8202642bbc9a3e3a07755fd8cd52698e5e0fa7dc))
* correct sort field names sent to backend for newest/recently-updated ([#254](https://github.com/sethbacon/terraform-registry-frontend/issues/254)) ([7cd75d6](https://github.com/sethbacon/terraform-registry-frontend/commit/7cd75d6a3f8a07de57f91f1a2fa2b0dd1a957892))
* replace free-text platform filter with structured os/arch multi-select ([#257](https://github.com/sethbacon/terraform-registry-frontend/issues/257)) ([22b5959](https://github.com/sethbacon/terraform-registry-frontend/commit/22b595989cc4b2eeecf8bcc678a07c40013c6a98))
* widen module detail page to match provider detail width ([#255](https://github.com/sethbacon/terraform-registry-frontend/issues/255)) ([de56600](https://github.com/sethbacon/terraform-registry-frontend/commit/de56600280f818e6cb665b64440876a06a79e883)), closes [#252](https://github.com/sethbacon/terraform-registry-frontend/issues/252)

## [1.0.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.17.0...v1.0.0) (2026-04-29)


### Documentation

* 1.0.0 release prep (Release-As: 1.0.0) ([#247](https://github.com/sethbacon/terraform-registry-frontend/issues/247)) ([2451166](https://github.com/sethbacon/terraform-registry-frontend/commit/2451166ac3fc4d3beb8e137391f82448a5a47129))

## [0.17.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.16.1...v0.17.0) (2026-04-29)

### Features

* **cve:** add advisory banner for active CVE advisories ([#245](https://github.com/sethbacon/terraform-registry-frontend/issues/245)) ([45d8528](https://github.com/sethbacon/terraform-registry-frontend/commit/45d85286879b3f71705e42df623317653ae2ff23))

## [0.16.1](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.16.0...v0.16.1) (2026-04-28)

### Bug Fixes

* **scanning:** add format auto-detection for unknown scanner names ([#243](https://github.com/sethbacon/terraform-registry-frontend/issues/243)) ([ecf2ce3](https://github.com/sethbacon/terraform-registry-frontend/commit/ecf2ce373fa2cc92431b70ce25f8b919623a30ba)), closes [#242](https://github.com/sethbacon/terraform-registry-frontend/issues/242)

## [0.16.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.15.1...v0.16.0) (2026-04-28)

### Features

* **scanning:** add clickable findings modal with parsed results table ([#240](https://github.com/sethbacon/terraform-registry-frontend/issues/240)) ([b9c7536](https://github.com/sethbacon/terraform-registry-frontend/commit/b9c7536122e7a351f153ef35e5ca6d09e5edb404)), closes [#239](https://github.com/sethbacon/terraform-registry-frontend/issues/239)

## [0.15.1](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.15.0...v0.15.1) (2026-04-27)

### Bug Fixes

* **i18n:** update translations and decode HTML entities from DeepL ([#237](https://github.com/sethbacon/terraform-registry-frontend/issues/237)) ([4c9d96d](https://github.com/sethbacon/terraform-registry-frontend/commit/4c9d96dccbb79f66423b4bca1d48742218579781))

## [0.15.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.14.2...v0.15.0) (2026-04-27)

### Features

* **i18n:** translate public registry list pages ([#235](https://github.com/sethbacon/terraform-registry-frontend/issues/235)) ([8e8cc81](https://github.com/sethbacon/terraform-registry-frontend/commit/8e8cc81a95ca29aecb7a5729377240f80f41f21b)), closes [#196](https://github.com/sethbacon/terraform-registry-frontend/issues/196)
* **scanning:** surface security scanner logs and diagnostics ([#233](https://github.com/sethbacon/terraform-registry-frontend/issues/233)) ([7e7a3cf](https://github.com/sethbacon/terraform-registry-frontend/commit/7e7a3cfdcf192928bd231b786df963f72cef2426)), closes [#199](https://github.com/sethbacon/terraform-registry-frontend/issues/199)

## [0.14.2](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.14.1...v0.14.2) (2026-04-27)

### Bug Fixes

* **i18n:** show native language names in language picker ([#230](https://github.com/sethbacon/terraform-registry-frontend/issues/230)) ([4669b35](https://github.com/sethbacon/terraform-registry-frontend/commit/4669b35a710e4d421bf7b5fb1e216a2a30e1859f)), closes [#229](https://github.com/sethbacon/terraform-registry-frontend/issues/229)

## [0.14.1](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.14.0...v0.14.1) (2026-04-26)

### Bug Fixes

* **i18n:** correct stale comment referencing nonexistent CONTRIBUTING.md section ([#227](https://github.com/sethbacon/terraform-registry-frontend/issues/227)) ([124eb50](https://github.com/sethbacon/terraform-registry-frontend/commit/124eb5085075d174f47ca6a5c40b512c0e85012f))

## [0.14.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.13.0...v0.14.0) (2026-04-26)

### Features

* replace Crowdin with DeepL + Google Translate for i18n ([#222](https://github.com/sethbacon/terraform-registry-frontend/issues/222)) ([93285d5](https://github.com/sethbacon/terraform-registry-frontend/commit/93285d501f20a1bbc890cc3843f1da5c4e327d5d))

## [0.13.0](https://github.com/sethbacon/terraform-registry-frontend/compare/v0.12.3...v0.13.0) (2026-04-25)

### Features

* add white-label branding step to setup wizard ([#218](https://github.com/sethbacon/terraform-registry-frontend/issues/218)) ([42c370c](https://github.com/sethbacon/terraform-registry-frontend/commit/42c370cda6c51a93983bd22c4b7eeb296edd970c)), closes [#200](https://github.com/sethbacon/terraform-registry-frontend/issues/200)
* **i18n:** move help panel content into translation files ([#216](https://github.com/sethbacon/terraform-registry-frontend/issues/216)) ([f057f08](https://github.com/sethbacon/terraform-registry-frontend/commit/f057f0878d8231a7b8897d2b304fe8771ddfd775)), closes [#202](https://github.com/sethbacon/terraform-registry-frontend/issues/202)
* **security-scanning:** show binary path and detected version in config section ([#217](https://github.com/sethbacon/terraform-registry-frontend/issues/217)) ([763e08f](https://github.com/sethbacon/terraform-registry-frontend/commit/763e08f7cac3fbf407152aa3511daa6a17a823c1)), closes [#198](https://github.com/sethbacon/terraform-registry-frontend/issues/198)
* **storage:** add guided migration UX for single-config state ([#215](https://github.com/sethbacon/terraform-registry-frontend/issues/215)) ([bece96e](https://github.com/sethbacon/terraform-registry-frontend/commit/bece96eab6da23a283e957b47a61349ce0e5eb10)), closes [#194](https://github.com/sethbacon/terraform-registry-frontend/issues/194)
* **ui:** combine top menu buttons into Settings and Support dropdowns ([#214](https://github.com/sethbacon/terraform-registry-frontend/issues/214)) ([edd56e3](https://github.com/sethbacon/terraform-registry-frontend/commit/edd56e3ab7e5d04b009664dd1bdc492ba5d1504a)), closes [#201](https://github.com/sethbacon/terraform-registry-frontend/issues/201)
