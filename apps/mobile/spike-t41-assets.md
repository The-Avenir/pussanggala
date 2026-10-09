# T41 Spike — Local Assets, Pack Loader and Readiness (Member 4)

**Task:** T41 — Local assets, pack loader and readiness
**Branch:** `dev/member-4-mobile-maps-gps`
**Owner:** Member 4 (mobile, maps, GPS, release)
**Status:** Spike draft — design only, no code/scaffold in this file
**Date (UTC):** 2026-10-09
**Sources read:** `docs/sdd-pusang-gala.md` §1.6 / §3.3 / §4 / §5 / §9 (gates S2, S4),
`docs/build-pusang-gala.md` §2–§5, `docs/TODO.md` T41 (+T00/T01/T40), PRD-F8/F9,
`apps/mobile/README.md` guardrails

**Depends on:** T20 (shared types/validation contracts), T40 (Expo/native scaffold +
pinned build). Final asset bytes wait for T15 (eligible pack) and T31 (pinned model).
Early loader/map-path investigation may proceed with synthetic fixtures; production
pack/phone gates must use the real pack and reference phone.

**Result of this spike:** explicit APK allowlist design, native-path + validation
pipeline, missing/corrupt state design, footprint plan, INV-2/INV-4 guards, and the
S2/S4 evidence plan that T41 implementation + T45/T47 will execute.

---

## 1. Scope and non-goals

In scope for T41 implementation (designed here):

- Judged APK embeds **model + pack + map + all rendering dependencies** (SDD §1.6,
  PRD-F8). Loader locates/copies to native-readable paths, checks SHA-256/schema
  before use, exposes ready/missing/failed states, records installed footprint.
- Pack/map updates via **app replacement** only. OTA and Play asset delivery are
  deferred distribution work (SDD §1.6).

Out of scope (do not add in T41):

- Firebase/accounts, cloud sync, telemetry/crash-upload SDKs, API server (BUILD §5).
- Timetable scheduler, arrival prediction, background GPS trace (SDD §1.6).
- Vector/semantic retrieval, fine-tuning, voice, UI polish (deferred per TODO §5).
- Real pack bytes, real model weights, real map extract — recorded in T15/T31/T42;
  this spike uses paths/hashes as placeholders with `TBD` markers.

---

## 2. Explicit APK asset allowlist (with SHA-256)

Only the files below may ship inside the judged APK as app assets. Everything else —
especially `howtogetthereph_dataset/`, `data/raw/`, extraction/review intermediates —
is **excluded by design** (INV-4, §8). Large weights/tiles distribution method is
settled before committing generated artifacts (BUILD §4); this table records the
logical allowlist, not committed binaries.

| # | Kind | APK bundle path (proposed, T00/T40 to settle) | Runtime role | Hash / version record | Licence / attribution |
|---|------|-----------------------------------------------|--------------|----------------------|-----------------------|
| A1 | pack DB | `assets/pack/pack.sqlite` | Read-only route facts (SDD §3.2). Opened via expo-sqlite, never mutated | `pack_sha256` recorded **externally** in A2 companion manifest, never self-stored inside the same SQLite file (SDD §3.2); `schema_version`, `pack_id` | N/A (derived; provenance in manifest) |
| A2 | pack manifest | `assets/pack/manifest.json` | One-row PACK_MANIFEST mirror + `pack_sha256`, asset sizes, `input_sha256`, disposition counts, `stale_after_days` | SHA-256 of this file pinned in loader config; contains `pack_sha256` of A1 | Source-date labels, not verification dates |
| A3 | model weights | `assets/model/<model-id>-<quant>.gguf` e.g. `qwen2.5-0.5b-instruct-q4_0.gguf` | llama.rn/GGUF load (initial candidate per BUILD §2); single pinned file only | SHA-256 + param count + arch + repo revision + quant + chat template + context/output budgets (BUILD §2.1, T31) | Model licence + redistribution permission recorded before bundling |
| A4 | model licence | `assets/licences/MODEL-LICENCE.txt` | Displayed attribution; release blocker if missing | SHA-256 pinned | Model licence text |
| A5 | map tiles | `assets/map/ncr.pmtiles` **or** `assets/map/ncr.mbtiles` (fallback — T42 decides) | Local NCR basemap extract. Primary tests `pmtiles://file://` in selected MapLibre version; fallback is tested local MBTiles/offline-region path (SDD §1.6) | SHA-256 + provider + build date + extent/zoom + bytes (BUILD §2.1) | Basemap licence + attribution string (rendered on map per S2) |
| A6 | map style | `assets/map/style.json` | Local style; all `sources`/`glyphs`/`sprite` URLs rewritten to local `file://` / `asset://` — no `https://` tile/font endpoints | SHA-256 pinned | Style licence if applicable |
| A7 | map glyphs | `assets/map/glyphs/{fontstack}/{range}.pbf` | Local text rendering; required for S2 labels test | Per-file SHA-256 or tree hash pinned | Font licence + attribution |
| A8 | map sprites | `assets/map/sprites/sprite.json` + `sprite.png` (+ `@2x` variants if style needs them) | Local icons/patterns | SHA-256 per file pinned | Sprite/icon licence if applicable |
| A9 | map attribution | `assets/licences/MAP-ATTRIBUTION.txt` (+ OSM/contributor text as required) | Source of on-map attribution string | SHA-256 pinned | NCR boundary source + tile provider terms |
| A10 | pack licence/note | `assets/licences/PACK-NOTICE.txt` | Data provenance notice (extraction ≠ permission; redistribution basis recorded per BUILD §5) | SHA-256 pinned | Data redistribution basis |

**Allowlist rules:**

1. Metro/bundler asset config (`app.json` `assetBundlePatterns` / `expo-asset` config
   settled in T40) includes **only A1–A10 patterns**. No wildcard globs over repo root,
   `data/`, `tools/`, or dataset directories (BUILD §4).
2. Every entry has a pinned SHA-256 in the loader config (checked into git as text).
   A1's hash lives in A2 + loader config (external, per SDD §3.2); all others hash the
   file directly.
3. Any new asset kind (e.g. second sprite density, fallback `.mbtiles` alongside
   `.pmtiles`) requires an allowlist row + reviewer sign-off (Member 3 for model,
   Member 1/2 for pack). Unlisted files fail the T01 shipped-content check.
4. Raw-input exclusion is structural, not advisory — see §8 INV-4 guards.

---

## 3. Native-readable paths

No manifest/scaffold exists yet (BUILD §2: T40 records real commands). The design
below constrains the T40/T41 implementation; exact `FileSystem` API names are
verified against the pinned Expo SDK in T40, not assumed here.

### 3.1 Principles

- **Never load the model as base64 in JS** (BUILD §2.1). Pass a native file URI to
  the inference adapter (Member 3 owns `apps/mobile/src/ai/`; Member 4 owns the path
  handoff + copy).
- **Copy-on-first-launch:** bundled `expo-asset` URIs (`asset://` / `file://` inside
  the APK read-only area) are copied once to a writable native-readable directory,
  then opened from there. Record both the APK bytes and the copied bytes (duplication
  is part of footprint — SDD §1.6, PRD M9).
- SQLite pack opens **read-only** from the copied path; user DB (`user.sqlite`) is a
  separate writable file with forward-only numbered migrations (SDD §3.4).

### 3.2 Proposed runtime layout (Android, to confirm in T40)

```text
APK read-only (expo-asset bundled):
  asset://…/assets/pack/pack.sqlite
  asset://…/assets/pack/manifest.json
  asset://…/assets/model/<model>.gguf
  asset://…/assets/map/ncr.{pmtiles|mbtiles}
  asset://…/assets/map/style.json
  asset://…/assets/map/glyphs/…
  asset://…/assets/map/sprites/…
  asset://…/assets/licences/…

Copied on first launch (FileSystem.documentDirectory /
  ApplicationSupportDirectory — T40 pins exact constant):
  file://…/pusang-gala/pack/pack.sqlite
  file://…/pusang-gala/pack/manifest.json
  file://…/pusang-gala/model/<model>.gguf
  file://…/pusang-gala/map/ncr.{pmtiles|mbtiles}
  file://…/pusang-gala/map/style.local.json   (rewritten local-URL copy)
  file://…/pusang-gala/map/glyphs/…
  file://…/pusang-gala/map/sprites/…
  file://…/pusang-gala/user/user.sqlite       (writable, T44)
```

- MapLibre source is pointed at the **copied** tile file:
  primary `pmtiles://file://…/pusang-gala/map/ncr.pmtiles`, fallback
  `mbtiles://file://…` or offline-region import per T42 test. Style JSON is rewritten
  at copy time so every source/glyph/sprite URL is local (audited in §7).
- Model adapter receives `file://…/pusang-gala/model/<model>.gguf` (native path, not
  JS string content).
- expo-sqlite opens the copied `pack.sqlite` read-only; `user.sqlite` path is owned
  by T44 but recorded in footprint (§6).

### 3.3 `setup.locateAssets()` contract (SDD §4, T20 types)

```ts
// Proposed — T00/T20 settle exact types; no native/network imports in core.
type AssetState = "missing" | "verifying" | "ready" | "failed";
interface LocatedAsset {
  assetId: string;        // mirrors INSTALLED_ASSET.asset_id
  kind: "model" | "pack" | "map" | "style" | "glyphs" | "sprites" | "licence";
  bundleUri: string;      // where the APK carries it (A1–A10)
  filePath: string;       // native-readable copied path actually opened
  version: string;        // pack_id / model revision / map build date
  sha256: string;         // measured hash of the copied file
  bytes: number;          // measured copied bytes
  state: AssetState;
  license: string;        // licence/attribution reference
  reason?: string;        // typed failure reason for PRD-F9 mapping
}
async function locateAssets(): Promise<LocatedAsset[]>;
```

Persists to `INSTALLED_ASSET` in `user.sqlite` (SDD §3.3) so readiness survives
restart and T44/T45 can query it without re-hashing every launch (re-verify on
version change or `failed` state).

---

## 4. Schema/hash validation steps

Order matters: cheap existence checks first, hashes before parsing, schema before
graph load, manifest compatibility before routing. Any step may mark `failed` without
crashing the app (§5).

| Step | Check | Fail → |
|------|-------|--------|
| V0 Locate | Every A1–A10 `bundleUri` resolves; copy to native path if absent/stale (compare pinned version, not just existence) | missing file → `missing`; copy I/O error → `failed(io)` |
| V1 Hash | SHA-256 of each copied file equals pinned value (A1 via A2 companion manifest + loader config). Hash **before** opening in SQLite/MapLibre/llama.rn | mismatch → `failed(checksum)`, quarantine file, do not open |
| V2 Manifest parse | `manifest.json` parses; `pack_id`, `schema_version`, `region_id`, `bbox`, `created_at`, `stale_after_days`, disposition counts present; `included+filtered+pending+rejected == answered` (SDD §3.2) | parse/count mismatch → `failed(manifest)` |
| V3 Pack open + schema | Open copied SQLite read-only; `schema_version` known to this build (T00 contract); required tables/columns/FKs present; `PACK_MANIFEST` one row; `amount_min ≤ amount_max`, paired lat/lng both-null-or-both-set, exactly-one-owner NOTE_LINK/SHAPE links (SDD §3.4) | unknown schema version → `failed(schema)` + NeedsReplan path; constraint fail → `failed(pack_invalid)` |
| V4 Eligibility gate | Only `eligibility=ready` + accepted NCR membership + RECORD_SOURCE-linked rows load into graph (SDD §3.4); excluded/unresolved/suspended/retired rows exist in DB but are filtered with counts logged | zero ready records → `failed(empty_pack)` (cards show no-data state, not a crash) |
| V5 Map-local audit | Rewritten `style.local.json` contains zero `http(s)://` tile/glyph/sprite sources; glyph/sprite files referenced all exist in copied tree; tile file header opens (PMTiles magic / MBTiles SQLite `tiles` table) | remote URL found → `failed(network_source)` (INV-2); missing glyph → `failed(map_asset)` |
| V6 Model header | Model file magic/version compatible with pinned runtime (Member 3 contract, T30); not loaded into memory here — header check only | mismatch → `failed(model_incompatible)` → unsupported-device path (SDD §1.5) |
| V7 Readiness publish | All `ready` → publish `LocatedAsset[]`, write `INSTALLED_ASSET` rows (`asset_id`, `kind`, `file_path`, `version`, `sha256`, `bytes`, `state=ready`, `license`), record footprint snapshot (§6) | any non-ready → publish partial readiness; map/model/pack consumers degrade per §5 |

Validation runs on cold start (after copy), on app-replacement upgrade (version
change forces re-copy + re-hash), and on demand from the readiness screen. Results
feed PRD-F9 distinct messages — never a generic "something went wrong".

---

## 5. Missing/corrupt states (PRD-F8/F9)

State machine per asset (mirrors `INSTALLED_ASSET.state`): `missing → verifying →
ready | failed`. `failed` carries a typed `reason` mapped to a distinct UI message +
recovery action. Asset errors **never crash the app and never trigger network
fallback** (PRD-F8).

| Condition | Asset state | User-visible behaviour (F9) | Recovery action |
|-----------|-------------|-----------------------------|-----------------|
| Fresh install, copy not yet run | `missing` | Readiness screen: "Setting up offline data…" with progress; queries wait, not error | Run copy + V1–V7 automatically |
| Hash mismatch / truncated file | `failed(checksum)` | "Offline data is damaged (pack/model/map). Your saved trips are kept." | Re-copy from APK bundle → re-hash; if bundle itself damaged → reinstall prompt (app replacement, no OTA) |
| Unknown `schema_version` after pack update | `failed(schema)` | "This trip data needs a newer app version / replanning." Saved IDs kept; trip restore returns NeedsReplan (SDD §3.4, T25/T44) | Revalidate existence/status/order/step bounds; replan, do not restore obsolete route |
| Map tile/style/glyph missing or corrupt | `failed(map_asset)` | Map pane shows recovery state + attribution retained where possible; **cards + schematic still work** (PRD-F6/F8: reference release still needs working map, but a missing map never blocks a text route) | Re-copy map tree; T42 fallback path if format unsupported |
| Model missing/incompatible/OOM at load | `failed(model_incompatible)` / inference-error path | "AI explanation unavailable on this device" (supported vs unsupported per SDD §1.5); cards/trip preserved, retry/cancel offered | Reduce budgets if measured usable (constrained phone); else explain + retain maps/cards/manual input; template fallback only for transient errors, never as reference-phone release (SDD §1.4) |
| Licence/attribution file missing | `failed(licence)` | Release blocker in T47 rehearsal; debug builds warn, release builds refuse map/model use until attribution present | Add licence, re-bundle (redistribution basis required — BUILD §5) |
| All assets `ready` | `ready` | Readiness screen: per-asset size + checksum-short + schema/pack_id; queries enabled offline | Record footprint snapshot (§6) |

Cards are composed from whatever eligible pack rows validated; recoverable asset
failures retain cards and trip state (T41 Done criterion). Only a pack-level
`failed` forces the no-data card path — still a card, not a blank screen.

---

## 6. Installed footprint recording

PRD M9 + SDD §1.6 require measuring **APK + duplicated copies + user data**, not just
APK size. Previous ≤650 MB / 55 MB estimates are provisional and do not describe the
new NCR package (SDD §1.6, BUILD §2.1) — T41/T47 must report measured numbers.

Record per rehearsal (T47) and per S4 soak:

| Component | How measured (T40 pins commands) | Recorded fields |
|-----------|----------------------------------|-----------------|
| Judged APK | `stat`/installer size of release APK on reference phone | `apk_bytes`, `apk_sha256`, version |
| Copied pack | `stat` copied `pack.sqlite` + `manifest.json` | `bytes`, `sha256`, `pack_id`, `schema_version` |
| Copied model | `stat` copied `.gguf` | `bytes`, `sha256`, model revision/quant |
| Copied map tree | `du -sb` copied `map/` (tiles + style + glyphs + sprites) | `bytes`, per-file hashes, tile format/extent/zoom |
| User data | `stat` `user.sqlite` (+ `INSTALLED_ASSET` dump) | `bytes`, schema version |
| Peak runtime | Android PSS during S4 20-query soak (map+GPS+inference concurrent) | peak PSS vs provisional 1 GB budget on 4 GB phone (SDD §1.5) |

Footprint snapshot is written alongside `INSTALLED_ASSET` rows and attached to the
T47 release evidence. Duplication (APK bytes + copied bytes counting the same logical
asset twice) is reported explicitly — it is expected on Android, not hidden.

---

## 7. INV-2 guards — no network fallback

Enforcement (SDD §5.1): import boundary + network guard + native local asset
configuration. Planned negative checks: block runtime network; force-stop/cold-launch
airplane-mode app with all required flows.

T41 design commitments:

1. **No fetch/XHR/WebSocket/cloud SDK in runtime core or app code.** JS import audit
   covers `apps/mobile/`; native audit covers MapLibre style/sources **and** font
   loading (BUILD §5: "Audit native map/style sources as well as JS imports").
2. **Map style rewrite (V5)** is a release gate: any `https://` tile, style, glyph, or
   sprite URL fails validation with `failed(network_source)`. No silent online
   fallback when a local file is missing — missing stays `failed(map_asset)` (§5).
3. **Source links** (`SOURCE.url`, e.g. Reddit permalinks) require an explicit user
   action and are never a core dependency (SDD §5). Tapping one outside airplane mode
   is allowed; the app never fetches one itself.
4. **Negative tests (T45/T47):** (a) static scan rejects `fetch(`, `XMLHttpRequest`,
   `WebSocket`, Firebase/analytics/crash-upload imports in `apps/mobile/`; (b) cold
   launch + full query → cards → AI explanation → map → GPS flow in **airplane mode
   after force-stop**, 20-query soak for S4; (c) missing-tile test confirms no network
   request is attempted (device proxy/log shows zero egress).

---

## 8. INV-4 guards — no `howtogetthereph_dataset` in bundle

Enforcement (SDD §5.1): builder/training scanner + APK asset allowlist. Planned
negative check: raw comment/user mention leaked into a note/training sample or
packaged dataset. BUILD §5 clarifies: scan **shipped assets and training inputs**,
not the intentionally supplied raw input directory — the dataset's mere existence in
the repo must not fail the check.

T41 design commitments:

1. **Structural exclusion:** allowlist §2 is the complete bundle manifest.
   `howtogetthereph_dataset/`, `data/raw/`, extraction/review intermediates, and
   `tools/` outputs are not reachable from `assetBundlePatterns`. No relative import
   from `apps/mobile/` into those trees.
2. **Shipped-content scanner (T01, consumed by T41 CI):** unpacks release APK (or
   scans bundled asset manifest pre-build) and asserts: (a) no path segment matching
   `howtogetthereph_dataset`, `data/raw`, `review-queue`, `candidates.json`, or other
   T10–T12 intermediate names; (b) no raw Reddit wording/usernames in `pack.sqlite`
   NOTE bodies (paraphrases only — Member 1 scans at build, T41 re-scans the shipped
   copy); (c) a planted fixture leak (fake raw file added to `assets/` in test) is
   rejected, proving the scanner actually runs.
3. **Training-input guard (shared with Member 3):** fine-tuning path (if ever scoped)
   uses placeholder-only examples (INV-7); no real pack stop/signboard/fare or raw
   comment may appear in training samples. T41 blocks any `assets/` path that is also
   a training input containing real facts.
4. **Negative tests:** scanner run over the T47 rehearsal APK is attached to release
   evidence; `grep -ri howtogetthereph_dataset <unpacked-apk>` returns empty;
   paraphrase/username-leak fixtures pass.

---

## 9. Validation checklist (T41 implementation PR)

- [ ] Allowlist §2 implemented in bundler config; only A1–A10 patterns ship; no broad globs.
- [ ] `locateAssets()` copies to native-readable paths (§3) and returns typed states (§5).
- [ ] V0–V7 validation pipeline (§4) runs on cold start / upgrade / on-demand; hashes checked before open; external `pack_sha256` (no self-hash).
- [ ] Unknown `schema_version` → `failed(schema)` + NeedsReplan; ready-only rows load into graph; excluded/suspended/retired never route.
- [ ] Missing/corrupt map → recovery state, cards + schematic retained; missing/corrupt model → explained fallback, cards/trip preserved, retry/cancel.
- [ ] Footprint snapshot recorded (APK + copied + user.sqlite + peak PSS); duplication explicit.
- [ ] INV-2: JS + native import audit clean; style V5 local-URL gate passes; airplane-mode force-stop/cold-launch full flow passes with zero egress.
- [ ] INV-4: shipped-content scanner passes on rehearsal APK; fixture leak rejected; `howtogetthereph_dataset`/`data/raw` absent from bundle.
- [ ] Licence/attribution files present for model, map, fonts, data; on-map attribution renders (S2).
- [ ] Conventional PR title, task/invariant links, device + data/asset hashes, and evidence attached (TODO §6–§7).

---

## 10. S2/S4 evidence plan (executed in T42/T45/T47; designed here)

### S2 — Local NCR tiles/style/glyphs/sprites render (lead: Member 4, T42)

- **Setup:** named reference phone (T00 records model/ABI/Android/RAM) + fallback
  phone; release APK from T47 pipeline with A5–A9 baked in; device in **airplane
  mode**, app force-stopped, then cold-launched.
- **Steps:** (1) launch → readiness shows map assets `ready`; (2) open map → NCR
  tiles render with labels (glyphs) + icons (sprites) + attribution; (3) run an
  unseen supported query → journey markers for mapped points, unmapped points listed
  as unmapped (no guessed markers); (4) repeat after force-stop/restart.
- **Fallback branch:** if `pmtiles://file://` unsupported in pinned MapLibre version,
  execute documented local MBTiles/offline-region path and attach comparative
  evidence (render + footprint delta).
- **Pass:** cold airplane-mode launch renders labelled, attributed map; no network
  requests; geometry honest (dashed not-to-scale schematic unless source-backed
  `source_path` geometry exists — SDD §1.6).
- **Artifacts:** screen recording, attribution screenshot, style-local audit log (V5),
  tile file hash/extent/zoom record.

### S4 — Map/GPS/streamed inference fit concurrently (leads: Member 4 + Member 3)

- **Setup:** same reference phone; full T45 integration (query → cards-first →
  streamed guarded explanation → map + schematic + foreground GPS + save/history).
- **Steps:** (1) record footprint snapshot (§6: APK + copied + user.sqlite);
  (2) **20-query lifecycle soak**: unseen supported queries + follow-ups (reverse,
  alternatives, fare/hours questions), map mounted, foreground GPS active outdoors/
  simulated per S3, AI streaming each answer; (3) background/restart recovery mid-soak
  (process death → ACTIVE_TRIP restore or NeedsReplan); (4) unsupported-device and
  temporary-error branches (kill model context / deny GPS) confirm cards preserved.
- **Measure separately:** intent latency, first-safe-unit latency, full warm response
  (initial target ≤10 s — SDD §1.4), cold model load, peak PSS (provisional 1 GB
  budget — SDD §1.5), installed footprint with duplication.
- **Pass:** 20 runs without crash/OOM; cards-first every query; no unchecked tokens;
  GPS lifecycle cleanup verified (no subscription after background/end-trip — INV-3);
  inference failure preserves cards/trip with retry/cancel.
- **Artifacts:** PSS trace, timing table, footprint snapshot, background/restart logs,
  fallback screenshots. Unresolved perf/memory work stated honestly — S4 is recorded
  passed only after execution (BUILD §6).

---

## 11. Open questions for T00/T40 (not decided by this spike)

1. Exact Expo SDK / RN / MapLibre / llama.rn / expo-sqlite / expo-location /
   expo-asset / expo-file-system pins and `FileSystem` directory constant (§3.2).
2. Exact `AssetState`/failure-reason codes and readiness-screen copy (T20 + T46).
3. PMTiles vs MBTiles/offline-region decision with measured fallback evidence (T42).
4. Large-artifact distribution: which of A1/A3/A5 are git-committed vs
   build-injected, and the T47 rehearsal injection procedure.
5. `INSTALLED_ASSET` write cadence (every launch vs version-change-only re-hash).

---

## 12. References

- SDD §1.6 (map/GPS/assets), §3.2–§3.4 (pack manifest, INSTALLED_ASSET, validation),
  §4 (`setup.locateAssets()`), §5/§5.1 (INV-2/INV-4), §9 (S2/S4) — `docs/sdd-pusang-gala.md`
- Stack/version policy, asset conventions, guardrails — `docs/build-pusang-gala.md`
- T41 + dependencies T00/T01/T20/T40/T15/T31 + gates S2/S4 — `docs/TODO.md`
- PRD-F8 (offline assets/readiness), PRD-F9 (failure states), M9 (footprint) — `docs/prd-pusang-gala.md`
- Mobile guardrails placeholder — `apps/mobile/README.md`
