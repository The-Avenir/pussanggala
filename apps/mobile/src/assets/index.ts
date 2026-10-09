export { setupLocalAssets, retainValidCards } from "./setup";
export type { AssetSpec, AssetSetupResult } from "./setup";
export type { AssetPorts, LocalFilePort, BundledAssetPort, PackDatabase, PackSqlitePort } from "./ports";
export { summarizeReadiness, recordFootprint } from "./readiness";
export type { LocatedAsset, FootprintInput, FootprintSnapshot } from "./readiness";
// This production entry intentionally does not export demo fixtures or snapshot loaders.
