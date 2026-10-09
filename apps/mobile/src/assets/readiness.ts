/**
 * T41 readiness states + installed-footprint recorder (spike §§5–6).
 *
 * Pure TypeScript: no native, storage, or network imports. T44 owns any
 * INSTALLED_ASSET persistence. T47 can attach measured footprint rows to
 * release evidence; this module only shapes the
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
  | "allowlist"
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
  /** Measured copied bytes, null when I/O prevented measurement. */
  readonly bytes: number | null;
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
  readonly apkBytes?: number;
  /** Copied native-readable components (pack + model + map tree). */
  readonly copied?: readonly FootprintComponent[];
  /** user.sqlite bytes (INSTALLED_ASSET dump included). */
  readonly userBytes?: number;
  /** Measured duplicated storage, not inferred from compressed APK bytes. */
  readonly duplicatedBytes?: number;
  /** Peak PSS during the S4 soak, when measured (TBD until device runs). */
  readonly peakPssBytes?: number;
  /** Defaults to the time of recording. */
  readonly recordedAt?: string;
}

export interface FootprintSnapshot {
  readonly recordedAt: string;
  readonly apkBytes: number | null;
  readonly copiedBytes: number | null;
  readonly userBytes: number | null;
  readonly totalBytes: number | null;
  /** Physical duplication, unknown until measured; compressed APK bytes differ. */
  readonly duplicatedBytes: number | null;
  readonly peakPssBytes?: number;
  readonly note: string;
}

/** Record one installed-footprint snapshot (APK + copies + user data). */
export function recordFootprint(input: FootprintInput): FootprintSnapshot {
  const measured = (value: number | undefined): number | null => {
    if (value === undefined) return null;
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Footprint requires measured nonnegative integer bytes.");
    return value;
  };
  const copiedBytes = input.copied === undefined ? null : input.copied.reduce(
    (total, component) => total + (measured(component.bytes) ?? 0), 0,
  );
  const apkBytes = measured(input.apkBytes);
  const userBytes = measured(input.userBytes);
  const totalBytes = apkBytes === null || copiedBytes === null || userBytes === null
    ? null : apkBytes + copiedBytes + userBytes;
  if (copiedBytes !== null) measured(copiedBytes);
  if (totalBytes !== null) measured(totalBytes);
  if (input.peakPssBytes !== undefined) measured(input.peakPssBytes);
  const base = {
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    apkBytes,
    copiedBytes,
    userBytes,
    totalBytes,
    duplicatedBytes: measured(input.duplicatedBytes),
    note:
      "File-byte accounting only; unmeasured values are unknown. APK compression, " +
      "unpacked installation and duplicated storage require device measurements.",
  };
  if (input.peakPssBytes === undefined) return base;
  return { ...base, peakPssBytes: input.peakPssBytes };
}
