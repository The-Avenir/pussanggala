import type { Known } from "../result";
import type { ItineraryRef } from "../schema/user";

export type FareTotal =
  | {
      status: "known";
      min: number;
      max: number;
      currency: "PHP";
      conflict: boolean;
      fareIds: string[];
    }
  | { status: "unknown"; missingLegIds: string[] };

export interface Itinerary {
  id: string;
  ref: ItineraryRef;
  originPlaceId: string;
  destinationPlaceId: string;
  rideCount: number;
  transferCount: number;
  fare: FareTotal;
  reportedRideMinutes: Known<number>;
  walkMeters: Known<number>;
  routeIds: string[];
  recordIds: string[];
}

export type ComparisonKind =
  | "lowest_reported_fare"
  | "fewest_rides"
  | "shortest_reported_time";

export interface ComparisonStatement {
  kind: ComparisonKind;
  winnerId: string;
  comparedIds: string[];
  excludedUnknownIds: string[];
  text: string;
}

export type RouteResult =
  | {
      status: "ok";
      itineraries: Itinerary[];
      comparisons: ComparisonStatement[];
    }
  | {
      status: "no_route";
      reason:
        | "same_place"
        | "no_origin_access"
        | "no_destination_access"
        | "no_route";
    };
