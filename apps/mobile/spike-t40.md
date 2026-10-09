# T40 Spike — Expo SDK / RN / native-module compatibility (research-only)

**Task:** T40 — Expo/native scaffold and pinned build (Member 4).
**Scope:** Spike report only. No scaffold, no manifest, no lockfile change, no device build run in this spike.
**Status:** RESEARCH-ONLY — nothing below is a pin. Per BUILD §2 / S2 warning, the
old Expo 57 / RN 0.86.3 table is not a proven combination. All versions below were
verified against official docs/registries on 2026-10-09; device compatibility
(S1/S2) is still unresolved and must be demonstrated in the T40 implementation PR.
**Constraints:** INV-2 (no runtime networking/cloud SDKs), INV-3 (no analytics/upload
SDKs), INV-4 (never import `howtogetthereph_dataset/` into the app). This spike
touches only `apps/mobile/spike-t40.md`; `packages/core`, `tools/corpus`, `data/seed`
untouched. `src/ai/` and `src/conversation/` remain Member 3 owned.

## 1. Result summary

- No full scaffold was created (per task: spike, not scaffold).
- Latest stable SDK at spike time is **Expo SDK 57** (released 2026-06-30;
  `expo@57.0.23` = `latest`/`sdk-57` tag on npm, checked 2026-10-09).
  SDK 58 exists only as `next`/`canary` preview — excluded.
- SDK 57 maps to **React Native 0.86 / React 19.2.3 / Node >= 22.13**
  (Expo versions reference). The `0.86.3` patch line (`expo@57.0.17+`) is the
  candidate patch floor because it fixes the Hermes-V1 memory/startup regressions
  (expo#46519, expo#48298) — still RESEARCH-ONLY until a device build proves it.
- Native-module direction confirmed: `expo-sqlite` + `expo-location` +
  `expo-asset`/`expo-file-system` (SDK-managed) plus `expo-dev-client` +
  `expo-build-properties` (dev-build plumbing), `llama.rn` (inference candidate,
  New Architecture required), `@maplibre/maplibre-react-native` v11.x (offline map).
- **Expo Go cannot be the acceptance environment** (fixed prebuilt native binary;
  llama.rn and MapLibre ship custom native code + config plugins). Acceptance is
  Android development build + release APK only.

## 2. Version table (all RESEARCH-ONLY, not pinned)

| Layer | Research candidate (2026-10-09) | Source | Device-tested? |
|---|---|---|---|
| Expo SDK | 57.x stable (`expo@57.0.23` latest at check; require `>=57.0.17` for RN 0.86.3 Hermes fixes) | expo.dev changelog SDK-57, npm `expo` tags, docs `versions/latest` | NO — T40 must record exact installed version from `npx expo install --fix` + device build |
| React Native | 0.86.x (0.86.3 via `expo@57.0.17+`) | Expo SDK-57 changelog; `versions/latest` table (57.0.0 → RN 0.86, React 19.2.3) | NO |
| React | 19.2.3 | Same table | NO |
| Node floor | >= 22.13.x (SDK 57 row) | Same table | N/A (build host) |
| expo-sqlite / expo-location / expo-asset / expo-file-system / expo-dev-client / expo-build-properties | SDK-57-compatible set resolved by `npx expo install --fix` (do not hand-pin) | Expo SDK 57 reference (`sdk/sqlite`, `sdk/filesystem`); dev-build docs | NO |
| llama.rn (inference candidate) | **Candidate, not pin:** 0.12.x stable line (BUILD S2 old note: 0.12.9) vs `0.13.0-rc.x` prerelease (`0.13.0-rc.2/5` seen on npm 2026-08-28). Requires RN New Architecture (>= 0.76; RN 0.86 default OK) + `llama.rn` config plugin + `expo-build-properties` | npm `llama.rn`, unpkg README (`v0.10+ requires New Architecture`), Expo setup notes | NO — S1 must pick exact stable-or-RC actually built |
| @maplibre/maplibre-react-native | **Candidate, not pin:** v11.x (`11.5.0` GitHub release 2026-10-04; `11.4.1` latest stable on npm 2026-10-01). Peer floor `expo >= 54`, `react-native >= 0.80`; devDeps built against RN 0.85.3 / expo 56.0.8; 11.3.10 notes RN 0.87-compat fix | npm registry, GitHub releases | NO — S2 must prove render on SDK 57 / RN 0.86; check v11 major-version API, do not copy old examples |
| Protomaps/PMTiles vs MBTiles/offline-region | Undecided; test `pmtiles://file://` in selected MapLibre v11 build first, fall back to tested local MBTiles/offline-region path | SDD §1.6, BUILD §2 | NO — S2 gate |

Why SDK 57 and not 56/58: SDK 57 is the current stable `latest`; SDK 56 has the
Hermes-V1 memory regression fixed only by moving to 57 (`expo@57.0.9+` → RN 0.86.2,
`57.0.17+` → RN 0.86.3); SDK 58 is preview/canary only. If the T40 device build
hits an SDK-57-specific regression, the fallback is to re-spike SDK 56 + RN 0.85
explicitly — not to silently downgrade.

## 3. Dev-build vs Expo Go limitation

- Expo Go is a fixed prebuilt binary with one SDK version; it runs only the JS
  bundle against native modules Expo pre-compiled into it (Expo dev-build FAQ / Go-vs-dev-build docs).
- llama.rn (llama.cpp bindings, C++20/OpenCL config plugin) and MapLibre
  (`app.plugin.js`, native MapLibre SDKs) ship native code + config plugins that
  mutate `android/` / `Info.plist` / build settings. That native code cannot be
  injected into Expo Go → immediate missing-native-module error.
- Remote push, custom bundle ID/icon/splash, deep links likewise untestable in Go.
- Consequence: **all T40/S1/S2/S3 acceptance runs on a development build**
  (`expo-dev-client`) and the judged release APK. Expo Go may be used for pure-JS
  iteration only and never counts as evidence.

## 4. Exact install/build commands to be added in T40 (proposed, not yet run)

Run from the repo root / `apps/mobile/` once the T40 branch scaffolds the app.
T40 must paste actual outputs + installed versions into the implementation PR.
`npx expo install --fix` (not bare `npm install -S`) resolves SDK-57-compatible
native-module versions.

```sh
# prerequisites (build host): Node >= 22.13, Android Studio + SDK/NDK/CMake,
# Java 17, ANDROID_HOME set; physical reference phone (4 GB RAM / Helio-class,
# exact model/ABI/Android to be recorded in T00) with USB debugging.

# 1. scaffold (T40 branch, inside apps/mobile/ as final location)
npx create-expo-app@latest mobile --template blank-typescript
# then move/merge result into apps/mobile/ per repo layout; do NOT commit
# android/ ios/ dirs (Continuous Native Generation regenerates them).

# 2. pin SDK-57 line and install dev-build plumbing (versions resolved, then recorded)
npx expo install expo@^57.0.0
npx expo install expo-dev-client expo-build-properties
npx expo install expo-sqlite expo-location expo-asset expo-file-system

# 3. inference + map candidates (exact versions recorded after --fix resolves them)
npx expo install llama.rn
npx expo install @maplibre/maplibre-react-native

# 4. app config: register config plugins (app.json / app.config.js)
#    - "llama.rn" plugin (enableEntitlements/entitlementsProfile/forceCxx20/enableOpenCL per README)
#    - "@maplibre/maplibre-react-native" plugin
#    - "expo-build-properties" (New Architecture stays enabled; Hermes V1 default)
#    No NEW architecture opt-out without an S1 note.

# 5. local Android development build (no Expo account; needs Android Studio)
npx expo prebuild --clean
npx expo run:android --device
# day-to-day JS iteration after native build exists:
npx expo start --dev-client

# 6. alternative: EAS cloud/local development build (needs Expo account)
npm install -g eas-cli && eas login
eas build --platform android --profile development
# or compile locally via EAS: eas build --platform android --profile development --local

# 7. release APK for T47 (judged artifact; standalone, all assets bundled)
eas build --platform android --profile preview --local
# or: npx expo run:android --variant release (local Gradle release)
# record: APK bytes, installed footprint incl. duplicated pack/model/map copies.

# 8. repo gates (already exist; must still pass after scaffold)
npm install
npm run typecheck --workspaces --if-present
npm test --workspaces --if-present
```

Rebuild rule: rerun `prebuild --clean` + step 5/6 after any native-dep install/update,
app-config change, or SDK upgrade. Pure JS/TS changes hot-reload without rebuild.

## 5. S1 evidence plan (for T40 implementation + Member 3)

Per SDD §9 S1: "Can the selected Expo/RN/runtime build load and run a sub-1B model
offline on the actual phone?" Minimum evidence the T40 PR (with Member 3) must attach:

1. Named versions: Expo SDK + RN + React + `llama.rn` exact version, GGUF filename,
   revision/hash, quantization, chat template, context/output budgets, licence.
2. Reference phone identity: model, ABI, Android version, RAM (profile: 4 GB / Helio-class).
3. Offline load test: airplane mode, native file path (never base64-in-JS), one context /
   one generation at a time, constrained-output unit validated before display.
4. 20 consecutive runs without crash/OOM; record first-safe-unit, full warm/cold
   timings, peak PSS (provisional 1 GB budget validated jointly with map/GPS per S4).
5. Cancellation + memory-pressure/idle/background cleanup demonstrated; cards preserved
   on inference failure (no rules-only substitution on reference phone).
6. JS-only Expo Go runs explicitly marked non-evidence.

S2/S3 companions (same build): cold airplane-mode map launch with local
style/glyphs/sprites + attribution and PMTiles-vs-fallback verdict (S2); outdoor
foreground-GPS fix age/accuracy, denied/no-fix handling, confirmation-gated origin,
lifecycle cleanup (S3).

## 6. Risks and open questions

1. **No device build yet** — biggest risk. Registry/docs compatibility is not a
   build proof; llama.rn RC line vs stable, and MapLibre v11 (built against RN 0.85)
   on RN 0.86, may fail at `prebuild`/Gradle/ABI level. Mitigation: T40 builds the
   minimal harness first, records exact resolved versions, keeps SDK-56 fallback.
2. **llama.rn version churn** — `0.13.0-rc.x` prerelease vs `0.12.x` stable; config
   plugin + C++20/OpenCL flags + New Architecture interplay untested here.
   Mitigation: S1 spikes one exact version; Member 3 owns model choice (T30/T31).
3. **MapLibre v11 API break** — v11 is a new major; old examples may not apply; local
   PMTiles path may be unsupported → MBTiles/offline-region fallback cost unknown,
   NCR package size unknown (old 55 MB estimate is not the new package).
4. **Hermes V1 regressions** — must stay on `expo@>=57.0.17` (RN 0.86.3); accidental
   install of early 57.0.0 reintroduces memory + dev-startup regressions.
5. **Footprint/memory** — 4 GB reference phone; map + GPS + model concurrency (S4)
   unmeasured; asset duplication (APK + copied native-readable files) unmeasured.
6. **Guardrail leakage** — broad asset globs could bundle `howtogetthereph_dataset/`,
   GGUF weights, or map tiles unintentionally; APK allowlist + shipped-content scan
   required in T41 (INV-4). No `fetch`/WebSocket/cloud SDK, no analytics/crash-upload
   SDK (INV-2/INV-3); audit JS imports and native map/style/font sources.
7. **Reference phone not yet named** (T00) — S1/S2/S3 evidence blocked until it is.

## 7. What T40 implementation does next (not this spike)

- Create task branch `spike/t40-*` → implementation branch, scaffold app, commit
  manifest + lockfile with exact versions resolved by `--fix`.
- Run §4 commands on the named reference phone; attach S1/S2 evidence per §5.
- Replace this spike's candidate table with pinned versions + measured results.
- Coordinate `src/ai/` + `src/conversation/` integration with Member 3; keep
  `packages/core` pure-TS (no RN/native/network imports).

## 8. Spike validation

- `npm install` (root, Node >= 20): passed 2026-10-09.
- `npm run typecheck --workspaces --if-present`: passes (`@pusang-gala/core`
  `tsc -p tsconfig.json && tsc -p tsconfig.test.json` clean). No app TS yet —
  scaffold lands in T40 implementation.
- No files changed outside `apps/mobile/spike-t40.md`; no dataset import; no new SDKs.
