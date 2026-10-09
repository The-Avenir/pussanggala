import { z } from 'zod';
import { parseRouteJson } from '../core';

const placeId = z.string().regex(/^pl_[a-z0-9][a-z0-9_-]{0,63}$/);
export const opaqueId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/);
export const timestamp = z.iso.datetime({ offset: true });
export const preference = z.enum(['balanced', 'lowest_fare', 'fewest_transfers', 'shortest_reported_time']);
export const labelSchema = z.string().trim().max(80).nullable();

// Core parsing intentionally strips unknown fields. Persistence is stricter:
// reject additional fields even inside steps before any write can occur.
const step = z.strictObject({ kind: z.enum(['access', 'leg', 'walk']), id: z.string() });
export const itinerarySchema = z.strictObject({ v: z.literal(1), steps: z.array(step).min(1).max(12) })
  .refine((ref) => parseRouteJson(JSON.stringify(ref)).ok);
const routeJson = z.string().max(4096).refine((text) => {
  try { return itinerarySchema.safeParse(JSON.parse(text)).success; } catch { return false; }
});

export const selectionSchema = z.strictObject({
  originPlaceId: placeId,
  destinationPlaceId: placeId,
  preference,
  itinerary: itinerarySchema,
});
export type RouteSelection = z.infer<typeof selectionSchema>;
export type HistoryKind = 'looked_up' | 'taken';

const columns = {
  pack_id: opaqueId, origin_place_id: placeId, destination_place_id: placeId,
  preference, route_json: routeJson,
};
export const activeSchema = z.strictObject({
  ...columns, trip_id: z.literal(1), schema_version: z.number().int().positive(),
  current_step: z.number().int().nonnegative(), started_at: timestamp,
});
export const savedSchema = z.strictObject({
  ...columns, saved_id: opaqueId, label: labelSchema, created_at: timestamp,
});
export const historySchema = z.strictObject({
  ...columns, history_id: opaqueId, kind: z.enum(['looked_up', 'taken']), at: timestamp,
});
