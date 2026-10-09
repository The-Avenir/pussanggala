## Problem and resulting behaviour

The Expo app had a single technical harness instead of the supplied Figma screens. This change implements all nine designs in their documented positions: Welcome, Ask/response, Route options, Steps, Map, Schematic, Active trip, Offline data and Settings. It adds the Ask/Map/Saved/Profile shell, fixed bottom actions, and the intervening saved/history, profile, privacy and completion flows.

The existing native/data adapters are still pending, so journeys are clearly labelled walkthrough examples and missing files/location are disclosed. The Figma corrections in the app walkthrough are applied: NCR endpoints, reported values, no corridor download/sign-in simulation, no duplicate itinerary for overlapping preference winners, and no geographic/GPS claim for illustration artwork.

## Task and scope

- Task: T46 — Figma screen implementation; final acceptance remains pending T45/device integration.
- Requirements: PRD F3/F4/F8/F9/F12/F15/F19/F21 UI surfaces.
- Invariants: INV-1/2/3/4/5/6/7 preserved in the preview.
- Branch: `feat/t46-figma-mobile-screens`, created from current main.
- Dependencies: T45 and the native pack/AI/map/GPS/persistence adapters remain pending; this PR is a draft.
- Reviewers: mobile/integration owner (Member 4) and core preference owner (Member 2); no review approval claimed.

## Implementation

- React Native StyleSheet tokens, shared controls, Nunito/DM Sans, and safe-area layouts.
- 31 exact SVG exports and four font files bundled locally; two font licences included. Manifest pins hashes/dimensions and Git attributes preserve bytes across platforms.
- Default schematic with uniformly scaled illustration wrappers for narrow phones. The static street artwork is explicitly an illustration; it does not represent route geometry or the user's position.
- Manual progress, cross-tab active banner, explicit save/rename/delete, session history, cancel/confirm flows, and return-trip recovery. The existing in-memory ID-only store gains label renaming and Cheapest/Fastest preference values without changing persisted tables.
- Reproducible browser checks and CI screenshot artifacts.

## Validation

- Root typecheck passed; 424 core tests in 18 files passed.
- Mobile typecheck and 37-file hash/dimension check passed.
- Browser checks passed at 320/390/430 px after local files/fonts loaded and browser networking was disabled. All 31 rendered SVG assets passed geometry checks; zero runtime errors/external requests.
- Android/iOS Hermes and web exports passed.
- Raw-content guard passed; 12 guard tests and existing T44 restore fixtures passed.
- Device: Windows/Edge browser evidence only; no Android phone acceptance claimed.
- Performance: no native benchmark or installed APK footprint claimed.

## Compatibility and risks

Pack, model, map and GPS integration, native readiness validation, guarded streaming, SQLite persistence and restart recovery remain pending. This is a usable UI preview, not the judged APK. Missing assets are reported as missing; the example flow does not bypass the actual release gates. The storage adapter will need to align preference values with the canonical shared contract when persistence lands.

## Evidence

[Screen mapping, all nine screenshots, checks and integration limits](https://github.com/The-Avenir/pussanggala/blob/feat/t46-figma-mobile-screens/docs/ui-figma-implementation.md). Screenshots and geometry are also under `docs/ui-screens`.

## Checklist

- [x] Branch created from current main; no direct work/push on main.
- [x] Conventional title and focused commits; scope and dependencies recorded.
- [x] Documented design corrections applied; deferred account/download/arrival detection features omitted.
- [x] Local types, tests, exports and UI checks pass.
- [x] UI assets are local, nonempty, checksum-pinned, and preserve rendered proportions.
- [x] No raw Reddit wording imports, uploads, telemetry, or chat/GPS persistence added.
- [x] Docs and TODO status describe the preview without closing native/device gates.
- [ ] Native airplane-mode/cold-start/device checks — pending native adapters.
- [ ] Factual outputs use the eligible installed pack — pending T45; examples are labelled.
- [ ] Native map/GPS/streaming and restore integration — pending T45.
- [ ] Performance/footprint and judged APK acceptance — pending T47.
- [ ] Another member reviewed and approved; dependent work merged.

