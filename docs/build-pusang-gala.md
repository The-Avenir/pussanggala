---
spine_type: BUILD
spine_version: 0.3.0
project: Pusang Gala
slug: pusang-gala
doc_version: 0.5
status: Draft
owner: Salvador Vincent Javier
created: 2026-10-09
updated: 2026-10-09
reconciled: 2026-10-09
---

# Build Guide: Pusang Gala

**Scope:** [IDEA](idea-pusang-gala.md)

**Acceptance:** [PRD](prd-pusang-gala.md)

**Contracts:** [SDD](sdd-pusang-gala.md)

**Four-member work plan:** [TODO.md](TODO.md)

## 1. How to build from these docs

Read INDEX → IDEA → assigned PRD feature → SDD contract → TODO dependency/acceptance → this guide.

The owner confirmed the product scope after G01–G27. Docs remain Draft to distinguish proposed implementation from measured results. The session instruction **SKIP SPINE** remains in effect: do not introduce a SPINE locking, checkpoint or approval prerequisite beyond the user's authorization. This reconciliation implements documentation only; no app/scaffold or spike has been run.

**Always create a branch and a pull request for every task, including documentation, fixes, spikes and data-pipeline work. Never work directly on or push directly to main.** Another member reviews before merge. Shared interfaces require dependent-owner review. The complete PR checklist and description template live in TODO §6–§7.

## 2. Stack and version policy

There is no application manifest or measured native build. Pin exact versions only after checking official documentation/registries and passing the native compatibility spike; do not present the old dependency table as a proven combination.

| Layer | Selected direction | Pin/verify in |
|-------|--------------------|---------------|
| App | React Native + Expo Android development build; TypeScript | T40/S1, package manifest and lockfile |
| Inference | llama.rn/GGUF is the initial candidate; strictly sub-1B local model | T30/T31/S1/S5 |
| Candidate models | Qwen3-0.6B, Qwen2.5-0.5B-Instruct, LFM2-350M/700M, Gemma 3 270M | Confirm actual params, revision, licence, quantization and compatibility before use |
| Retrieval/store | expo-sqlite, read-only pack plus writable user DB; aliases/FTS and bounded structured retrieval | T00/T15/T24/T41 |
| Maps | MapLibre React Native with permitted local basemap, style, glyphs and sprites | T42/S2 |
| Tiles | Protomaps/local PMTiles candidate; tested MBTiles/offline-region fallback if needed | T42; no online fallback |
| Foreground GPS | expo-location | T43/S3 |
| Assets | expo-asset/file-system/hash APIs or compatible native adapters | T41; record copied-file footprint |
| Pack tooling | TypeScript/Node CLI with shared core normalization and schemas | T10–T15 |
| Tests | Appropriate core unit/fixture tests and Expo/device checks | T26/T35/T45; pin after scaffold |
| Delivery | Standalone judged APK with all assets | T47 |
| Deferred | Firebase/accounts, Play asset-delivery module, voice engines, OTA updates | No current dependency/task |

Earlier docs recorded Expo 57 / RN 0.86.3, llama.rn 0.12.9 and MapLibre RN 11.5.0 as research candidates. Those entries are not a current manifest or a demonstrated compatible build. Verify and replace them with actual pinned values in the implementation PR.

Use the Expo-managed installer for SDK packages once the SDK is selected. Native model/map modules require a development build; Expo Go is not the acceptance environment. Check the selected MapLibre major-version API rather than copying older examples.

### 2.1 Model and map assets

Record model parameter count, architecture, repository revision, filename, SHA-256, quantization, chat template, context/output budgets, licence and attribution. Model selection evaluates conversation grounding as well as slot extraction; it cannot be delegated to an assumed default if S5 fails.

Record map provider/build date, NCR administrative-boundary source, extraction extent/zoom, output sizes/hashes and local style/glyph/sprite dependencies. The previous 55 MB Metro Manila + Rizal estimate is not the new NCR package size. Every map source must remain local during core use.

Do not load a model as base64 in JS. Verify native-readable paths and measure both APK size and copied assets. Provisional memory/storage targets live in PRD §5 and must be reconciled with actual device evidence.

## 3. Commands

The root npm workspace exists (`packages/core` is the only workspace so far); the commands below are verified runnable. Member 4 records actual scaffold/dev/build/lint commands in T40; Member 2 records core/type/test commands in T00/T26; Member 1 records extraction/build/report commands in T15; Member 3 records on-device model/eval commands in T30/T35.

| Command | Working directory | Prerequisite | Purpose |
|---------|-------------------|--------------|---------|
| `npm install` | repo root | Node.js >= 20 | Install workspace dependencies; produces `package-lock.json` |
| `npm run typecheck` | repo root | `npm install` | Type-check all workspaces (`tsc`, no emit) |
| `npm test` | repo root | `npm install` | Run workspace tests (`vitest run` in `packages/core`) |

Required command entries once implemented: install, Android development build, release APK, typecheck, lint, core tests, corpus extraction/review/pack build, conversation evaluation and integrated device checks. Each entry states its working directory and prerequisites. Long-running services use the owner's terminal or a managed background session.

## 4. Repository conventions

| Area | Convention |
|------|------------|
| Branches | `feat/tNN-short-slug`, `fix/tNN-short-slug`, `spike/tNN-short-slug`, `docs/tNN-short-slug`, `chore/tNN-short-slug`; always branch from current main |
| Commits and PR titles | Conventional format `type(scope): imperative summary`; one task/focused change per PR |
| Core | `packages/core/`: pure TypeScript normalization, resolution, route validation, retrieval/card contracts; no RN/native/network imports |
| App | `apps/mobile/`: Expo/native adapters, assets, model, GPS, map, persistence and functional screens |
| Build tools | `tools/corpus/`, `tools/pack-builder/`, `tools/map-pack/`, `tools/eval/`; optional fine-tune tool only after measured need |
| Source inputs | `howtogetthereph_dataset/` is the supplied raw off-device snapshot; do not package/import it into the mobile app |
| Generated data | `data/seed/` for reviewed facts/paraphrases; `data/raw/` and extraction/review intermediates kept out of mobile assets and newly generated raw data out of git |
| Assets | Explicit allowlist of final pack/model/map/style/glyph/sprite/licence files, with hashes; distribution method settled before large generated artifacts are committed |
| Schema | SDD §3 shared schema; numbered user-DB migrations and replacement pack versions |
| Naming | camelCase TS, PascalCase components, snake_case SQLite fields matching the agreed contract |
| Errors | Typed result/reason codes across boundaries, mapped to PRD-F9 recovery states |
| Tests | Meaningful source/route/grounding/asset/lifecycle fixtures; no tests claimed passed before running |
| Ownership | TODO §1 and SDD §2; coordinate shared-contract changes before merging |

Large raw/generated corpora, map tiles and GGUF weights must not accidentally enter app bundles through broad asset globs. Source review evidence may refer to the raw snapshot by hash/post/index without copying it into the pack.

## 5. Guardrails

- INV-1: every factual card/RAG insert traces to eligible pack IDs. No proximity-created transfer, assumed walk or AI-authored route step.
- INV-2: no runtime networking/cloud-AI SDK. Audit native map/style/font resources as well as JS. Source links may be opened explicitly but never form a core dependency.
- INV-3: no raw query/chat or GPS-coordinate/trace persistence; no analytics/ads/crash-upload SDK. GPS subscriptions stop on background/end-trip.
- INV-4: no raw Reddit wording/usernames in shipped corpus, app prompts or training assets. Scan shipped paths; the existing supplied dataset is intentionally raw build input and must not make the shipped-content check fail merely by existing in the repository.
- INV-5: unknown fares/times stay unknown; source-post dates are labelled accurately; conflicts/old information carry warnings; suspended/retired services are excluded.
- INV-6: ambiguous places and GPS-origin suggestions require confirmation.
- INV-7: optional fine-tuning uses placeholder-only examples, not real route facts or raw comments.
- Never stream unchecked model tokens. Validate complete explanation units before display; allowlists alone do not prevent reversed instructions.
- No reference-phone rules-only release. Unsupported-phone and temporary-error fallbacks do not waive required AI.
- No deferred account/sync/submission/voice/scheduler features. Functional validation precedes UI design; Figma is WIP.
- Never hardcode a current fare from a historical doc. Pack reports are dated source data.
- Record permission/licence/attribution before packaging a source/model/map/font asset. Extraction is not proof of redistribution permission.
- Keep credentials out of git. Dependency/model pins and non-sensitive evidence belong in PRs.

## 6. Definition of done

- [ ] Task branch and PR created; title follows Conventional Commits.
- [ ] Task ID, PRD feature IDs, dependencies and resulting behaviour documented.
- [ ] Applicable acceptance and negative checks pass; actual commands/results included.
- [ ] Core offline/network/privacy/source-content rules remain satisfied.
- [ ] Shared contracts/schema changes reviewed by affected members; compatibility covered.
- [ ] Device-sensitive changes include actual-phone evidence or an explicit unresolved gate.
- [ ] Current docs, TODO task state and INDEX links are reconciled.
- [ ] Another member approves; no author self-merge before review.
- [ ] UI polish follows functional integration; no deferred features added.
- [ ] Release gate completion recorded only after execution. Scope approval is not a test result.
