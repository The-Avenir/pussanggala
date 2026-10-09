# T42 Map Choice — NCR offline basemap (Member 4)

**Task:** T42 — Offline NCR basemap and honest geometry
**Branch:** `slvdrvncntjvr/m4-t42-map-pi`
**Owner:** Member 4 (mobile, maps, GPS, release)
**Date (UTC, choice record):** 2026-10-09
**Sources read:** `docs/sdd-pusang-gala.md` §1.6 / §3.2 (SHAPE) / §3.3 / §5 / §9 (gates S2, S4),
`docs/build-pusang-gala.md` §2 (stack: Maps/Tiles) / §2.1 (model and map assets) / §4–§5 (guardrails),
`docs/TODO.md` T42 (+T00/T40/T41/T13), PRD-F6/F12/F8/F9, `tools/map-pack/README.md`,
`apps/mobile/spike-t41-assets.md` (T41 allowlist A5–A9)
**Status:** Choice recorded + loader skeleton implemented. No tile/style/glyph/sprite
binaries are committed by this change. Sizes/hashes are a measurement plan (TBD), not claimed results.

---

## 1. Decision (compliant free source)

**Chosen:** OSM-data, self-built **PMTiles NCR vector extract** rendered with a **local
Protomaps-compatible style + local glyphs + local sprites** under MapLibre. No API key,
no usage quota, no runtime network.

| Role | Provider / artefact | Identification to pin at build time |
|------|---------------------|--------------------------------------|
| Geographic data | OpenStreetMap contributors (planet / Geofabrik Philippines extract) | Source file name + download date + `sha256` of the source `.osm.pbf` |
| Tile build pipeline | Protomaps basemap pipeline (`protomaps/basemaps` + `tilemaker` config) run **off-device** to cut the NCR extract to a single-file `.pmtiles` | Pipeline repo revision + config revision + build command + build date |
| Tile container | PMTiles (single-file, random-access, `pmtiles://file://` local path) | `ncr.pmtiles` bytes + `sha256` (see §5) |
| Style | Local copy of a Protomaps-compatible basemap style, rewritten to local `file://` / `asset://` sources, glyphs and sprite — no `https://` endpoints | `style.json` bytes + `sha256` |
| Glyphs | Locally generated glyph PBFs from an OFL font (proposed: Noto Sans); generated off-device, shipped as `glyphs/{fontstack}/{range}.pbf` | Tree bytes + per-file or tree `sha256`, font version |
| Sprites | Local `sprite.json` + `sprite.png` (+ `@2x` only if the pinned style needs them), generated/copied off-device | Per-file `sha256` |
| Renderer | MapLibre Native / MapLibre React Native (version pinned in T40, S1/S2 spike) | Exact version recorded in T40 manifest + lockfile |
| NCR boundary reference | Administrative-boundary source settled with T13 (Member 1 canonical geography). The tile-extraction bbox below is an **asset extent, not a membership test** (SDD §1.2/§1.6). | Boundary dataset name + version/date + `sha256` (TBD, T13) |

**Why this source, and why it is compliant:**

1. **OSM-based, redistributable with attribution.** OSM data is available under the
   Open Database License (ODbL) 1.0, which permits offline redistribution inside the
   judged APK provided attribution and licence notice ship with the app (§3). There is
   no vendor API key, seat licence, or tile-usage contract to violate.
2. **Matches the BUILD stack candidate.** BUILD §2 names *"Protomaps/local PMTiles
   candidate; tested MBTiles/offline-region fallback if needed"* with *"no online
   fallback"*. This choice implements the primary side of that candidate.
3. **Single-file offline fit.** One NCR-scoped `.pmtiles` file plus a small
   style/glyph/sprite tree is the smallest moving-parts layout for the T41 asset
   allowlist (A5–A9) and the S2 cold-launch test. No tile server, no cache seeding at
   runtime, no font CDN.
4. **No ineligible data.** Google Maps data is explicitly not a source (SDD §7). This
   choice uses no Google data, no proprietary tile CDN, and no scraped transit shapes.

**Alternatives considered and rejected as primary (fallback kept):**

| Alternative | Verdict | Reason |
|-------------|---------|--------|
| Online vector/raster tiles (any vendor, incl. OSM tile CDN) | Rejected | Violates INV-2: *"every map source stays local during core use — no online fallback"*. Also fails S2 (airplane-mode cold launch) and PRD-F8 by design. |
| Google Maps tiles/data | Rejected, ineligible | SDD §7: *"Google Maps data is not a source."* Licensing also forbids offline repackaging of this kind. |
| Raster MBTiles / offline-region pack as primary | Kept as **tested fallback only** | Heavier for the same label quality and less aligned with the PMTiles-first stack direction. Implemented only if `pmtiles://file://` fails in the pinned MapLibre version (see §6). |
| Full-planet or full-Philippines tiles | Rejected | Unnecessary footprint. NCR extract + small border is the release scope (PRD M9 measured footprint still required). |

---

## 2. Licence + attribution (recorded before packaging — BUILD §5)

Licences below are the redistribution basis to **re-verify at pin time** against the
exact file/revision actually bundled. Extraction/paraphrasing does not itself establish
permission. If any pinned revision shows a different licence, this choice is re-opened
before bundling.

| Asset | Licence (to confirm at pin) | Attribution / notice shipped |
|-------|-----------------------------|------------------------------|
| OSM data (inside `ncr.pmtiles`) | Open Database License (ODbL) 1.0 — https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/ | On-map attribution string (§2.1) **always visible** + `assets/licences/MAP-ATTRIBUTION.txt` with OSM credit + ODbL notice + data source file/date |
| Protomaps basemap style + tile-build tooling/config (`protomaps/basemaps`, `PMTiles` tooling) | Permissive (understood BSD-3-Clause family — **verify `LICENSE` at pinned revision**) | Licence text/credit in `MAP-ATTRIBUTION.txt` (or dedicated `STYLE-LICENCE.txt` if T40/T41 require it) |
| MapLibre renderer | BSD-3-Clause (verify at pinned version) | Credit in app licences/notice as per T40 manifest |
| Glyph font (proposed Noto Sans) | SIL Open Font License (OFL) 1.1 (verify at pinned font version) | Font credit in `MAP-ATTRIBUTION.txt` |
| Sprites/icons | Licence of the exact sprite set pinned (verify; replace set if non-redistributable) | Credit in `MAP-ATTRIBUTION.txt` |
| NCR boundary reference dataset | Licence per T13 source (TBD — must be recorded before bundling) | Boundary source credit in pack manifest + map notice |

### 2.1 Attribution strings

* **On-map (rendered by the style, S2-checked):**
  `© OpenStreetMap contributors`
* **Full notice (`assets/licences/MAP-ATTRIBUTION.txt`, source of the on-map string):**
  includes the on-map line plus ODbL notice, tile-build pipeline revision + build date,
  NCR boundary source, font/sprite credits, and the extraction extent below. The loader
  skeleton (`src/loader.ts`) treats a missing/empty attribution text as a failure.

---

## 3. NCR extent + zoom (asset extent, not a membership test)

* **NCR core (approx, for extraction planning):** lon `120.90`–`121.10`, lat `14.35`–`14.85`.
* **Extraction bbox (core + small tile-continuity border):** lon `120.88`–`121.12`,
  lat `14.33`–`14.87`. This border exists so edge tiles/labels render; it does **not**
  extend endpoint eligibility. Place NCR membership is canonical geography evidence via
  T13 (SDD §1.6: *"Basemap extraction extent may include a small border for tiles;
  endpoint eligibility remains strictly NCR"*; SDD §1.2: *"A map rectangle is an asset
  extent, not an administrative-boundary test"*).
* **Boundary source:** TBD with T13. This doc does not invent an administrative polygon;
  the loader never tests NCR membership by bbox.
* **Zoom (vector):** `z0`–`z14` primary. `z15` only if the measured footprint budget
  (PRD M9) allows — to be decided with real bytes, not assumed. Style `minzoom`/`maxzoom`,
  glyph ranges and sprite densities must cover the same range; any online
  `sources`/`glyphs`/`sprite` URL is rewritten to a local path before packaging
  (loader rejects `http(s)://` — INV-2).
* **Coordinates/projection:** WGS-84 source geography; vector tiles in Web-Mercator per
  the Protomaps/MBTiles container spec. Journey markers use pack coordinate evidence
  (SDD §1.6/§3.2); unmapped places stay in cards/schematic and are labelled unmapped
  (PRD-F6).

---

## 4. Honest-geometry rule (implemented in `src/honestGeometry.ts`)

SDD §1.6 + §3.2 (SHAPE) + PRD-F6/F12, enforced by the loader skeleton and the app map/schematic:

1. Every connector between two mapped stops is **dashed schematic, labelled
   "schematic — not to scale"** by default.
2. A connector may render as a **solid source-backed path only** when a `SHAPE` row
   exists with **all** of: `geometry_kind = 'source_path'`, non-empty `geojson` geometry,
   exactly one owner (`leg_id` XOR `walk_id`), and at least one `RECORD_SOURCE` evidence
   link. Anything else — including an OSM road polyline with no transit `RECORD_SOURCE`
   link — stays dashed schematic. *"An OSM road path is not automatically a transit
   service path"* (SDD §1.6).
3. Points without accepted coordinate evidence are never placed on the map; they remain
   in cards + ordered schematic and are labelled **unmapped**.
4. The schematic (`PRD-F12` ordered board/transfer/alight sequence, labelled not to
   scale) must remain usable when map assets are missing/corrupt — cards + schematic are
   retained in the recovery state (PRD-F6/F9).

---

## 5. Sizes / hashes plan (TBD — measured, not claimed)

The previous *"55 MB Metro Manila + Rizal estimate is not the new NCR package size"*
(BUILD §2.1, SDD §1.6). This table is the recording plan; no row is filled until the
T42 build runs and the T41 loader verifies bytes. **Large binaries are not committed to
git** until the distribution method is settled (BUILD §4); only hashes/sizes (text) are
checked in.

| # (T41) | File (proposed APK path) | Size plan | Hash plan | Licence/attribution |
|---------|--------------------------|-----------|-----------|---------------------|
| A5 | `assets/map/ncr.pmtiles` (primary) **or** `assets/map/ncr.mbtiles` (fallback, §6) | Record APK bytes **and** copied native-readable bytes (duplication counts toward PRD M9) | `sha256` of the exact bundled file, pinned in loader config; A5 hash recorded **externally** to the file itself | OSM ODbL + pipeline revision (§2) |
| A6 | `assets/map/style.json` (local-only URLs) | Bytes | `sha256` pinned | Style licence (§2) |
| A7 | `assets/map/glyphs/{fontstack}/{range}.pbf` | Tree bytes (+ per-file list) | Per-file or tree `sha256` pinned | OFL font credit (§2) |
| A8 | `assets/map/sprites/sprite.json` + `sprite.png` (+ `@2x` if needed) | Bytes per file | `sha256` per file pinned | Sprite licence (§2) |
| A9 | `assets/licences/MAP-ATTRIBUTION.txt` | Bytes | `sha256` pinned | Source of on-map string (§2.1) |

Recording procedure (executed at build time, off-device):

1. Build the extract with the pinned pipeline revision; capture source `.osm.pbf` name +
   date + `sha256`, pipeline revision, build command, build date (`YYYY-MM-DD`).
2. Rewrite/verify `style.json` has zero `http(s)://` tile/font/glyph/sprite endpoints;
   run the loader's `assertNoOnlineResources` + `assertNoRawDatasetPaths` checks.
3. Compute `sha256` + bytes for A5–A9; append a dated row to the build record and pin
   hashes in the T41 loader config (text only).
4. Measure installed footprint: APK delta + copied native-readable bytes + pack/model
   duplication; reconcile against PRD M9 (provisional) with real numbers.

---

## 6. S2 cold-offline plan (gate evidence — SDD §9 gate S2)

**Gate question (S2):** *"Can the selected MapLibre build render local NCR
tiles/style/glyphs/sprites?"*
**Pass bar:** *cold airplane-mode launch with labels/attribution; tested fallback if
local PMTiles unsupported* (SDD §9). PRD-F6 adds: local tiles with labels/icons/
attribution after force-stop + radio disable + cold relaunch; mapped points use
source-backed coordinates; unmapped points labelled; connectors dashed unless
source-backed; missing/corrupt assets show recovery while retaining cards/schematic.

### 6.1 Preconditions (owned elsewhere, referenced here)

* T00: shared schema/result contracts settled; reference phone + fallback phone named.
* T40: Expo/RN/MapLibre versions pinned; `pmtiles://file://` support tested in the
  selected native version; exact dev/build commands recorded.
* T13: journey-marker coordinate evidence available for at least the fixture places.
* T41: asset allowlist (A5–A9) + loader readiness states (`ready`/`missing`/`failed`)
  + shipped-content exclusion of `howtogetthereph_dataset/` implemented.

### 6.2 Cold-offline procedure (executed on the named reference phone)

1. Install the judged APK (A5–A9 embedded, hashes verified by the loader).
2. Force-stop the app; disable all radios (airplane mode, Wi-Fi/Bluetooth off).
3. Cold-relaunch; open the map journey view.
4. Assert: basemap renders from **local** tiles only; place/road labels render (glyphs);
   icons render (sprites); `© OpenStreetMap contributors` attribution visible with no
   interaction; mapped boarding/transfer/destination markers appear at pack coordinates;
   unmapped places listed as unmapped in cards/schematic; all connectors dashed +
   labelled schematic unless a `source_path` SHAPE passes `decideConnectorStyle`.
5. Negative checks: no network request leaves the device (INV-2 audit incl. native
   map/style/font sources); corrupt/missing A5–A9 each produce the typed recovery state
   with cards + schematic retained; schematic alone remains usable with map assets removed.
6. Record: phone model/ABI/Android/RAM, app/manifest versions, A5–A9 `sha256`/bytes,
   style/MapLibre versions, pass/fail per assertion, screenshots/logs without sensitive data.

### 6.3 Format-fallback test (PMTiles → MBTiles/offline-region)

1. In the T40 spike, load `ncr.pmtiles` via `pmtiles://file://` (or the version-correct
   local-PMTiles API) against the pinned MapLibre build.
2. If unsupported, evaluate and **test** the documented local fallback: bundled
   `ncr.mbtiles` (or a pre-seeded offline region) opened from a native-readable path —
   still zero network. Record which path shipped and why; update §5 hashes accordingly.
3. No online fallback is permitted in either path (BUILD §2, SDD §1.6).

---

## 7. Exclusions (must-never, checked by the loader)

* **No online tiles/fonts.** Any `http://`/`https://` tile source, glyph URL, sprite URL,
  or style URL fails packaging/loading (INV-2). External source links (if any) require
  explicit user action and are never a core dependency.
* **No guessed vehicle paths.** OSM roads, straight-line interpolations, or nearest-stop
  joins never become solid route geometry. Solid rendering requires `source_path` SHAPE +
  evidence (§4); the loader's `decideConnectorStyle` defaults to dashed schematic.
* **No `howtogetthereph_dataset/` in assets.** The supplied raw snapshot is off-device
  build input only. The loader allowlist (A5–A9 + T41 A1–A10) plus `assertNoRawDatasetPaths`
  reject any bundle path, style URL, or manifest entry referencing
  `howtogetthereph_dataset/`, `data/raw/`, or review intermediates (INV-4).

---

## 8. Open items (not decided by this doc)

* [ ] Exact reference + fallback phones (T00/T40) — S2/S4 evidence blocked until named.
* [ ] Pinned Expo/RN/MapLibre versions + `pmtiles://file://` verdict (T40) — fallback choice in §6.3.
* [ ] NCR administrative-boundary dataset + version (T13) — tile bbox above is not the membership test.
* [ ] Real A5–A9 bytes + `sha256` + build date + source-file identity (§5) — TBD at build time.
* [ ] Measured S2 run (force-stop/cold/airplane evidence on the reference phone) — planned, not passed.
* [ ] Concurrent map/GPS/model peak PSS + installed-duplication footprint (S4/M9, with Member 3).

*Choice made by Member 4 within `tools/map-pack/` on 2026-10-09. Implementation:
`src/mapTypes.ts` (choice/manifest types), `src/honestGeometry.ts` (dashed-unless-`source_path`
rule), `src/loader.ts` (local-only + allowlist + readiness checks), `src/index.ts`
(re-exports). Typecheck: `./node_modules/.bin/tsc -p tools/map-pack/tsconfig.json` from repo root.*
