import type { Preference } from "../contracts/intent";
import type { ComparisonStatement, Itinerary } from "../contracts/routing";

function dominates(a: Itinerary, b: Itinerary): boolean {
  if (a.fare.status !== "known" || b.fare.status !== "known" || !a.reportedRideMinutes.known || !b.reportedRideMinutes.known) return false;
  return a.rideCount <= b.rideCount && a.fare.max <= b.fare.min && a.reportedRideMinutes.value <= b.reportedRideMinutes.value
    && (a.rideCount < b.rideCount || a.fare.max < b.fare.min || a.reportedRideMinutes.value < b.reportedRideMinutes.value);
}

export function paretoFilter(itineraries: readonly Itinerary[]): Itinerary[] {
  return itineraries.filter((candidate) => !itineraries.some((other) => other !== candidate && dominates(other, candidate)));
}

function compareKnown(a: number | undefined, b: number | undefined): number {
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  return a - b;
}

export function rankItineraries(itineraries: readonly Itinerary[], preference: Preference): Itinerary[] {
  return paretoFilter(itineraries).sort((a, b) => {
    const rides = a.rideCount - b.rideCount;
    const fare = compareKnown(a.fare.status === "known" ? a.fare.min : undefined, b.fare.status === "known" ? b.fare.min : undefined);
    const fareMax = compareKnown(a.fare.status === "known" ? a.fare.max : undefined, b.fare.status === "known" ? b.fare.max : undefined);
    const time = compareKnown(a.reportedRideMinutes.known ? a.reportedRideMinutes.value : undefined, b.reportedRideMinutes.known ? b.reportedRideMinutes.value : undefined);
    let order: number;
    switch (preference) {
      case "lowest_fare": order = fare || fareMax || rides || time; break;
      case "fewest_transfers": order = rides || fare || time; break;
      case "shortest_reported_time": order = time || rides || fare; break;
      case "balanced": order = rides || time || fare; break;
    }
    return order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }).slice(0, 5);
}

export function buildComparisons(itineraries: readonly Itinerary[]): ComparisonStatement[] {
  const comparisons: ComparisonStatement[] = [];
  const priced = itineraries.filter((item) => item.fare.status === "known");
  const unpriced = itineraries.filter((item) => item.fare.status === "unknown").map((item) => item.id);
  if (priced.length >= 2) {
    const winner = priced.find((candidate) => {
      const fare = candidate.fare;
      return fare.status === "known" && priced.every((other) => other === candidate || (other.fare.status === "known" && fare.max < other.fare.min));
    });
    if (winner) comparisons.push({
      kind: "lowest_reported_fare", winnerId: winner.id, comparedIds: priced.map((item) => item.id), excludedUnknownIds: unpriced,
      text: `Lowest reported fare among ${priced.length} options with fare information.${unpriced.length ? ` ${unpriced.length} option(s) have no fare information.` : ""}`,
    });
  }
  if (itineraries.length >= 2) {
    const winner = itineraries.find((candidate) => itineraries.every((other) => other === candidate || candidate.rideCount < other.rideCount));
    if (winner) comparisons.push({
      kind: "fewest_rides", winnerId: winner.id, comparedIds: itineraries.map((item) => item.id), excludedUnknownIds: [],
      text: `Fewest rides among ${itineraries.length} options.`,
    });
  }
  const timed = itineraries.filter((item) => item.reportedRideMinutes.known);
  const untimed = itineraries.filter((item) => !item.reportedRideMinutes.known).map((item) => item.id);
  if (timed.length >= 2) {
    const winner = timed.find((candidate) => {
      const time = candidate.reportedRideMinutes;
      return time.known && timed.every((other) => other === candidate || (other.reportedRideMinutes.known && time.value < other.reportedRideMinutes.value));
    });
    if (winner) comparisons.push({
      kind: "shortest_reported_time", winnerId: winner.id, comparedIds: timed.map((item) => item.id), excludedUnknownIds: untimed,
      text: `Shortest reported travel time among ${timed.length} options with time information (reported, not guaranteed).${untimed.length ? ` ${untimed.length} option(s) have no time information.` : ""}`,
    });
  }
  return comparisons;
}
