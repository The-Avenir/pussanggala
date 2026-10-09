/**
 * Offline map loader skeleton (T42, feeds T41/T47).
 * Local files only — no fetch/XHR/WebSocket, no online tile/font fallback (INV-2).
 * Rejects raw-dataset paths in assets (INV-4).
 */
import type {
  LocalMapManifest,
  MapAssetEntry,
  MapAssetState,
  MapLoaderIssue,
} from "./mapTypes.js";

const HTTP_URL_RE = /https?:\/\//i;
const RAW_DATASET_RES = [
  "howtogetthereph_dataset",
  "data/raw/",
  "data\\raw\\",
] as const;

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

/** All shippable entries in manifest order (A5–A9). */
export function listMapAssets(manifest: LocalMapManifest): MapAssetEntry[] {
  return [manifest.tiles, manifest.style, manifest.glyphs, manifest.sprites, manifest.attribution];
}

/** Join a base dir and a bundle path without depending on node:path (Expo-safe). */
export function joinAssetPath(baseDir: string, bundlePath: string): string {
  const base = baseDir.endsWith("/") ? baseDir.slice(0, -1) : baseDir;
  const rel = bundlePath.startsWith("/") ? bundlePath.slice(1) : bundlePath;
  return `${base}/${rel}`;
}

/** Resolve every manifest entry to a native-readable path (pure; existence checked separately). */
export function locateMapAssets(
  baseDir: string,
  manifest: LocalMapManifest,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of listMapAssets(manifest)) {
    out[entry.assetId] = joinAssetPath(baseDir, entry.bundlePath);
  }
  return out;
}

/**
 * Reject any online tile/font/glyph/sprite endpoint found in local style text
 * (or other bundled text). Returns issues; empty = clean.
 */
export function assertNoOnlineResources(bundledText: string, where: string): MapLoaderIssue[] {
  if (HTTP_URL_RE.test(bundledText)) {
    return [
      {
        reason: "online_resource",
        detail: `${where}: contains http(s):// endpoint; map assets must stay local (INV-2)`,
      },
    ];
  }
  return [];
}

/**
 * Reject raw curation inputs leaking into shipped assets (INV-4).
 * The supplied `howtogetthereph_dataset/` directory is build input, never an asset.
 */
export function assertNoRawDatasetPaths(candidatePath: string): MapLoaderIssue[] {
  for (const marker of RAW_DATASET_RES) {
    if (candidatePath.includes(marker)) {
      return [
        {
          reason: "raw_dataset_path",
          detail: `${candidatePath}: references raw input marker "${marker}"; excluded from APK assets (INV-4)`,
        },
      ];
    }
  }
  return [];
}

/** Validate manifest shape + attribution + hash formats (hash presence checked by readiness). */
export function validateLocalMapManifest(manifest: LocalMapManifest): MapLoaderIssue[] {
  const issues: MapLoaderIssue[] = [];
  if (manifest.attributionText.trim().length === 0) {
    issues.push({ reason: "empty_attribution", detail: "attributionText must be non-empty (S2)" });
  }
  if (manifest.zoomMin < 0 || manifest.zoomMax < manifest.zoomMin) {
    issues.push({
      reason: "bad_manifest",
      detail: `invalid zoom range ${manifest.zoomMin}..${manifest.zoomMax}`,
    });
  }
  if (manifest.bbox.minLon >= manifest.bbox.maxLon || manifest.bbox.minLat >= manifest.bbox.maxLat) {
    issues.push({ reason: "bad_manifest", detail: "invalid extraction bbox (min must be < max)" });
  }
  for (const entry of listMapAssets(manifest)) {
    issues.push(...assertNoRawDatasetPaths(entry.bundlePath));
    if (entry.sha256 !== undefined && !SHA256_HEX_RE.test(entry.sha256)) {
      issues.push({
        reason: "bad_hash_format",
        detail: `${entry.assetId}: sha256 must be 64 lowercase hex chars`,
      });
    }
  }
  return issues;
}

export interface MapReadiness {
  state: MapAssetState;
  /** Bundle paths absent from the install (empty when ready). */
  missing: string[];
  issues: MapLoaderIssue[];
}

/**
 * Cold-offline readiness check (S2 input): every A5–A9 entry must exist locally,
 * attribution must be present, and no entry may point at raw-dataset paths.
 * `exists` is injected so Node and Expo adapters share this logic.
 */
export function checkLocalMapReadiness(
  manifest: LocalMapManifest,
  exists: (bundlePath: string) => boolean,
): MapReadiness {
  const manifestIssues = validateLocalMapManifest(manifest);
  const missing: string[] = [];
  for (const entry of listMapAssets(manifest)) {
    if (!exists(entry.bundlePath)) {
      missing.push(entry.bundlePath);
    }
  }
  const issues: MapLoaderIssue[] = [...manifestIssues];
  for (const path of missing) {
    issues.push({ reason: "missing_asset", detail: `${path}: not found locally` });
  }
  if (issues.length > 0) {
    const hasMissing = missing.length > 0;
    return { state: hasMissing ? "missing" : "failed", missing, issues };
  }
  return { state: "ready", missing, issues };
}
