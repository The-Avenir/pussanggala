# tools/map-pack — offline basemap packaging (placeholder)

**Owner:** Member 4 (mobile, maps, GPS, release).

**Tasks:** T42 (offline NCR basemap and honest geometry); feeds the asset
allowlist used by T41/T47.

Guardrails (BUILD §5): every map source stays local during core use — no online
fallback (INV-2); local PMTiles path or documented local fallback; bundle
glyphs/sprites/style/attribution; record provider, build date, NCR boundary
source, extent/zoom, output sizes and hashes before packaging; no guessed exact
vehicle path.
