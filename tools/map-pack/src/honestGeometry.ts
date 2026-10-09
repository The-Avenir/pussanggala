/**
 * Honest-geometry rule (T42, SDD §1.6 / §3.2, PRD-F6/F12).
 *
 * Default: dashed schematic labelled "not to scale".
 * Solid rendering requires a source_path SHAPE with geometry + evidence.
 * An OSM road polyline without a transit RECORD_SOURCE link is NOT evidence.
 */
import type { ConnectorStyle, ShapeRecord } from "./mapTypes.js";

export const SCHEMATIC_LABEL = "schematic — not to scale";
export const SOURCE_PATH_LABEL = "source-backed path";

/** Exactly one owner: legId XOR walkId. */
export function hasExactlyOneOwner(shape: Pick<ShapeRecord, "legId" | "walkId">): boolean {
  const hasLeg = shape.legId !== undefined && shape.legId !== "";
  const hasWalk = shape.walkId !== undefined && shape.walkId !== "";
  return hasLeg !== hasWalk;
}

/** Non-empty geometry payload (non-blank GeoJSON text; full schema check lives in T20/T41). */
export function hasGeometryPayload(geojson: string): boolean {
  return geojson.trim().length > 0;
}

/**
 * True only when the shape may render solid: source_path + geometry +
 * exactly-one-owner + at least one evidence source id.
 */
export function isSourceBackedPath(shape: ShapeRecord): boolean {
  if (shape.geometryKind !== "source_path") return false;
  if (!hasGeometryPayload(shape.geojson)) return false;
  if (!hasExactlyOneOwner(shape)) return false;
  if (shape.sourceIds.length === 0) return false;
  return true;
}

/**
 * Decide how one connector renders. `undefined`/`null` (no SHAPE row) is always
 * dashed schematic. Never throws for missing evidence — it falls back honestly.
 */
export function decideConnectorStyle(
  shape: ShapeRecord | undefined | null,
): ConnectorStyle {
  if (shape !== undefined && shape !== null && isSourceBackedPath(shape)) {
    return { kind: "source_path", dashed: false, label: SOURCE_PATH_LABEL };
  }
  return { kind: "schematic", dashed: true, label: SCHEMATIC_LABEL };
}

/**
 * Strict variant for render paths that must refuse a solid request without
 * evidence instead of silently downgrading. Returns the style or throws.
 */
export function requireHonestConnectorStyle(
  shape: ShapeRecord | undefined | null,
  opts?: { allowSchematicFallback?: boolean },
): ConnectorStyle {
  const allowFallback = opts?.allowSchematicFallback ?? true;
  const style = decideConnectorStyle(shape);
  if (style.kind === "schematic" && !allowFallback && shape !== undefined && shape !== null) {
    throw new Error(
      `refused solid connector for shape ${shape.shapeId}: source_path evidence required`,
    );
  }
  return style;
}
