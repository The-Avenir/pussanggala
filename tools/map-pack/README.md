# tools/map-pack — offline basemap packaging (T42)

**Owner:** Member 4 (mobile, maps, GPS, release).

**Tasks:** T42 (offline NCR basemap and honest geometry); feeds the asset
allowlist used by T41/T47.

**Choice record:** [`MAP_CHOICE.md`](MAP_CHOICE.md) — OSM-data self-built PMTiles NCR
extract + local Protomaps-compatible style/glyphs/sprites; provider/build-date/
licence/attribution + NCR extent/zoom + sizes/hashes plan + S2 cold-offline plan.

**Loader skeleton:** [`src/`](src/) — `mapTypes.ts` (choice/manifest/SHAPE types),
`honestGeometry.ts` (dashed-schematic-unless-`source_path` rule),
`loader.ts` (local-only + allowlist + readiness checks), `index.ts` (re-exports).
Pure TS, no RN/native/network imports; shared by Node tooling and the T41 Expo adapter.

**Typecheck (from repo root):** `./node_modules/.bin/tsc -p tools/map-pack/tsconfig.json`

Guardrails (BUILD §5): every map source stays local during core use — no online
fallback (INV-2); local PMTiles path or documented local fallback; bundle
glyphs/sprites/style/attribution; record provider, build date, NCR boundary
source, extent/zoom, output sizes and hashes before packaging; no guessed exact
vehicle path.
