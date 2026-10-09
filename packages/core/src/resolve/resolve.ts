import type { ResolveResult } from "../contracts/api";
import type { PlaceCandidate, PlaceMention, TripState } from "../contracts/intent";
import type { Pack } from "../pack/types";
import type { PlaceRow } from "../schema/pack";
import { osaDistance } from "../text/distance";
import { normalize } from "../text/normalize";

function unsupported(reason: "unsupported_place" | "no_trip_context" | "ncr_unresolved"): ResolveResult {
  return { status: "unsupported", reason, suggestions: [] };
}

function candidate(place: PlaceRow): PlaceCandidate {
  return { placeId: place.place_id, name: place.name, area: place.area, kind: place.kind };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function comparePlace(a: PlaceRow, b: PlaceRow): number {
  return compareText(a.name, b.name) || compareText(a.place_id, b.place_id);
}

function checkId(placeId: string, pack: Pack, match: "id" | "trip_ref" | "exact"): ResolveResult {
  const place = pack.places.get(placeId);
  if (!place) return unsupported("unsupported_place");
  if (place.ncr_status === "outside") return { status: "outside_ncr", placeId, name: place.name };
  if (place.ncr_status === "ambiguous") return unsupported("ncr_unresolved");
  return { status: "resolved", placeId, match };
}

function acceptedResult(places: PlaceRow[], match: "exact" | "fuzzy"): ResolveResult {
  if (places.length === 0) return unsupported("ncr_unresolved");
  if (places.length === 1) return { status: "resolved", placeId: places[0]!.place_id, match };
  return { status: "needs_clarification", candidates: places.slice(0, 4).map(candidate) };
}

export function resolve(mention: PlaceMention, pack: Pack, trip?: TripState): ResolveResult {
  if (mention.kind === "trip_ref") {
    const id = mention.ref === "origin" ? trip?.originPlaceId : trip?.destinationPlaceId;
    return id === undefined ? unsupported("no_trip_context") : checkId(id, pack, "trip_ref");
  }
  if (mention.kind === "place_id") return checkId(mention.placeId, pack, "id");
  const n = normalize(mention.text);
  if (!n) return unsupported("unsupported_place");
  const ambiguity = pack.ambiguitiesByNorm.get(n);
  if (ambiguity) {
    const places = ambiguity.map((id) => pack.places.get(id)!)
      .filter((place) => place.ncr_status === "accepted").sort(comparePlace);
    return acceptedResult(places, "exact");
  }
  const alias = pack.aliasesByNorm.get(n);
  if (alias) return checkId(alias.place_id, pack, "exact");
  const named = [...pack.places.values()].filter(place => normalize(place.name) === n).sort(comparePlace);
  if (named.length === 1) return checkId(named[0]!.place_id, pack, "exact");
  if (named.length > 1) return acceptedResult(named.filter(place => place.ncr_status === "accepted"), "exact");

  const threshold = n.length < 5 ? 0 : n.length < 9 ? 1 : 2;
  const scores = new Map<string, number>();
  function add(id: string, distance: number): void {
    scores.set(id, Math.min(scores.get(id) ?? Infinity, distance));
  }
  if (threshold > 0) {
    for (const place of pack.places.values()) {
      const distance = osaDistance(n, normalize(place.name), threshold);
      if (distance <= threshold) add(place.place_id, distance);
    }
    for (const [norm, row] of pack.aliasesByNorm) {
      const distance = osaDistance(n, norm, threshold);
      if (distance <= threshold) add(row.place_id, distance);
    }
    for (const [norm, ids] of pack.ambiguitiesByNorm) {
      const distance = osaDistance(n, norm, threshold);
      if (distance <= threshold) for (const id of ids) add(id, distance);
    }
  }
  const ranked = [...scores.keys()].map((id) => pack.places.get(id)!).sort((a, b) =>
    scores.get(a.place_id)! - scores.get(b.place_id)! || comparePlace(a, b));
  const accepted = ranked.filter((place) => place.ncr_status === "accepted");
  if (accepted.length > 0) return acceptedResult(accepted, "fuzzy");
  const outside = ranked.find((place) => place.ncr_status === "outside");
  if (outside) return { status: "outside_ncr", placeId: outside.place_id, name: outside.name };
  if (ranked.length > 0) return unsupported("ncr_unresolved");

  const tokens = new Set(n.split(" ").filter((token) => token.length >= 3));
  function suggest(norm: string, ids: readonly string[]): void {
    if (!norm.split(" ").some((token) => tokens.has(token))) return;
    const distance = osaDistance(n, norm);
    for (const id of ids) {
      if (pack.places.get(id)!.ncr_status === "accepted") add(id, distance);
    }
  }
  for (const [norm, row] of pack.aliasesByNorm) suggest(norm, [row.place_id]);
  for (const [norm, ids] of pack.ambiguitiesByNorm) suggest(norm, ids);
  const suggestions = [...scores.keys()].map((id) => pack.places.get(id)!).sort((a, b) =>
    scores.get(a.place_id)! - scores.get(b.place_id)! || comparePlace(a, b));
  return { status: "unsupported", reason: "unsupported_place", suggestions: suggestions.slice(0, 3).map(candidate) };
}
