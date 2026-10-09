import type { ReplanReason } from "../contracts/api";
import type { Itinerary } from "../contracts/routing";
import type { Pack } from "../pack/types";
import { buildItinerary } from "../route/search";
import { parseRouteJson } from "../schema/user";

export interface SavedTrip {
  packId: string;
  schemaVersion: number;
  originPlaceId: string;
  destinationPlaceId: string;
  preference: string;
  routeJson: string;
  currentStep: number;
}

export type RestorationResult = { status: "valid"; itinerary: Itinerary; currentStep: number } | { status: "needs_replan"; reason: ReplanReason };

export function validateRestoration(saved: SavedTrip, pack: Pack): RestorationResult {
  const fail = (reason: ReplanReason): RestorationResult => ({ status: "needs_replan", reason });
  if (saved.schemaVersion !== pack.manifest.schema_version) return fail("schema_changed");
  const parsed = parseRouteJson(saved.routeJson);
  if (!parsed.ok) return fail("invalid_route_json");
  const steps = parsed.value.steps;
  const records = steps.map((step) => step.kind === "access" ? pack.placeStops.get(step.id) : step.kind === "leg" ? pack.legs.get(step.id) : pack.walks.get(step.id));
  const origin = pack.places.get(saved.originPlaceId);
  const destination = pack.places.get(saved.destinationPlaceId);
  if (records.some((record) => record === undefined) || !origin || !destination) return fail("record_missing");
  if (records.some((record) => record!.eligibility === "excluded") || origin.ncr_status !== "accepted" || destination.ncr_status !== "accepted") return fail("record_ineligible");
  for (const step of steps) {
    if (step.kind === "leg") {
      const route = pack.routes.get(pack.legs.get(step.id)!.route_id)!;
      if (route.service_status === "suspended" || route.service_status === "retired") return fail("service_suspended");
    }
  }
  const first = steps[0]!;
  const last = steps.at(-1)!;
  if (first.kind !== "access" || last.kind !== "access") return fail("endpoint_mismatch");
  const start = pack.placeStops.get(first.id)!;
  const end = pack.placeStops.get(last.id)!;
  if (start.place_id !== saved.originPlaceId || end.place_id !== saved.destinationPlaceId || start.direction === "from_stop" || end.direction === "to_stop") return fail("endpoint_mismatch");
  let stopId = start.stop_id;
  let previousRouteId: string | undefined;
  let previousKind: "leg" | "walk" | undefined;
  let rides = 0;
  const visited = new Set([stopId]);
  for (const step of steps.slice(1, -1)) {
    if (step.kind === "access") return fail("continuity_broken");
    let nextStop: string;
    if (step.kind === "leg") {
      const leg = pack.legs.get(step.id)!;
      if (leg.board_stop_id !== stopId || (previousKind === "leg" && previousRouteId === leg.route_id)) return fail("continuity_broken");
      nextStop = leg.alight_stop_id;
      previousRouteId = leg.route_id;
      rides++;
    } else {
      const walk = pack.walks.get(step.id)!;
      if (walk.from_stop_id !== stopId || previousKind === "walk") return fail("continuity_broken");
      nextStop = walk.to_stop_id;
    }
    if (visited.has(nextStop)) return fail("continuity_broken");
    visited.add(nextStop);
    stopId = nextStop;
    previousKind = step.kind;
  }
  if (stopId !== end.stop_id || rides < 1 || rides > 4) return fail("continuity_broken");
  if (!Number.isInteger(saved.currentStep) || saved.currentStep < 0 || saved.currentStep >= steps.length) return fail("step_out_of_bounds");
  return { status: "valid", itinerary: buildItinerary(steps, saved.originPlaceId, saved.destinationPlaceId, pack), currentStep: saved.currentStep };
}
