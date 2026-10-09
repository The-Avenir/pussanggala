# apps/mobile — Expo app

**Owner:** Member 4 (mobile, maps, GPS, release). `src/ai/` and
`src/conversation/` are owned by Member 3.

**Tasks:** T40 (Expo scaffold/pinned build), T41 (assets/pack loader), T42
(offline basemap), T43 (foreground GPS), T44 (persistence), T45 (integration),
T46 (UI), T47 (judged APK).

The current entry point is the T46 playful commute chat: Gaile-led onboarding, the Sunset Playful palette, rounded Nunito headings and a “Where to go?” home with a sticky chat composer. The supplied mascot replaces the SVG cat logo. Plan, Map and Trips remain the main destinations; “Enter landmarks” reveals manual routing. The preview shows onboarding once per fresh session; native integration must persist its completion flag for returning users. See the [audit, navigation, interactions and validation](../../docs/ux-redesign.md), [visual review](../../docs/ux-review.html), [wireframes](../../docs/ux-wireframes.html), and [independent Luna review / Orca record](../../docs/playful-chat-review.md). Run `npm run web` here to explore it. Route data, native AI, basemap, GPS and persistent storage remain unconnected; real queries fail honestly and examples require an explicit action. The earlier [Figma implementation](../../docs/ui-figma-implementation.md) is preserved as a comparison baseline.

Guardrails
(BUILD §5): the supplied `howtogetthereph_dataset/` raw input must never appear
in app assets; the APK uses an explicit asset allowlist (pack/model/map/style/
glyph/sprite/licence files, with hashes); no runtime networking, analytics or
crash-upload SDKs; no raw chat or GPS-coordinate persistence.

## Historical T40 minimal harness (ugly-first, offline-first)

**Research:** SDK-57 direction per `spike-t40.md` (RESEARCH-ONLY until a device
build proves it). Harness pins: `expo@57.0.23`, `react-native@0.86.3`,
`react@19.2.3`, Node `>=22.13`. New Architecture stays enabled (llama.rn
requires it). No OTA, no network/cloud/analytics SDKs, no
`howtogetthereph_dataset` import (BUILD §5 / INV-2/INV-3/INV-4).

**Files:** `package.json` (deps + `typecheck` script), `app.json` (Expo config:
`com.pusanggala.app`, no plugins yet), `App.tsx` (single-file entry, registers
root component; originally rendered offline banner + 3 synthetic placeholder cards + offline
map box). That entry point has been replaced by the nine-screen Figma implementation.
Native modules (`llama.rn`, MapLibre), pack loader (T41), GPS (T43) and real
device evidence (S1/S2) land in later tasks.

**Commands** (from `apps/mobile/`):

```sh
npm install                       # install harness deps (local node_modules only)
npm run typecheck                 # tsc --noEmit over App.tsx
```

From repo root, `npm run typecheck` still covers `packages/core`; this app is
not yet a workspace member (kept out until the T40 device build is proven).
Device-build commands (`prebuild --clean`, `run:android --device`) are proposed
in `spike-t40.md` §4 and remain unrun — no device evidence claimed.

## T01 gates — actual commands (Member 4)

Repo checks + asset guard, run from the repo root (verified 2026-10-09,
Node v22.21.1; CI mirrors them in `.github/workflows/member4-checks.yml`):

```sh
npm install                             # install workspace deps
npm run typecheck                       # tsc over workspaces (packages/core)
npm test                                # vitest in packages/core (2 passed)
node tools/eval/allowlist-check.mjs     # INV-4 shipped-content scan + built-in self-tests (exit 0 when clean)
node --test tools/eval/allowlist-check.test.mjs  # positive (leak rejected) + negative (clean passes) fixtures
```

App-local harness commands (from `apps/mobile/`; the app is not yet a
workspace member, so the root commands above do not cover it):

```sh
npm install        # install harness deps (local node_modules only)
npm run typecheck  # tsc --noEmit over App.tsx
```

The allowlist check scans `apps/mobile`, `tools/map-pack` and `data/seed`
for raw Reddit leaks (verbatim long comment text, `u/` usernames, Reddit
permalinks, raw-dataset imports) and fails on any hit. The supplied
`howtogetthereph_dataset/` directory at the repo root is intentional build
input: it is never scanned, so its mere existence never fails the gate.

## Using @pusang-gala/core

App code imports the shared core only through `src/core` (`./src/core` from
`App.tsx`, `../core` inside `src/`) — do not deep-import `packages/core`
paths elsewhere. Prerequisite: `npm install` in `apps/mobile` (and `npm install`
at the repo root so `packages/core`'s own dev toolchain is present for the
root typecheck/tests).

The dependency is `file:../../packages/core` (a symlink; `apps/mobile` stays
out of the root npm workspaces). `metro.config.js` adds `packages/core` to
`watchFolders` and keeps Metro's default hierarchical lookup: Expo's own
lockfile nests version-conflicted deps under `node_modules/expo/node_modules`
(`expo-asset`, `ws@8`, `zod@3`), so strict flat resolution would misresolve
them. Core's `zod` import resolves via the symlink realpath to the repo-root
`node_modules/zod@4.6.5` (core's pinned dep — root `npm install` is required
before bundling/typechecking), and app code resolves `zod` to the app's own
top-level `zod@4.6.5` — never the `zod@3` nested under `expo`. Verified by
`npx expo export`: the bundle contains zod 4 (`$ZodType`/`_zod` internals) and
no zod-3 copy. Do not use zod 3 APIs in app code; `zod` here is v4.
