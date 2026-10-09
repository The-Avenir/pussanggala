/**
 * T41 asset loader: copy-on-first-launch locate + V0–V7 validation stubs
 * (apps/mobile/spike-t41-assets.md §§3–4).
 *
 * Pure TypeScript — no native, storage, or network imports. The Expo adapter
 * (owned with T40) performs the real FileSystem copy, real SHA-256, and the
 * SQLite open; it injects measurements here via LocalFileSnapshot and
 * ValidationInput. Hashes are compared before anything is opened (V1), and a
 * mismatch quarantines the file (failed/checksum) instead of opening it.
 *
 * Synthetic fixtures only: syntheticPinnedAssets()/syntheticSnapshotsPresent()
 * use an obviously-fake 64-hex stub. Real pack hashes/versions arrive via
 * Member-1/T15, the pinned model via Member-3/T31, tile bytes via T42 (TBD).
 */

import { ALLOWLIST, findForbiddenMarker } from "./allowlist.js";
import type { FailureReason, LocatedAsset } from "./readiness.js";

export const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const ONLINE_URL_RE = /https?:\/\//i;

/** Obviously-synthetic stub hash (NOT a real measurement; replaced at pin time). */
export const SYNTHETIC_SHA256 = "0123456789abcdef".repeat(4);

/** Schema versions this build knows how to open (V3; real versions land with T00/T20). */
export const KNOWN_SCHEMA_VERSIONS: readonly string[] = ["t41.stub.v0"];

/** Pinned expectations, checked into git as text (real values TBD). */
export interface PinnedAsset {
  readonly assetId: string;
  readonly sha256: string;
  readonly version: string;
}

/** Measured local-file facts supplied by the native adapter (stubbed in fixtures). */
export interface LocalFileSnapshot {
  readonly bundlePath: string;
  readonly exists: boolean;
  readonly bytes?: number;
  readonly sha256?: string;
}

export interface LoaderIssue {
  readonly reason: FailureReason;
  readonly detail: string;
}

export interface ValidationInput {
  readonly baseDir: string;
  readonly files: readonly LocalFileSnapshot[];
  readonly pinned: Readonly<Record<string, PinnedAsset>>;
  /** Raw text of assets/pack/manifest.json when available (V2–V4 stubs). */
  readonly packManifestText?: string;
  /** Raw text of assets/map/style.json when available (V5 local-URL audit). */
  readonly styleText?: string;
}

export function isPlausibleSha256(value: string): boolean {
  return SHA256_HEX_RE.test(value);
}

/** Join a native base dir and a bundle path without node:path (Expo-safe). */
export function joinAssetPath(baseDir: string, bundlePath: string): string {
  const base = baseDir.endsWith("/") ? baseDir.slice(0, -1) : baseDir;
  const rel = bundlePath.startsWith("/") ? bundlePath.slice(1) : bundlePath;
  return `${base}/${rel}`;
}

/**
 * Snapshot for one allowlist row. Prefix rows (trailing "/", e.g. the glyph
 * tree) aggregate: present when any file exists under the prefix; bytes summed;
 * sha256 stays undefined because per-file hashes pin separately (T42).
 */
function snapshotFor(
  bundlePath: string,
  files: readonly LocalFileSnapshot[],
): LocalFileSnapshot | undefined {
  if (!bundlePath.endsWith("/")) {
    for (const file of files) {
      if (file.bundlePath === bundlePath) return file;
    }
    return undefined;
  }
  let found = false;
  let bytes = 0;
  for (const file of files) {
    if (file.bundlePath.startsWith(bundlePath) && file.exists) {
      found = true;
      bytes += file.bytes ?? 0;
    }
  }
  if (!found) return undefined;
  return { bundlePath, exists: true, bytes };
}

function entryIdForPath(bundlePath: string): string | undefined {
  for (const entry of ALLOWLIST) {
    if (entry.bundlePath === bundlePath) return entry.assetId;
    if (entry.bundlePath.endsWith("/") && bundlePath.startsWith(entry.bundlePath)) {
      return entry.assetId;
    }
  }
  return undefined;
}

/**
 * V0 locate + V1 hash stub. Reads no storage and opens no files; it only
 * compares the injected snapshots against the pinned expectations.
 */
export function locateAssets(
  baseDir: string,
  files: readonly LocalFileSnapshot[],
  pinned: Readonly<Record<string, PinnedAsset>>,
): LocatedAsset[] {
  const out: LocatedAsset[] = [];
  for (const entry of ALLOWLIST) {
    const bundleUri = entry.bundlePath;
    const filePath = joinAssetPath(baseDir, entry.bundlePath);
    const snap = snapshotFor(entry.bundlePath, files);
    if (snap === undefined || !snap.exists) {
      out.push({
        assetId: entry.assetId,
        kind: entry.kind,
        bundleUri,
        filePath,
        version: "unknown",
        sha256: "",
        bytes: 0,
        state: "missing",
        license: entry.licenceRef,
        reason: "missing",
        detail: `${bundleUri}: not copied yet (V0 locate)`,
      });
      continue;
    }
    const pin = pinned[entry.assetId];
    if (pin === undefined) {
      out.push({
        assetId: entry.assetId,
        kind: entry.kind,
        bundleUri,
        filePath,
        version: "unknown",
        sha256: "",
        bytes: snap.bytes ?? 0,
        state: "failed",
        license: entry.licenceRef,
        reason: "checksum",
        detail: `${entry.assetId}: no pinned SHA-256 recorded (real pack hashes TBD)`,
      });
      continue;
    }
    if (snap.sha256 === undefined) {
      out.push({
        assetId: entry.assetId,
        kind: entry.kind,
        bundleUri,
        filePath,
        version: pin.version,
        sha256: "",
        bytes: snap.bytes ?? 0,
        state: "verifying",
        license: entry.licenceRef,
        detail: entry.bundlePath.endsWith("/")
          ? `${bundleUri}: tree present; per-file hashes TBD (T42)`
          : `${bundleUri}: hash not measured yet`,
      });
      continue;
    }
    if (!isPlausibleSha256(pin.sha256)) {
      out.push({
        assetId: entry.assetId,
        kind: entry.kind,
        bundleUri,
        filePath,
        version: pin.version,
        sha256: snap.sha256,
        bytes: snap.bytes ?? 0,
        state: "failed",
        license: entry.licenceRef,
        reason: "bad_hash_format",
        detail: `${entry.assetId}: pinned hash is malformed (must be 64 lowercase hex)`,
      });
      continue;
    }
    if (snap.sha256 !== pin.sha256) {
      out.push({
        assetId: entry.assetId,
        kind: entry.kind,
        bundleUri,
        filePath,
        version: pin.version,
        sha256: snap.sha256,
        bytes: snap.bytes ?? 0,
        state: "failed",
        license: entry.licenceRef,
        reason: "checksum",
        detail: `${bundleUri}: SHA-256 mismatch — quarantine, do not open (V1 hash-before-open)`,
      });
      continue;
    }
    out.push({
      assetId: entry.assetId,
      kind: entry.kind,
      bundleUri,
      filePath,
      version: pin.version,
      sha256: snap.sha256,
      bytes: snap.bytes ?? 0,
      state: "ready",
      license: entry.licenceRef,
    });
  }
  return out;
}

/**
 * V5 map-local audit stub: any http(s) endpoint in bundled style text fails
 * with network_source (INV-2). Missing stays a map_asset failure upstream —
 * there is never an online fallback.
 */
export function assertNoOnlineResources(bundledText: string, where: string): LoaderIssue[] {
  if (ONLINE_URL_RE.test(bundledText)) {
    return [
      {
        reason: "network_source",
        detail: `${where}: contains a remote endpoint; map assets must stay local (INV-2)`,
      },
    ];
  }
  return [];
}

const REQUIRED_MANIFEST_KEYS = [
  "pack_id",
  "schema_version",
  "region_id",
  "created_at",
  "stale_after_days",
] as const;

/**
 * V2 manifest-parse + V3 schema stubs: required keys present, disposition
 * counts sum (included+filtered+pending+rejected == answered), schema_version
 * known or flagged for the NeedsReplan path.
 */
export function validatePackManifestJson(text: string): LoaderIssue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return [{ reason: "manifest", detail: "pack manifest is not valid JSON (V2)" }];
  }
  if (typeof parsed !== "object" || parsed === null) {
    return [{ reason: "manifest", detail: "pack manifest must be a JSON object (V2)" }];
  }
  const obj = parsed as Record<string, unknown>;
  const issues: LoaderIssue[] = [];
  for (const key of REQUIRED_MANIFEST_KEYS) {
    if (obj[key] === undefined) {
      issues.push({ reason: "manifest", detail: `pack manifest missing required key "${key}" (V2)` });
    }
  }
  const schemaVersion = obj["schema_version"];
  if (typeof schemaVersion === "string" && !KNOWN_SCHEMA_VERSIONS.includes(schemaVersion)) {
    issues.push({
      reason: "schema",
      detail: `unknown schema_version "${schemaVersion}" — NeedsReplan path, do not restore (V3)`,
    });
  }
  const included = obj["included"];
  const filtered = obj["filtered"];
  const pending = obj["pending"];
  const rejected = obj["rejected"];
  const answered = obj["answered"];
  if (
    typeof included === "number" &&
    typeof filtered === "number" &&
    typeof pending === "number" &&
    typeof rejected === "number" &&
    typeof answered === "number"
  ) {
    if (included + filtered + pending + rejected !== answered) {
      issues.push({
        reason: "manifest",
        detail: "disposition counts do not sum: included+filtered+pending+rejected != answered (V2)",
      });
    }
  }
  return issues;
}

/**
 * Full V0–V7 stub pipeline: locate + hash, then overlays for raw-dataset paths
 * (INV-4), manifest/schema (V2–V3), and the style local-URL audit (V5). V4
 * eligibility, V6 model-header, and V7 persistence land with the real
 * pack/model adapters (T15/T31); until then ready means "located + hash stub
 * matched", recorded honestly as synthetic.
 */
export function runValidationPipeline(input: ValidationInput): LocatedAsset[] {
  const located = locateAssets(input.baseDir, input.files, input.pinned);
  const overlay = new Map<string, LoaderIssue>();

  for (const file of input.files) {
    const marker = findForbiddenMarker(file.bundlePath);
    if (marker === undefined) continue;
    const assetId = entryIdForPath(file.bundlePath);
    if (assetId !== undefined && !overlay.has(assetId)) {
      overlay.set(assetId, {
        reason: "raw_dataset_path",
        detail: `${file.bundlePath}: references forbidden marker "${marker}" (INV-4)`,
      });
    }
  }

  if (input.packManifestText !== undefined) {
    const issues = validatePackManifestJson(input.packManifestText);
    const first = issues[0];
    if (first !== undefined) {
      const target = first.reason === "schema" ? "A1-pack-db" : "A2-pack-manifest";
      if (!overlay.has(target)) overlay.set(target, first);
    }
  }

  if (input.styleText !== undefined) {
    const issues = assertNoOnlineResources(input.styleText, "assets/map/style.json");
    const first = issues[0];
    if (first !== undefined && !overlay.has("A6-map-style")) {
      overlay.set("A6-map-style", first);
    }
  }

  return located.map((asset) => {
    const issue = overlay.get(asset.assetId);
    if (issue === undefined) return asset;
    if (asset.state === "missing") return asset;
    const failed: LocatedAsset = {
      ...asset,
      state: "failed",
      reason: issue.reason,
      detail: issue.detail,
    };
    return failed;
  });
}

/** Synthetic pinned config for local/dev use only (stub hashes, NOT real measurements). */
export function syntheticPinnedAssets(version = "synthetic-t41.0"): Record<string, PinnedAsset> {
  const out: Record<string, PinnedAsset> = {};
  for (const entry of ALLOWLIST) {
    out[entry.assetId] = { assetId: entry.assetId, sha256: SYNTHETIC_SHA256, version };
  }
  return out;
}

/** Synthetic present-files fixture: every row exists with the stub hash. */
export function syntheticSnapshotsPresent(): LocalFileSnapshot[] {
  const out: LocalFileSnapshot[] = [];
  for (const entry of ALLOWLIST) {
    if (entry.bundlePath.endsWith("/")) {
      out.push({
        bundlePath: `${entry.bundlePath}NotoSans/0-255.pbf`,
        exists: true,
        bytes: 128,
        sha256: SYNTHETIC_SHA256,
      });
    } else {
      out.push({
        bundlePath: entry.bundlePath,
        exists: true,
        bytes: 1024,
        sha256: SYNTHETIC_SHA256,
      });
    }
  }
  return out;
}
