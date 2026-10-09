/**
 * T41 readiness states + installed-footprint recorder (spike §§5–6).
 *
 * Pure TypeScript: no native, storage, or network imports. The Expo adapter
 * persists LocatedAsset rows to INSTALLED_ASSET (SDD §3.3) and attaches
 * FootprintSnapshot rows to T47 release evidence; this module only shapes the
 * data and aggregates states. Asset errors never crash the app and never
 * trigger a network fallback (PRD-F8) — that policy lives in the consumers.
 */

import type { AssetKind } from "./allowlist.js";

/** Per-asset lifecycle state (mirrors INSTALLED_ASSET.state, spike §5). */
export type AssetState = "missing" | "verifying" | "ready" | "failed";

/** Typed failure reasons mapped to distinct recovery messages (PRD-F9). */
export type FailureReason =
  | "missing"
  | "io"
  | "checksum"
  | "manifest"
  | "schema"
  | "pack_invalid"
  | "empty_pack"
  | "map_asset"
  | "network_source"
  | "model_incompatible"
  | "licence"
  | "raw_dataset_path"
  | "bad_hash_format";

/** One located asset: where the APK carries it plus the native path actually opened. */
export interface LocatedAsset {
  readonly assetId: string;
  readonly kind: AssetKind;
  /** Where the APK carries it (A1–A10 bundle path). */
  readonly bundleUri: string;
  /** Native-readable copied path actually opened (copy-on-first-launch, spike §3). */
  readonly filePath: string;
  /** pack_id / model revision / map build date (TBD until real bytes land). */
  readonly version: string;
  /** Measured SHA-256 of the copied file ("" until measured). */
  readonly sha256: string;
  /** Measured copied bytes. */
  readonly bytes: number;
  readonly state: AssetState;
  /** Licence/attribution reference for this asset. */
  readonly license: string;
  readonly reason?: FailureReason;
  readonly detail?: string;
}

export interface ReadinessSummary {
  readonly state: AssetState;
  readonly total: number;
  readonly ready: number;
  readonly missing: number;
  readonly verifying: number;
  readonly failed: number;
}

/**
 * Aggregate per-asset states. Priority: failed > missing > verifying > ready.
 * An empty asset list means setup never ran, so it reports missing, not ready.
 */
export function summarizeReadiness(assets: readonly LocatedAsset[]): ReadinessSummary {
  let ready = 0;
  let missing = 0;
  let verifying = 0;
  let failed = 0;
  for (const asset of assets) {
    if (asset.state === "ready") ready += 1;
    else if (asset.state === "missing") missing += 1;
    else if (asset.state === "verifying") verifying += 1;
    else failed += 1;
  }
  const total = assets.length;
  let state: AssetState = "ready";
  if (total === 0) state = "missing";
  else if (failed > 0) state = "failed";
  else if (missing > 0) state = "missing";
  else if (verifying > 0) state = "verifying";
  return { state, total, ready, missing, verifying, failed };
}

/** True only when every asset is ready (and at least one asset exists). */
export function isFullyReady(assets: readonly LocatedAsset[]): boolean {
  return assets.length > 0 && assets.every((asset) => asset.state === "ready");
}

/** Failed assets for the recovery screen (PRD-F9 distinct messages). */
export function listFailures(assets: readonly LocatedAsset[]): readonly LocatedAsset[] {
  return assets.filter((asset) => asset.state === "failed");
}

export interface FootprintComponent {
  readonly name: string;
  readonly bytes: number;
}

export interface FootprintInput {
  /** Judged release APK bytes on the reference phone. */
  readonly apkBytes: number;
  /** Copied native-readable components (pack + model + map tree). */
  readonly copied: readonly FootprintComponent[];
  /** user.sqlite bytes (INSTALLED_ASSET dump included). */
  readonly userBytes: number;
  /** Peak PSS during the S4 soak, when measured (TBD until device runs). */
  readonly peakPssBytes?: number;
  /** Defaults to the time of recording. */
  readonly recordedAt?: string;
}

export interface FootprintSnapshot {
  readonly recordedAt: string;
  readonly apkBytes: number;
  readonly copiedBytes: number;
  readonly userBytes: number;
  readonly totalBytes: number;
  /**
   * Bytes double-counted on purpose: the copied tree duplicates APK bytes on
   * Android. Expected, reported explicitly — never hidden (spike §6, PRD M9).
   */
  readonly duplicatedBytes: number;
  readonly peakPssBytes?: number;
  readonly note: string;
}

/** Record one installed-footprint snapshot (APK + copies + user data). */
export function recordFootprint(input: FootprintInput): FootprintSnapshot {
  let copiedBytes = 0;
  for (const component of input.copied) copiedBytes += component.bytes;
  const base = {
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    apkBytes: input.apkBytes,
    copiedBytes,
    userBytes: input.userBytes,
    totalBytes: input.apkBytes + copiedBytes + input.userBytes,
    duplicatedBytes: copiedBytes,
    note:
      "APK bytes + copied native-readable bytes count the same logical " +
      "assets twice (expected Android duplication, PRD M9).",
  };
  if (input.peakPssBytes === undefined) return base;
  return { ...base, peakPssBytes: input.peakPssBytes };
}
