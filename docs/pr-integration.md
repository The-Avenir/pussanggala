# Mobile PR integration

PR #25 integrates the UI redesign (#18), native scaffold (#21), SQLite trip persistence (#22), native pack adapter (#23), and validated offline asset setup (#24), and the cleaned corpus seed handoff (#25). PR #18 merged independently during integration; the remaining original heads are included in #25. Merge commits preserve each original head.

## Compatibility decisions

- Keep the mascot-led MobileShell entry and register the app once through index.ts.
- Use the T40 exact native dependency pins, one root workspace lockfile, offline release overlay and foreground-only permission configuration. The prerelease scaffold investigation in T40-PINS.md is historical.
- Preserve SVG transformation and workspace-aware Metro resolution together.
- Retain web preview support alongside the Android release target.
- Add the 37 existing UI asset paths and their manifest to the explicit packaging policy. Unknown files remain rejected; UI checks retain hash/dimension validation.
- Use a non-placeholder synthetic mismatch hash in the native adapter test so it exercises checksum mismatch under the stricter shared policy.
- Keep Node-only SQLite test types in their dedicated typecheck. Both loader and persistence suites run in CI.

## Validation

On Windows with Node v26, a clean root npm ci passed. All workspace typechecks passed. Root tests passed: 428 core, 3 scaffold, 26 native adapter, 34 SQLite store, 52 conversation, 88 AI and 10 evaluation tests (641 total). The dedicated builder-compatible asset suite passed 81 tests; packaging regression tests passed 20; the corpus and pack-builder suite passed 156. Shipped-content checks passed.

Expo dependency/plugin checks, clean Android prebuild and generated offline configuration checks passed. Android Hermes and web exports compiled. The browser suite passed at 320/390/430 px with 96 captures, 200% text, minimum 44 px targets, AA contrast, and no runtime errors or external requests. All 37 UI asset hash/dimension checks passed.

## Corpus compatibility

The initial integration allowed canonical thread citation URLs in the seed SOURCE table. The INV-4 fix removes that exception: Reddit `source.url` is null, and all raw Reddit URLs are rejected in shipped trees and built packs. IDs, dates, snapshot hashes and comment indices retain offline provenance; permalinks stay in build inputs. Regression tests cover the shipping boundary and publication rollback. The synthetic T41 builder fixture continues to supply the actual snapshot hash for thread locators. Current corpus validation and pack identity are in [T16 acceptance](../tools/corpus/reports/t16-acceptance.md).

## Remaining integration

The source foundations do not establish release readiness. Production assets/index.ts and pack-loader.ts define builder-compatible pack loading. nativePackAdapter.ts retains the earlier injected-port prototype; its manifest path/format must be reconciled before anyone wires that prototype into production startup.

The live UI still uses explicit examples and in-memory trip state. Native model execution, eligible pack bytes, startup bindings, persistent onboarding/trips, offline map rendering and foreground GPS remain integration work. Installed APK, cold offline startup, named-phone tests and performance acceptance remain open. No T40/T41/T44/T46 acceptance checkbox is closed by merging these PRs.
