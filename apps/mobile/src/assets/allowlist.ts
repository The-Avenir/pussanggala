/**
 * T41 explicit APK asset allowlist (A1–A10).
 *
 * Design source: apps/mobile/spike-t41-assets.md §2; map rows A5–A9 follow
 * tools/map-pack/MAP_CHOICE.md §§1–5. Ugly-first text config only — no binaries
 * are committed here (BUILD §4: large weights/tiles distribution is settled
 * before generated artifacts land in git).
 *
 * Only the bundle paths below may ship inside the judged APK as app assets.
 * Real pack/model/map bytes arrive later (Member-1 eligible pack, Member-3
 * pinned model, T42 tile build); hashes/versions stay TBD until measured.
 * Synthetic fixture names below (e.g. the gguf file name) are placeholders.
 *
 * Excluded by design (INV-4): the supplied raw snapshot directory and other
 * curation intermediates are NEVER assets. They are named in
 * FORBIDDEN_PATH_MARKERS only so the loader can reject them — never imported,
 * never bundled, never read here.
 */

export type AssetKind =
  | "pack"
  | "model"
  | "map"
  | "style"
  | "glyphs"
  | "sprites"
  | "licence";

export interface AllowlistEntry {
  readonly assetId: string;
  readonly kind: AssetKind;
  /** Exact APK bundle path, except the glyphs tree root which is a prefix. */
  readonly bundlePath: string;
  readonly description: string;
  /** Licence/attribution reference shipped alongside (spike §2, MAP_CHOICE §2). */
  readonly licenceRef: string;
}

export const ALLOWLIST: readonly AllowlistEntry[] = [
  {
    assetId: "A1-pack-db",
    kind: "pack",
    bundlePath: "assets/pack/pack.sqlite",
    description: "Read-only route facts DB (opened read-only, never mutated).",
    licenceRef: "pack manifest A2 (external hash record, never self-stored)",
  },
  {
    assetId: "A2-pack-manifest",
    kind: "pack",
    bundlePath: "assets/pack/manifest.json",
    description: "PACK_MANIFEST mirror + pack_sha256 + sizes + disposition counts.",
    licenceRef: "source-date labels inside the manifest",
  },
  {
    assetId: "A3-model-weights",
    kind: "model",
    bundlePath: "assets/model/qwen2.5-0.5b-instruct-q4_0.gguf",
    description: "Single pinned model file (synthetic fixture name; real id pinned in T31).",
    licenceRef: "assets/licences/MODEL-LICENCE.txt",
  },
  {
    assetId: "A4-model-licence",
    kind: "licence",
    bundlePath: "assets/licences/MODEL-LICENCE.txt",
    description: "Model licence text; release blocker if missing.",
    licenceRef: "self",
  },
  {
    assetId: "A5-map-tiles",
    kind: "map",
    bundlePath: "assets/map/ncr.pmtiles",
    description:
      "Local NCR basemap extract, PMTiles primary (MAP_CHOICE §1). " +
      "A fallback .mbtiles needs a new row + reviewer sign-off — not listed.",
    licenceRef: "assets/licences/MAP-ATTRIBUTION.txt",
  },
  {
    assetId: "A6-map-style",
    kind: "style",
    bundlePath: "assets/map/style.json",
    description: "Local style; every source/glyph/sprite URL rewritten local (V5 audit).",
    licenceRef: "style licence note in MAP-ATTRIBUTION.txt",
  },
  {
    assetId: "A7-map-glyphs",
    kind: "glyphs",
    bundlePath: "assets/map/glyphs/",
    description:
      "Prefix root of the local glyph PBF tree glyphs/{fontstack}/{range}.pbf. " +
      "The only prefix entry; per-file hashes are pinned separately at build time.",
    licenceRef: "font credit in MAP-ATTRIBUTION.txt",
  },
  {
    assetId: "A8a-map-sprite-json",
    kind: "sprites",
    bundlePath: "assets/map/sprites/sprite.json",
    description: "Local sprite index.",
    licenceRef: "sprite licence in MAP-ATTRIBUTION.txt",
  },
  {
    assetId: "A8b-map-sprite-png",
    kind: "sprites",
    bundlePath: "assets/map/sprites/sprite.png",
    description: "Local sprite image (@2x variants need new rows + sign-off).",
    licenceRef: "sprite licence in MAP-ATTRIBUTION.txt",
  },
  {
    assetId: "A9-map-attribution",
    kind: "licence",
    bundlePath: "assets/licences/MAP-ATTRIBUTION.txt",
    description: "Source of the on-map attribution string (S2-checked).",
    licenceRef: "self",
  },
  {
    assetId: "A10-pack-notice",
    kind: "licence",
    bundlePath: "assets/licences/PACK-NOTICE.txt",
    description: "Data provenance notice (extraction is not permission).",
    licenceRef: "self",
  },
];

/**
 * Raw-input markers rejected from shipped assets (INV-4). Mentioned ONLY as
 * forbidden strings for the loader's negative check — this module never
 * imports, reads, or bundles anything under these paths.
 */
export const FORBIDDEN_PATH_MARKERS: readonly string[] = [
  "howtogetthereph_dataset",
  "data/raw",
  "data\\raw",
  "review-queue",
  "candidates.json",
];

/** True for exact allowlist paths, plus any file under a trailing-slash prefix entry. */
export function isAllowlisted(bundlePath: string): boolean {
  return entryForBundlePath(bundlePath) !== undefined;
}

/** Find the allowlist row covering a bundle path (exact match or prefix entry). */
export function entryForBundlePath(bundlePath: string): AllowlistEntry | undefined {
  for (const entry of ALLOWLIST) {
    if (entry.bundlePath === bundlePath) return entry;
    if (entry.bundlePath.endsWith("/") && bundlePath.startsWith(entry.bundlePath)) {
      return entry;
    }
  }
  return undefined;
}

/** First forbidden marker contained in a candidate path, or undefined when clean. */
export function findForbiddenMarker(candidatePath: string): string | undefined {
  for (const marker of FORBIDDEN_PATH_MARKERS) {
    if (candidatePath.includes(marker)) return marker;
  }
  return undefined;
}

/** Bundle paths in manifest order (A1–A10). */
export function listBundlePaths(): readonly string[] {
  return ALLOWLIST.map((entry) => entry.bundlePath);
}
