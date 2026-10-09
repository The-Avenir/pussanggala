import type { Preference } from "../contracts/intent";
import type { RouteResult } from "../contracts/routing";
import type { Pack } from "../pack/types";
import { buildComparisons, rankItineraries } from "./rank";
import { searchItineraries } from "./search";

export function route(originPlaceId: string, destinationPlaceId: string, preference: Preference, pack: Pack): RouteResult {
  const result = searchItineraries(originPlaceId, destinationPlaceId, pack);
  if (result.status === "no_route") return result;
  const itineraries = rankItineraries(result.itineraries, preference);
  return { status: "ok", itineraries, comparisons: buildComparisons(itineraries) };
}
