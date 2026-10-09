/**
 * tools/map-pack public surface (T42 loader skeleton).
 * Re-export only — no logic here, so the T41 Expo adapter imports one module.
 */
export type {
  ConnectorStyle,
  GeometryKind,
  LocalMapManifest,
  MapAssetEntry,
  MapAssetKind,
  MapAssetState,
  MapContainer,
  MapLoaderIssue,
  MapLoaderReason,
  NcrExtractionBbox,
  ShapeRecord,
} from "./mapTypes.js";
export {
  SCHEMATIC_LABEL,
  SOURCE_PATH_LABEL,
  decideConnectorStyle,
  hasExactlyOneOwner,
  hasGeometryPayload,
  isSourceBackedPath,
  requireHonestConnectorStyle,
} from "./honestGeometry.js";
export {
  assertNoOnlineResources,
  assertNoRawDatasetPaths,
  checkLocalMapReadiness,
  joinAssetPath,
  listMapAssets,
  locateMapAssets,
  validateLocalMapManifest,
} from "./loader.js";
export type { MapReadiness } from "./loader.js";
