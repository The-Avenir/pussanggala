/** Shared runtime/build packaging policy. Entries authorize paths, not readiness. */
export {
  ALLOWLIST, FORBIDDEN_PATH_MARKERS, entryForBundlePath, findForbiddenMarker,
  isAllowlisted, isSafeBundlePath, listBundlePaths,
} from "./shipping-policy.mjs";
export type { AllowlistEntry, AssetKind } from "./shipping-policy.mjs";
