export type AssetKind = "pack" | "model" | "map" | "style" | "glyphs" | "sprites" | "licence";
export interface AllowlistEntry {
  readonly assetId: string; readonly kind: AssetKind; readonly bundlePath: string;
  readonly description: string; readonly licenceRef: string;
}
export const ALLOWLIST: readonly AllowlistEntry[];
export const FORBIDDEN_PATH_MARKERS: readonly string[];
export const UI_ASSET_PATHS: readonly string[];
export const NON_SHIPPED_ASSET_DOCS: readonly string[];
export function findForbiddenMarker(value: string): string | undefined;
export function isSafeBundlePath(value: string): boolean;
export function entryForBundlePath(value: string): AllowlistEntry | undefined;
export function isAllowlisted(value: string): boolean;
export function isPackagedPath(value: string): boolean;
export function listBundlePaths(): readonly string[];
