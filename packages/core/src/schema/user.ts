import { z } from "zod";
import { ID_PREFIXES, STABLE_ID_RE, stableId } from "../ids";
import { err, ok, type Result } from "../result";

const STEP_PREFIX = { access: "ac_", leg: "lg_", walk: "wk_" } as const;

export const StepRef = z
  .object({
    kind: z.enum(["access", "leg", "walk"]),
    id: z.string().regex(STABLE_ID_RE),
  })
  .refine((step) => step.id.startsWith(STEP_PREFIX[step.kind]), {
    message: "step id prefix must match its kind",
  });
export type StepRef = z.infer<typeof StepRef>;

export const ItineraryRef = z.object({
  v: z.literal(1),
  steps: z.array(StepRef).min(1),
});
export type ItineraryRef = z.infer<typeof ItineraryRef>;

export const UserSettingRow = z.object({
  key: z.string(),
  value: z.string(),
});
export type UserSettingRow = z.infer<typeof UserSettingRow>;

export const ActiveTripRow = z.object({
  trip_id: z.number().int(),
  pack_id: z.string(),
  schema_version: z.number().int(),
  origin_place_id: stableId(ID_PREFIXES.place),
  destination_place_id: stableId(ID_PREFIXES.place),
  preference: z.string(),
  route_json: z.string(),
  current_step: z.number().int().nonnegative(),
  started_at: z.string(),
});
export type ActiveTripRow = z.infer<typeof ActiveTripRow>;

export const SavedRouteRow = z.object({
  saved_id: z.string(),
  pack_id: z.string(),
  origin_place_id: stableId(ID_PREFIXES.place),
  destination_place_id: stableId(ID_PREFIXES.place),
  preference: z.string(),
  route_json: z.string(),
  label: z.string().nullable(),
  created_at: z.string(),
});
export type SavedRouteRow = z.infer<typeof SavedRouteRow>;

export const TripHistoryRow = z.object({
  history_id: z.string(),
  pack_id: z.string(),
  origin_place_id: stableId(ID_PREFIXES.place),
  destination_place_id: stableId(ID_PREFIXES.place),
  preference: z.string(),
  route_json: z.string(),
  kind: z.enum(["looked_up", "taken"]),
  at: z.string(),
});
export type TripHistoryRow = z.infer<typeof TripHistoryRow>;

export const InstalledAssetRow = z.object({
  asset_id: z.string(),
  kind: z.enum(["model", "pack", "map"]),
  file_path: z.string(),
  version: z.string(),
  sha256: z.string(),
  bytes: z.number().int().nonnegative(),
  state: z.enum(["missing", "verifying", "ready", "failed"]),
  license: z.string(),
});
export type InstalledAssetRow = z.infer<typeof InstalledAssetRow>;

export function parseRouteJson(
  routeJson: string,
): Result<ItineraryRef, "invalid_route_json"> {
  try {
    const parsed = ItineraryRef.safeParse(JSON.parse(routeJson));
    return parsed.success ? ok(parsed.data) : err("invalid_route_json");
  } catch {
    return err("invalid_route_json");
  }
}
