/** Legacy T45 demo interface. Production startup imports assets/index.ts. */
import { ALLOWLIST } from "./allowlist";
import { joinAssetPath } from "./paths";
import { isMeasuredSha256, parsePackCompanion } from "./pack-loader";
import type { LoaderIssue } from "./pack-loader";
import type { LocatedAsset } from "./readiness";
export * from "./setup";
export interface PinnedAsset { readonly assetId: string; readonly sha256: string; readonly version: string }
export interface LocalFileSnapshot { readonly bundlePath: string; readonly exists: boolean; readonly bytes?: number; readonly sha256?: string }
export interface ValidationInput { readonly baseDir: string; readonly files: readonly LocalFileSnapshot[]; readonly pinned: Readonly<Record<string, PinnedAsset>>; readonly packManifestText?: string; readonly styleText?: string }
export function isPlausibleSha256(value: string): boolean { return isMeasuredSha256(value); }
export function validatePackManifestJson(text: string): LoaderIssue[] {
  const parsed = parsePackCompanion(text);
  return parsed.ok ? [] : [parsed.error];
}
/** Snapshot-only setup never reports ready: it cannot perform native/core validation. */
export function locateAssets(baseDir: string, files: readonly LocalFileSnapshot[], pinned: Readonly<Record<string, PinnedAsset>>): LocatedAsset[] {
  return ALLOWLIST.map(entry => {
    const file = files.find(f => f.bundlePath === entry.bundlePath);
    const pin = pinned[entry.assetId];
    return {
      assetId: entry.assetId, kind: entry.kind, bundleUri: entry.bundlePath,
      filePath: joinAssetPath(baseDir, entry.bundlePath), version: pin?.version ?? "unknown",
      sha256: "", bytes: 0, license: entry.licenceRef,
      state: file?.exists ? "failed" : "missing", reason: file?.exists ? "manifest" : "missing",
      detail: "Snapshot-only/demo setup cannot validate or publish production readiness.",
    };
  });
}
export function runValidationPipeline(input: ValidationInput): LocatedAsset[] {
  return locateAssets(input.baseDir, input.files, input.pinned);
}
export { syntheticPinnedAssets, syntheticSnapshotsPresent } from "./demo-fixtures";
