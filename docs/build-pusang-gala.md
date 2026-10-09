---
spine_type: BUILD
spine_version: 0.3.0
project: Pusang Gala
slug: pusang-gala
doc_version: 0.4
status: Draft
owner: Salvador Vincent Javier
created: 2026-10-09
updated: 2026-10-09
reconciled: 2026-10-09
---

# Build Guide: Pusang Gala

**IDEA:** [idea-pusang-gala.md](idea-pusang-gala.md)
**PRD:** [prd-pusang-gala.md](prd-pusang-gala.md)
**SDD:** [sdd-pusang-gala.md](sdd-pusang-gala.md)

---

## 1. How to build from these docs

Read in this order before writing code:

1. `docs/index.md`
2. `IDEA`: scope, and especially §4 Out of Scope and §4.1 invariants
3. `PRD`: the feature you are implementing, by ID
4. `SDD`: how it fits the system; §3 ERD is the schema contract
5. The `RFC` for that feature, if one exists (none yet)
6. This guide

There is no `QAD` at this tier. Acceptance is defined by PRD §3.1 and the SDD §9 spike gates.

**Only build against `Locked` docs.** Every doc is `Draft` as of 2026-10-09. The SDD §9 spikes are the only work the owner may authorize before lock.

### To build X, read Y

| To implement… | Read | Verify against |
|---------------|------|----------------|
| A feature `PRD-F#` | PRD → SDD | PRD §3.1 acceptance criteria for that ID |
| A pack schema change | SDD §3 ERD first (a CR if Locked), then the pack builder and `PRAGMA user_version` | The builder validates; the app refuses a mismatched pack |
| A user DB change | SDD §3 ERD, then a numbered migration | The migration applies cleanly on top of the previous version |
| A UI surface | PRD feature and PRD-F9 failure states | Works in airplane mode |

---

## 2. Pinned stack

There is no manifest yet. Versions were read from the npm registry, the Expo SDK 57 `bundledNativeModules.json`, GitHub releases and the Hugging Face API on 2026-10-09. When `package.json` exists, it becomes the truth and this table must be reconciled with it. Use `npx expo install` for every Expo-managed package so the versions match the SDK.

| Layer | Technology | Version | Verified | Source |
|-------|-----------|---------|----------|--------|
| Framework | Expo SDK | 57 (`expo` 57.0.27) | 2026-10-09 | https://docs.expo.dev/versions/latest/ |
| Runtime | React Native (pinned by SDK 57) | 0.86.3 | 2026-10-09 | https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json |
| Runtime | React | 19.2.3 | 2026-10-09 | same as above |
| Language | TypeScript | the version `create-expo-app` (SDK 57) installs; record it here once the scaffold exists | unverified | https://docs.expo.dev/guides/typescript/ |
| Build tool | Expo dev build (`expo-dev-client`) | ~57.0.19 | 2026-10-09 | https://docs.expo.dev/develop/development-builds/introduction/ |
| Local LLM runtime | llama.rn | 0.12.9 (stable, 2026-08-04). Do not use `latest`, which points to 0.13.0-rc.7 | 2026-10-09 | https://github.com/mybigday/llama.rn/releases |
| Model candidate (S5) | Qwen3-0.6B Q4_0 GGUF, Apache-2.0, 382.2 MB | Pin the revision and sha256 | 2026-10-09 | https://huggingface.co/unsloth/Qwen3-0.6B-GGUF |
| Model candidate (S5) | LFM2-700M Q4_0 GGUF, LFM Open License v1.0 (commercial use free under $10M/yr revenue), 446.3 MB, 742M params | Pin the revision | 2026-10-09 | https://huggingface.co/LiquidAI/LFM2-700M-GGUF |
| Model candidate (S5) | LFM2-350M Q4_0 GGUF, LFM Open License v1.0, 219.3 MB | Pin the revision | 2026-10-09 | https://huggingface.co/LiquidAI/LFM2-350M-GGUF |
| Model candidate (S5) | Gemma 3 270M-it Q4_0 GGUF, Gemma Terms of Use (gated download), 241.6 MB, 268M params | Pin the revision | 2026-10-09 | https://huggingface.co/unsloth/gemma-3-270m-it-GGUF |
| Model candidate (S5) | Qwen2.5-0.5B-Instruct Q4_0 GGUF, Apache-2.0, 428.7 MB | Official repo; pin the revision | 2026-10-09 | https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF |
| Fine-tuning | Unsloth LoRA (free Colab GPU is sufficient for models under 1B) | Pinned at spike S7 | unverified | https://docs.unsloth.ai/ |
| Device info | expo-device (RAM, ABIs for tier detection) | ~57.0.2 | 2026-10-09 | https://docs.expo.dev/versions/latest/sdk/device/ |
| Map | @maplibre/maplibre-react-native | 11.5.0 (requires RN ≥ 0.80, Expo ≥ 54, New Architecture) | 2026-10-09 | https://github.com/maplibre/maplibre-react-native/releases |
| Map tiles | Protomaps basemap via `pmtiles` CLI (go-pmtiles) | v1.31.2 | 2026-10-09 | https://github.com/protomaps/go-pmtiles/releases |
| Map data source | Protomaps daily planet build (ODbL; OSM attribution required) | build date pinned at extract | 2026-10-09 | https://docs.protomaps.com/basemaps/downloads |
| OSM extract (pack tooling) | Geofabrik philippines-latest.osm.pbf | 581 MB, data to 2026-10-08 | 2026-10-09 | https://download.geofabrik.de/asia/philippines.html |
| Database | expo-sqlite (FTS5 included) | ~57.0.4 | 2026-10-09 | https://docs.expo.dev/versions/latest/sdk/sqlite/ |
| Location | expo-location | ~57.0.20 | 2026-10-09 | https://docs.expo.dev/versions/latest/sdk/location/ |
| Files | expo-file-system / expo-asset | ~57.0.7 / ~57.0.19 | 2026-10-09 | https://docs.expo.dev/versions/latest/sdk/filesystem/ |
| Hashing | expo-crypto | ~57.0.3 | 2026-10-09 | https://docs.expo.dev/versions/latest/sdk/crypto/ |
| Test (app) | jest-expo | ~57.0.5 | 2026-10-09 | https://docs.expo.dev/develop/unit-testing/ |
| Pack builder runtime | Node.js | 22.x (dev machine has v22.21.1) | 2026-10-09 | https://nodejs.org/en/about/previous-releases |
| 1.1 accounts | @react-native-firebase/app, /auth, /firestore (Apache-2.0) | 26.4.0 (2026-09-05) | 2026-10-09 | https://rnfirebase.io/ |
| 1.1 accounts | @react-native-google-signin/google-signin (MIT) | 16.1.5 (2026-09-03) | 2026-10-09 | https://react-native-google-signin.github.io/docs/ |
| 1.1 map | Map extent: Metro Manila + Rizal bbox `120.90,14.35,121.35,14.80`, z≤15, 55 MB | Protomaps build pinned at extract | 2026-10-09 | https://docs.protomaps.com/basemaps/downloads |
| Later: Google Maps handoff (PRD-F14) | expo-intent-launcher | ~57.0.1 | 2026-10-09 | https://docs.expo.dev/versions/latest/sdk/intent-launcher/ |
| Play build: asset delivery | Play Asset Delivery fast-follow pack + a custom Expo module (Play Core `AssetPackManager`) | Play Core version pinned at spike S6 | unverified | https://developer.android.com/guide/playcore/asset-delivery |
| Later: voice out (PRD-F13) | expo-speech (Android system TTS; fil-PH voice is device-dependent) | ~57.0.3 | 2026-10-09 | https://docs.expo.dev/versions/latest/sdk/speech/ |

### Known deprecations

| Deprecated | Use instead | Since | Notes |
|-----------|-------------|-------|-------|
| React Native legacy architecture | New Architecture (the only option) | RN 0.82 | llama.rn ≥ 0.10 and MapLibre RN v11 both require it |
| Expo Go for this app | A development build (`expo-dev-client`) | — | Native modules (llama.rn, MapLibre) are not in Expo Go |
| MapLibre RN v10 API | v11 API | v11.0 | Agents trained on v10 examples will write the wrong component and prop names. Check the v11 docs |
| `react-native-executorch` pre-0.10 API | 0.10 API, or `/legacy` | 0.10.0 (2026-09-08) | Not used in the first release; noted for the voice path |
| Qwen3 "thinking" default | Non-thinking chat template via llama.rn Jinja (`enable_thinking: false`) | — | A prompt instruction alone is not enough |
| `tile.openstreetmap.org` for offline | A local Protomaps PMTiles extract | — | Banned by the OSMF tile policy |
| Firebase JS SDK (`firebase` npm) for Firestore in RN | `@react-native-firebase/*` native SDK | — | JS SDK offline persistence doesn't work in React Native |
| Firebase Analytics / Crashlytics | None | — | Banned by INV-3; do not install `@react-native-firebase/analytics` or `/crashlytics` |

---

## 3. Commands

There is no manifest yet. These commands are proposed. Once the scaffold exists, copy the real ones from `apps/mobile/package.json` and the root `package.json` and reconcile this table.

| Task | Command |
|------|---------|
| Install | `TBD(owner)` (proposed: `npm install` at the workspace root) |
| Dev | `TBD(owner)` (proposed: `npx expo run:android`, which needs the Android SDK and JDK 17) |
| Build | `TBD(owner)` (proposed: `npx expo run:android --variant release` or `eas build -p android --profile preview`) |
| Test | `TBD(owner)` (proposed: `npm test` running jest-expo in the app and Node tests in `packages/core`) |
| Lint | `TBD(owner)` (proposed: `npx expo lint`) |
| Typecheck | `TBD(owner)` (proposed: `npx tsc --noEmit`) |

Long-running commands (Metro, watchers, emulator) must be run by the owner in their own terminal, not by an agent in a blocking shell call.

---

## 4. Repo conventions

| Area | Convention |
|------|-----------|
| Branch policy | `main` is protected by convention. Work on `feat/<prd-id>-<slug>` or `spike/<s#>-<slug>` branches and merge through PR. `TBD(owner)`: confirm |
| Commit format | Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), matching the existing history |
| Directory layout | `apps/mobile/` (Expo app; network code only in `src/account/`), `packages/core/` (pure TS: normalize, parse, resolve, route, validate, compose, persona; no RN or Firebase imports), `tools/pack-builder/`, `tools/map-pack/`, `tools/eval/`, `tools/finetune/`, `firebase/` (rules, hosting), `data/seed/` (curated CSVs, committed), `data/raw/` (gitignored; never committed), `docs/` |
| Naming | camelCase TS identifiers, PascalCase components, snake_case DB columns matching the SDD §3 ERD exactly |
| Error handling | Typed `Result<T, Reason>` in `packages/core`; reason codes map one-to-one to PRD-F9 messages. No throws across module boundaries |
| Test location | Co-located `*.test.ts`; device and eval fixtures in `tools/eval/fixtures/` |

---

## 5. Guardrails

These are repo-specific prohibitions, enforced like the engine's §8 Hard Rules.

- Never commit secrets. Build tokens (EAS, Hugging Face) live in the developer's shell environment or the EAS secret store. `.env` is gitignored.
- **INV-1:** UI code never renders route facts from anything other than `core.compose()` output. The persona path goes through `persona/guard.ts`. Never load an `unverified` row into the router.
- **INV-2:** No `fetch`, XHR, WebSocket or Firebase import outside `apps/mobile/src/account/`, enforced by an ESLint `no-restricted-imports` rule and the runtime `net/guard.ts`. No cloud LLM SDK may be added as a dependency. Every core feature must pass in airplane mode.
- **INV-3:** No analytics, crash-reporting or ads SDKs. Uploads happen only when the user is signed in **and** `sync_enabled=1`. Never store or sync raw query text or coordinates.
- **INV-5:** Every card, fare and GPS marker passes through `staleness.ts`. Never render `last_verified`, a fare or a fix without its age or stale label.
- **INV-6:** `core.resolve` never auto-picks a place. Ambiguous input returns `NeedsClarification`, and the UI must ask.
- **INV-7:** Fine-tune data comes only from `tools/finetune/`, using placeholder place names. Never put real stops, signboards or fares into training data.
- `google-services.json` is never committed; it is injected at build time.
- **INV-4:** Raw Reddit data never enters the repo. `data/raw/` is gitignored, and the scrape lives outside the repo or there. `data/seed/` holds facts and permalink URLs only, with no comment text and no `u/` usernames. Never fine-tune any model on Reddit text.
- Never add an entity or column not in the SDD §3 ERD.
- Never use Google Maps tiles, places or directions as a data source.
- Record the license of every model, tile and voice asset before it is bundled. Any license the team can comply with at startup scale is allowed (IDEA §6), including revenue-threshold and use-policy licenses. Ship the license text and any attribution in the About screen. Don't ship anything whose license forbids commercial use outright (e.g. Meta MMS-TTS CC-BY-NC); such assets may still be used in internal experiments.

---

## 6. Definition of done

- [ ] Implements a `Locked` requirement, by ID
- [ ] Build passes: `TBD(owner)` (see §3)
- [ ] Tests pass: `TBD(owner)` (see §3)
- [ ] Lint and typecheck are clean
- [ ] PRD §3.1 acceptance criteria for the feature ID pass, including an airplane-mode run on the target phone
- [ ] Negative tests for every invariant the feature touches pass
- [ ] Docs are updated if behaviour changed, and the `INDEX` row is bumped
