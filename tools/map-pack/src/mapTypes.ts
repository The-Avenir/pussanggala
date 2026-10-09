/**
 * tools/map-pack — shared map-choice and manifest types (T42).
 *
 * Pure TypeScript, no RN/native/network imports, so the same contracts can be
 * consumed by Node tooling and (later) the Expo loader adapter owned in T41.
 * SDD §1.6 / §3.2 (SHAPE) / §3.3 (INSTALLED_ASSET), PRD-F6/F12, BUILD §2/§5.
 */

/** OSM-based tile container shipped in the APK. */
export type MapContainer = "pmtiles" | "mbtiles";

/** Readiness states mirroring SDD §3.3 INSTALLED_ASSET.state. */
export type MapAssetState = "missing" | "verifying" | "ready" | "failed";

/** Map asset kinds covered by the T41 allowlist rows A5–A9. */
export type MapAssetKind = "tiles" | "style" | "glyphs" | "sprites" | "attribution";

/** Extraction bbox. Asset extent only — never an NCR-membership test (SDD §1.2/§1.6). */
export interface NcrExtractionBbox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

/** Single shippable map file (allowlist row A5–A9). Hashes/sizes pinned at build time. */
export interface MapAssetEntry {
  assetId: string;
  kind: MapAssetKind;
  /** Proposed APK bundle path, e.g. `assets/map/ncr.pmtiles`. */
  bundlePath: string;
  /** File bytes measured at build time. Absent until the T42 build runs. */
  bytes?: number;
  /** Lowercase hex SHA-256 of the exact bundled file. Absent until measured. */
  sha256?: string;
  /** Licence/attribution note pointer (see MAP_CHOICE.md §2). */
  licence?: string;
}

/** Local-only map manifest consumed by the loader skeleton. */
export interface LocalMapManifest {
  container: MapContainer;
  tiles: MapAssetEntry;
  style: MapAssetEntry;
  glyphs: MapAssetEntry;
  sprites: MapAssetEntry;
  attribution: MapAssetEntry;
  /** Exact on-map attribution string, e.g. `© OpenStreetMap contributors`. */
  attributionText: string;
  bbox: NcrExtractionBbox;
  zoomMin: number;
  zoomMax: number;
}

/** SDD §3.2 SHAPE.geometry_kind. */
export type GeometryKind = "source_path" | "schematic";

/**
 * Minimal SHAPE view needed for the honest-geometry rule.
 * Exactly one of legId / walkId must be set; source_path requires evidence.
 */
export interface ShapeRecord {
  shapeId: string;
  legId?: string;
  walkId?: string;
  geojson: string;
  geometryKind: GeometryKind;
  /** RECORD_SOURCE links supporting this geometry. Empty = no evidence. */
  sourceIds: readonly string[];
}

/** Render decision for one connector. Schematic is always dashed + labelled. */
export interface ConnectorStyle {
  kind: GeometryKind;
  dashed: boolean;
  /** Human label, e.g. `schematic — not to scale` or `source-backed path`. */
  label: string;
}

/** Typed loader failure reasons (mapped to PRD-F9 recovery states in T41/T45). */
export type MapLoaderReason =
  | "missing_asset"
  | "empty_attribution"
  | "online_resource"
  | "raw_dataset_path"
  | "bad_hash_format"
  | "bad_manifest";

export interface MapLoaderIssue {
  reason: MapLoaderReason;
  detail: string;
}
