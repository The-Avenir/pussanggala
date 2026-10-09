/**
 * Demo-pack model + deterministic retrieval/composition helpers for the T35
 * harness. Everything here is pure TypeScript with no network access, matching
 * the packages/core purity rules the real implementations must follow.
 */

export interface Place {
  place_id: string;
  name: string;
  area: string;
  ncr_status: "accepted" | "ambiguous" | "outside" | string;
  mapping_status: string;
  aliases: string[];
}

export interface Stop {
  stop_id: string;
  place_id: string;
  name: string;
}

export interface RouteRecord {
  route_id: string;
  name: string;
  mode: string;
  signboard: string | null;
  service_status: "reported_active" | "unknown" | "suspended" | "retired" | string;
}

export interface FareReport {
  fare_id: string;
  amount_min: number;
  amount_max: number;
  currency: string;
  effective_at: string | null;
}

export interface Leg {
  leg_id: string;
  route_id: string;
  board_stop_id: string;
  alight_stop_id: string;
  ride_min: number | null;
  eligibility: "ready" | "excluded" | string;
  fare_reports: FareReport[];
}

export interface HoursReport {
  hours_id: string;
  route_id: string;
  hours_text: string;
  source_date: string;
}

export interface Note {
  note_id: string;
  kind: "tip" | "warning" | "conflict" | string;
  leg_id: string | null;
  stop_id: string | null;
  body: string;
}

export interface TripState {
  active: boolean;
  origin_place_id?: string;
  destination_place_id?: string;
  preference?: string;
  selected_leg_ids?: string[];
  current_step?: number;
}

export interface DemoPack {
  pack_id: string;
  places: Place[];
  ambiguous_aliases: { alias_norm: string; candidates: string[] }[];
  stops: Stop[];
  routes: RouteRecord[];
  legs: Leg[];
  hours_reports: HoursReport[];
  notes: Note[];
  trip_states: Record<string, TripState>;
}

export interface BundleCard {
  card_id: string;
  leg_id: string;
  route_id: string;
  route_name: string;
  mode: string;
  signboard: string | null;
  board_stop_name: string;
  alight_stop_name: string;
  ride_min: number | null;
  fares: FareReport[];
  hours: HoursReport | null;
  notes: Note[];
}

export interface EvidenceBundle {
  pack_id: string;
  cards: BundleCard[];
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface PlaceMatch {
  place_id: string;
  text: string;
  start: number;
  end: number;
  via: "display" | "alias";
}

export interface AmbigMatch {
  alias: string;
  candidates: string[];
  start: number;
  end: number;
}

/**
 * Find unique place matches by display name and aliases. Longest non-overlapping
 * spans win so "Harborview Pier" beats the bare alias "pier"; only one match per
 * place is returned, ordered by position. Word boundaries are required so
 * "the bend" does not match inside "Riverbend".
 */
export function findPlaceMatches(query: string, pack: DemoPack): PlaceMatch[] {
  const text = ` ${normalize(query)} `;
  const candidates: PlaceMatch[] = [];
  for (const place of pack.places) {
    const variants: string[] = [place.name, ...place.aliases];
    for (const variant of variants) {
      const norm = normalize(variant);
      if (!norm) continue;
      const re = new RegExp(`\\b${escapeRe(norm)}\\b`, "g");
      for (const m of text.matchAll(re)) {
        candidates.push({
          place_id: place.place_id,
          text: norm,
          start: m.index ?? 0,
          end: (m.index ?? 0) + norm.length,
          via: variant === place.name ? "display" : "alias",
        });
      }
    }
  }
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start));
  const selected: PlaceMatch[] = [];
  const seenPlaces = new Set<string>();
  for (const c of candidates) {
    if (seenPlaces.has(c.place_id)) continue;
    if (selected.some((s) => c.start < s.end && s.start < c.end)) continue;
    selected.push(c);
    seenPlaces.add(c.place_id);
  }
  return selected.sort((a, b) => a.start - b.start);
}

/** Ambiguous aliases apply only to spans not already resolved to a unique place. */
export function findAmbiguousMatches(query: string, pack: DemoPack): AmbigMatch[] {
  const text = ` ${normalize(query)} `;
  const places = findPlaceMatches(query, pack);
  const out: AmbigMatch[] = [];
  for (const amb of pack.ambiguous_aliases) {
    const re = new RegExp(`\\b${escapeRe(amb.alias_norm)}\\b`, "g");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + amb.alias_norm.length;
      const covered = places.some((p) => start < p.end && p.start < end);
      if (!covered) {
        out.push({ alias: amb.alias_norm, candidates: amb.candidates, start, end });
        break; // one ambiguous hit is enough for clarification
      }
    }
  }
  return out;
}

const ORIGIN_MARKER_RE =
  /(from|galing|mula|narito|nandito|coming from|dito)(?:\s+ako)?(?:\s+sa)?\s*$/i;
const DEST_MARKER_RE =
  /(to|sa|puntang|papuntang|pupunta(?:ng)?|hanggang|going to|headed (?:to|for)|heading (?:to|for)|reach|over to|para sa|patungo(?:ng)?|ng)(?:\s+sa)?\s*$/i;

export type EndpointRoles = { origin?: PlaceMatch; destination?: PlaceMatch };

/** Assign origin/destination roles to 1-2 place matches using nearby markers. */
export function assignEndpointRoles(query: string, matches: PlaceMatch[]): EndpointRoles {
  const norm = normalize(query);
  if (matches.length === 0) return {};
  // Matches were located on a space-padded copy of the normalized query, so
  // slice the prefix directly; trimming somewhere sensible keeps the regexes
  // anchored to the words immediately before the place mention.
  const flagged = matches.map((m) => {
    // Match spans were measured on a space-padded query, so the normalized
    // string index of the span start is m.start - 1.
    const before = norm.slice(0, Math.max(0, m.start - 1)).slice(-28);
    return { match: m, origin: ORIGIN_MARKER_RE.test(before), dest: DEST_MARKER_RE.test(before) };
  });
  if (flagged.length === 1) {
    const only = flagged[0]!;
    return only.origin && !only.dest
      ? { origin: only.match }
      : { destination: only.match };
  }
  const first = flagged[0]!;
  const second = flagged[1]!;
  // An explicit origin marker on the second mention ("...ng X kung narito ako
  // sa Y") reverses the positional default; otherwise first mention is origin.
  if (second.origin && !first.origin) {
    return { origin: second.match, destination: first.match };
  }
  return { origin: first.match, destination: second.match };
}

/**
 * Extract endpoint-ish free text ("from X to Y", "galing sa X papuntang Y") and
 * return any segment that resolves to no place - the unsupported-place signal.
 */
export function findUnsupportedEndpoint(query: string, pack: DemoPack): string | null {
  const norm = normalize(query).replace(/[?!.]+/g, "");
  const segRes = [
    /\bfrom\s+(.+?)\s+(?:to|papuntang|patungong|hanggang)\s+(.+)$/i,
    /\bfrom\s+(.+)$/i,
    /\bgaling(?:\s+ako)?\s+sa\s+(.+?)(?:,|;|\s+papuntang|\s+puntang)/i,
    /\bnarito\s+ako\s+sa\s+(.+?)(?:,|;|\s+papuntang|\s+puntang|$)/i,
  ];
  const segs: string[] = [];
  for (const re of segRes) {
    const m = re.exec(norm);
    if (m) segs.push(...m.slice(1).map((s) => s.trim()));
  }
  const leadWords = new Set([
    "commute", "route", "guide", "directions", "how", "do", "i", "get", "me",
    "the", "a", "an", "also", "actually", "please", "kung", "ako", "here",
  ]);
  const covered = (seg: string): boolean => {
    if (seg.length < 4) return true;
    const hits = findPlaceMatches(seg, pack);
    if (hits.length > 0) {
      const coveredChars = seg.replace(
        new RegExp(hits.map((h) => escapeRe(h.text)).join("|"), "g"),
        "",
      );
      return coveredChars.replace(/[^a-z]/g, "").length < 4;
    }
    if (pack.ambiguous_aliases.some((a) => new RegExp(`\\b${escapeRe(a.alias_norm)}\\b`).test(seg)))
      return true;
    const words = seg.split(/\s+/).filter((w) => !leadWords.has(w));
    return words.join("").length < 4;
  };
  for (const seg of segs) {
    if (!covered(seg)) return seg;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Retrieval / composition (deterministic, INV-1 aware)
// ---------------------------------------------------------------------------

export function legsFromPlaceToPlace(pack: DemoPack): Leg[] {
  const activeRoutes = new Set(
    pack.routes.filter((r) => r.service_status === "reported_active").map((r) => r.route_id),
  );
  return pack.legs.filter(
    (l) => l.eligibility === "ready" && activeRoutes.has(l.route_id),
  );
}

/**
 * Enumerate complete directed itineraries (BFS, max 3 boardings, no repeated
 * stops) from origin place to destination place. Unknown fares/times are never
 * coerced to zero; ordering prefers fewer boardings.
 */
export function routeSearch(pack: DemoPack, originPlaceId: string, destPlaceId: string): Leg[][] {
  const legs = legsFromPlaceToPlace(pack);
  const stopToPlace = new Map(pack.stops.map((s) => [s.stop_id, s.place_id]));
  const originStops = pack.stops.filter((s) => s.place_id === originPlaceId).map((s) => s.stop_id);
  const destStops = new Set(
    pack.stops.filter((s) => s.place_id === destPlaceId).map((s) => s.stop_id),
  );
  const results: Leg[][] = [];
  const queue: { stop: string; path: Leg[]; visited: Set<string> }[] = originStops.map((s) => ({
    stop: s,
    path: [],
    visited: new Set([s]),
  }));
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.path.length >= 3) continue;
    for (const leg of legs) {
      if (leg.board_stop_id !== cur.stop) continue;
      if (cur.visited.has(leg.alight_stop_id)) continue;
      const path = [...cur.path, leg];
      if (destStops.has(leg.alight_stop_id)) {
        results.push(path);
        continue;
      }
      const nextPlace = stopToPlace.get(leg.alight_stop_id);
      if (nextPlace === destPlaceId) continue;
      const visited = new Set(cur.visited);
      visited.add(leg.alight_stop_id);
      queue.push({ stop: leg.alight_stop_id, path, visited });
    }
  }
  results.sort((a, b) => a.length - b.length || a[0]!.leg_id.localeCompare(b[0]!.leg_id));
  return results.slice(0, 2);
}

export function composeCard(leg: Leg, pack: DemoPack): BundleCard {
  const route = pack.routes.find((r) => r.route_id === leg.route_id);
  const board = pack.stops.find((s) => s.stop_id === leg.board_stop_id);
  const alight = pack.stops.find((s) => s.stop_id === leg.alight_stop_id);
  const hours = pack.hours_reports.find((h) => h.route_id === leg.route_id) ?? null;
  const notes = pack.notes.filter((n) => n.leg_id === leg.leg_id);
  return {
    card_id: `card-${leg.leg_id}`,
    leg_id: leg.leg_id,
    route_id: leg.route_id,
    route_name: route?.name ?? leg.route_id,
    mode: route?.mode ?? "unknown",
    signboard: route?.signboard ?? null,
    board_stop_name: board?.name ?? leg.board_stop_id,
    alight_stop_name: alight?.name ?? leg.alight_stop_id,
    ride_min: leg.ride_min,
    fares: leg.fare_reports,
    hours,
    notes,
  };
}

export function buildBundle(pack: DemoPack, legs: Leg[]): EvidenceBundle {
  return { pack_id: pack.pack_id, cards: legs.map((l) => composeCard(l, pack)) };
}

/** All cards for up to two alternative itineraries (bundle covers both). */
export function buildBundleForItineraries(
  pack: DemoPack,
  itineraries: Leg[][],
): EvidenceBundle {
  const legs: Leg[] = [];
  const seen = new Set<string>();
  for (const it of itineraries) {
    for (const leg of it) {
      if (!seen.has(leg.leg_id)) {
        seen.add(leg.leg_id);
        legs.push(leg);
      }
    }
  }
  return buildBundle(pack, legs);
}

export function formatPeso(amount: number): string {
  return `₱${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

/**
 * Stop-name variants for colloquial matching ("Bayan Terminal Bay 1" ->
 * ["bayan terminal bay 1", "bayan terminal"]). Used by reversal checks, where
 * users/baits commonly abbreviate stop names.
 */
export function stopNameVariants(stopName: string): string[] {
  const norm = normalize(stopName);
  const words = norm.split(/\s+/);
  const variants = new Set<string>([norm]);
  if (words.length > 2) variants.add(words.slice(0, 2).join(" "));
  return [...variants];
}
