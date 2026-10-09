# apps/mobile — Expo app (placeholder)

**Owner:** Member 4 (mobile, maps, GPS, release). `src/ai/` and
`src/conversation/` are owned by Member 3.

**Tasks:** T40 (Expo scaffold/pinned build), T41 (assets/pack loader), T42
(offline basemap), T43 (foreground GPS), T44 (persistence), T45 (integration),
T46 (UI), T47 (judged APK).

The Expo application is created in T40 — no app manifest exists yet. Guardrails
(BUILD §5): the supplied `howtogetthereph_dataset/` raw input must never appear
in app assets; the APK uses an explicit asset allowlist (pack/model/map/style/
glyph/sprite/licence files, with hashes); no runtime networking, analytics or
crash-upload SDKs; no raw chat or GPS-coordinate persistence.

## T40 minimal harness (ugly-first, offline-first)

**Research:** SDK-57 direction per `spike-t40.md` (RESEARCH-ONLY until a device
build proves it). Harness pins: `expo@57.0.23`, `react-native@0.86.3`,
`react@19.2.3`, Node `>=22.13`. New Architecture stays enabled (llama.rn
requires it). No OTA, no network/cloud/analytics SDKs, no
`howtogetthereph_dataset` import (BUILD §5 / INV-2/INV-3/INV-4).

**Files:** `package.json` (deps + `typecheck` script), `app.json` (Expo config:
`com.pusanggala.app`, no plugins yet), `App.tsx` (single-file entry, registers
root component; renders offline banner + 3 synthetic placeholder cards + offline
map box). Ugly UI is intentional — polish follows functional integration (T46).
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
