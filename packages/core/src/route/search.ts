import type { FareTotal, Itinerary, RouteResult } from "../contracts/routing";
import { itineraryId } from "../ids";
import type { Pack } from "../pack/types";
import { known, unknown, type Known } from "../result";
import type { PlaceStopRow } from "../schema/pack";
import type { StepRef } from "../schema/user";
import { getGraph, type Edge } from "./graph";

export interface SearchOptions {
  maxLegs?: number;
  maxExpansions?: number;
}

export type SearchResult = { status: "ok"; itineraries: Itinerary[] } | Extract<RouteResult, { status: "no_route" }>;

function sumKnown(values: (number | null)[]): Known<number> {
  let total = 0;
  for (const value of values) {
    if (value === null) return unknown();
    total += value;
  }
  return known(total);
}

export function buildItinerary(steps: StepRef[], originPlaceId: string, destinationPlaceId: string, pack: Pack): Itinerary {
  const origin = pack.placeStops.get(steps[0]!.id)!;
  const destination = pack.placeStops.get(steps.at(-1)!.id)!;
  const records = new Set([originPlaceId, destinationPlaceId, origin.access_id, destination.access_id, origin.stop_id, destination.stop_id]);
  const routeIds: string[] = [];
  const fareIds: string[] = [];
  const missingLegIds: string[] = [];
  const minutes = [origin.walk_min, destination.walk_min];
  const meters = [origin.walk_m, destination.walk_m];
  let min = 0;
  let max = 0;
  let conflict = false;
  for (const step of steps.slice(1, -1)) {
    if (step.kind === "walk") {
      const walk = pack.walks.get(step.id)!;
      for (const id of [walk.walk_id, walk.from_stop_id, walk.to_stop_id]) records.add(id);
      minutes.push(walk.walk_min);
      meters.push(walk.walk_m);
      continue;
    }
    const leg = pack.legs.get(step.id)!;
    routeIds.push(leg.route_id);
    for (const id of [leg.leg_id, leg.route_id, leg.board_stop_id, leg.alight_stop_id]) records.add(id);
    minutes.push(leg.ride_min);
    const fares = pack.faresByLeg.get(leg.leg_id) ?? [];
    if (fares.length === 0) {
      missingLegIds.push(leg.leg_id);
      continue;
    }
    min += Math.min(...fares.map((fare) => fare.amount_min));
    max += Math.max(...fares.map((fare) => fare.amount_max));
    conflict ||= new Set(fares.map((fare) => `${fare.amount_min}:${fare.amount_max}`)).size > 1;
    for (const fare of fares) {
      fareIds.push(fare.fare_id);
      records.add(fare.fare_id);
    }
  }
  const fare: FareTotal = missingLegIds.length
    ? { status: "unknown", missingLegIds: missingLegIds.sort() }
    : { status: "known", min, max, currency: "PHP", conflict, fareIds: [...new Set(fareIds)].sort() };
  return {
    id: itineraryId(steps), ref: { v: 1, steps: steps.map((step) => ({ ...step })) }, originPlaceId, destinationPlaceId,
    rideCount: routeIds.length, transferCount: routeIds.length - 1, fare,
    reportedRideMinutes: sumKnown(minutes), walkMeters: sumKnown(meters), routeIds, recordIds: [...records].sort(),
  };
}

export function searchItineraries(originPlaceId: string, destinationPlaceId: string, pack: Pack, opts: SearchOptions = {}): SearchResult {
  if (originPlaceId === destinationPlaceId) return { status: "no_route", reason: "same_place" };
  const graph = getGraph(pack);
  const origins = graph.originAccesses(originPlaceId);
  if (pack.places.get(originPlaceId)?.ncr_status !== "accepted" || !origins.length) return { status: "no_route", reason: "no_origin_access" };
  const destinations = graph.destinationAccesses(destinationPlaceId);
  if (pack.places.get(destinationPlaceId)?.ncr_status !== "accepted" || !destinations.length) return { status: "no_route", reason: "no_destination_access" };
  const destinationsByStop = new Map<string, PlaceStopRow[]>();
  for (const access of destinations) {
    const list = destinationsByStop.get(access.stop_id) ?? [];
    list.push(access);
    destinationsByStop.set(access.stop_id, list);
  }
  const maxLegs = Math.min(opts.maxLegs ?? 4, 4);
  const maxExpansions = opts.maxExpansions ?? 50_000;
  const itineraries = new Map<string, Itinerary>();
  let expansions = 0;
  for (const origin of origins) {
    const visited = new Set([origin.stop_id]);
    const path: Edge[] = [];
    const visit = (stopId: string, rideCount: number) => {
      if (expansions >= maxExpansions) return;
      expansions++;
      if (rideCount > 0) {
        for (const destination of destinationsByStop.get(stopId) ?? []) {
          const steps: StepRef[] = [
            { kind: "access", id: origin.access_id },
            ...path.map((edge): StepRef => edge.kind === "leg" ? { kind: "leg", id: edge.leg.leg_id } : { kind: "walk", id: edge.walk.walk_id }),
            { kind: "access", id: destination.access_id },
          ];
          const itinerary = buildItinerary(steps, originPlaceId, destinationPlaceId, pack);
          itineraries.set(itinerary.id, itinerary);
        }
      }
      const previous = path.at(-1);
      for (const edge of graph.outByStop.get(stopId) ?? []) {
        if (expansions >= maxExpansions) break;
        if (edge.kind === "leg" && (rideCount >= maxLegs || (previous?.kind === "leg" && previous.leg.route_id === edge.leg.route_id))) continue;
        if (edge.kind === "walk" && previous?.kind === "walk") continue;
        const nextStop = edge.kind === "leg" ? edge.leg.alight_stop_id : edge.walk.to_stop_id;
        if (visited.has(nextStop)) continue;
        visited.add(nextStop);
        path.push(edge);
        visit(nextStop, rideCount + (edge.kind === "leg" ? 1 : 0));
        path.pop();
        visited.delete(nextStop);
      }
    };
    visit(origin.stop_id, 0);
    if (expansions >= maxExpansions) break;
  }
  return itineraries.size ? { status: "ok", itineraries: [...itineraries.values()] } : { status: "no_route", reason: "no_route" };
}
