/** Compatibility for the labelled T45 demo only. These pins MUST fail production setup. */
import { ALLOWLIST } from "./allowlist";
import type { LocalFileSnapshot, PinnedAsset } from "./loader";
export const SYNTHETIC_SHA256 = "0123456789abcdef".repeat(4);
export function syntheticPinnedAssets(version = "synthetic-demo"): Record<string, PinnedAsset> {
  return Object.fromEntries(ALLOWLIST.map(entry => [entry.assetId, { assetId: entry.assetId, sha256: SYNTHETIC_SHA256, version }]));
}
export function syntheticSnapshotsPresent(): LocalFileSnapshot[] {
  return ALLOWLIST.map(entry => ({ bundlePath: entry.bundlePath, exists: true, bytes: 1024, sha256: SYNTHETIC_SHA256 }));
}
