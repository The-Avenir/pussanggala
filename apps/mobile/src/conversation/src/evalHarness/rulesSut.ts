/**
 * StubSut: a deterministic rules-based SystemUnderTest so the T35 harness is
 * runnable before the T32/T33 model-backed implementations land.
 *
 * Design intent:
 *  - Proves the harness end-to-end (corpus loading, scoring, guard wiring,
 *    latency capture) with a SUT that any real implementation should beat or
 *    match on the guarded behaviours.
 *  - The stub is rules-only and CANNOT satisfy the release requirements by
 *    itself (PRD-F5 requires grounded local-AI explanation on the reference
 *    phone). Its results are preliminary smoke results, clearly labelled so.
 *  - Even the stub routes every emitted unit through the same guard the
 *    harness uses to review model output, which demonstrates the contract.
 */

import {
  assignEndpointRoles,
  buildBundle,
  buildBundleForItineraries,
  composeCard,
  findAmbiguousMatches,
  findPlaceMatches,
  findUnsupportedEndpoint,
  formatPeso,
  legsFromPlaceToPlace,
  normalize,
  routeSearch,
  stopNameVariants,
} from "./pack.ts";
import type {
  BundleCard,
  DemoPack,
  EvidenceBundle,
  Leg,
  TripState,
} from "./pack.ts";
import {
  guardStream as guardStreamImpl,
  validateUnit,
} from "./guard.ts";
import type { ExplanationUnit } from "./guard.ts";
import type {
  ParseOutcome,
  RespondOutcome,
  StreamOutcome,
  SystemUnderTest,
} from "./sutTypes.ts";

const MODE_LABEL: Record<string, string> = {
  jeepney: "jeepney",
  modern_jeepney: "modern jeepney",
  uv_express: "UV express",
  bus: "bus",
  tricycle: "tricycle",
  rail: "train",
};
const modeLabel = (mode: string): string => MODE_LABEL[mode] ?? mode;

const MARKERS = {
  reverse: ["reverse", "ibaliktad", "baliktad", "pabalik", "get back", "going back", "umuwi"],
  alternative: ["alternative", "ibang daan", "ibang route", "other option", "other way", "another way", "another option"],
  changeDestination: ["na lang", "instead", "change my destination", "change destination", "make it"],
  fare: ["fare", "magkano", "pamasahe", "bayad", "how much", "cost", "presyo", "piso", "budget", "pay", "price", "mura", "totoo ba", "free on", "is free", "one price"],
  duration: ["how long", "gaano katagal", "katagal", "how many minutes", "travel time", "ride takes", "total time"],
  hours: [
    "operating hours", "hours", "oras", "what time", "schedule", "timetable", "first trip",
    "last trip", "huling biyahe", "start running", "available", "still running", "running right now",
    "bumibiyahe", "biyahe", "open", "closing", "leaves at", "next trip",
  ],
  walk: ["walking distance", "walk", "lakad"],
  amenity: ["aircon", "wifi", "shuttle", "discount", "student", "comfortable", "parking"],
  transfer: ["transfer", "lipat", "lipatan", "switch"],
  boarding: ["board", "sasakay", "sumakay", "signboard", "hop on", "get on", "baba", "alight", "simula", "where do i ride", "get down", "drops me"],
  offTopic: [
    "weather", "homework", "poem", "adobo", "sinigang", "recipe", "joke", "movie",
    "basketball", "milk tea", "panahon", "quantum", "exchange rate", "translate",
    "japanese", "music", "eleksyon", "relationship", "math", "magluto", "cats",
  ],
  cheap: ["cheapest", "cheaper", "mas mura", "pinakamura", "pinaka-mura", "mura", "budget", "lowest fare", "tipid"],
  fast: ["fastest", "quickest", "mas mabilis", "pinakamabilis", "pinaka-mabilis", "mabilis"],
};

function hasAny(norm: string, markers: string[]): boolean {
  return markers.some((m) => norm.includes(m));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Deterministic eval SUT logic (mirrors tools/eval StubRulesSut). */
export class EvalRulesSut implements SystemUnderTest {
  readonly name = "eval-rules-v0";

  private readonly pack: DemoPack;

  constructor(pack: DemoPack) {
    this.pack = pack;
  }

  // ---------------------------------------------------------------
  // parse(): bounded rules intent/slot extraction
  // ---------------------------------------------------------------
  async parse(query: string, trip: TripState): Promise<ParseOutcome> {
    const norm = normalize(query);
    const matches = findPlaceMatches(query, this.pack);
    const ambiguous = findAmbiguousMatches(query, this.pack);
    const roles = assignEndpointRoles(query, matches);
    const places = [...new Map(matches.map((m) => [m.place_id, m])).values()];
    const outside = places.find((m) => {
      const p = this.pack.places.find((x) => x.place_id === m.place_id);
      return p?.ncr_status === "outside";
    });
    const slots: Record<string, string> = {};

    const offTopic = hasAny(norm, MARKERS.offTopic);
    // Money/hearsay figures in a trip context are fare questions regardless of verbs.
    const moneyish = /₱\s?\d|\d+\s*pesos|\bfree\b/.test(norm);
    const transitish =
      hasAny(norm, [...MARKERS.reverse, ...MARKERS.fare, ...MARKERS.hours,
        ...MARKERS.duration, ...MARKERS.walk, ...MARKERS.amenity, ...MARKERS.transfer,
        ...MARKERS.boarding, ...MARKERS.alternative, ...MARKERS.changeDestination]) ||
      moneyish ||
      ambiguous.length > 0 || places.length > 0 ||
      /(how do i get|commute|route|daan|punta|byahe|ride)/.test(norm);

    // --- unrelated first: off-topic lexicon with no transit signal at all ---
    if (offTopic && !transitish) {
      return { intent: "unrelated", behaviour: "redirect_unrelated", slots };
    }
    if (!transitish && places.length === 0 && ambiguous.length === 0) {
      return { intent: "unrelated", behaviour: "redirect_unrelated", slots };
    }

    // --- follow-ups need an active trip ---
    if (trip.active) {
      if (hasAny(norm, MARKERS.changeDestination) && places.length === 1) {
        slots["destination"] = places[0]!.place_id;
        return { intent: "follow_up_change_destination", behaviour: "change_destination", slots };
      }
      if (hasAny(norm, MARKERS.reverse))
        return { intent: "follow_up_reverse", behaviour: "reroute_reverse", slots };
      if (hasAny(norm, MARKERS.alternative))
        return { intent: "follow_up_alternative", behaviour: "show_alternatives", slots };
      if (hasAny(norm, MARKERS.amenity))
        return { intent: "follow_up_amenity", behaviour: "answer_amenity", slots };
      if (hasAny(norm, MARKERS.fare) || moneyish)
        return { intent: "follow_up_fare", behaviour: "answer_fare", slots };
      if (hasAny(norm, MARKERS.duration))
        return { intent: "follow_up_duration", behaviour: "answer_duration", slots };
      if (hasAny(norm, MARKERS.hours))
        return { intent: "follow_up_hours", behaviour: "answer_hours", slots };
      if (hasAny(norm, MARKERS.walk))
        return { intent: "follow_up_walk", behaviour: "answer_walk", slots };
      if (hasAny(norm, MARKERS.transfer))
        return { intent: "follow_up_transfer", behaviour: "answer_transfer", slots };
      if (hasAny(norm, MARKERS.boarding))
        return { intent: "follow_up_boarding", behaviour: "answer_boarding", slots };
      if (offTopic) return { intent: "unrelated", behaviour: "redirect_unrelated", slots };
    } else if (
      offTopic && !outside && ambiguous.length === 0 && places.length === 0
    ) {
      return { intent: "unrelated", behaviour: "redirect_unrelated", slots };
    }

    // --- new-trip flows ---
    if (ambiguous.length > 0) {
      const amb = ambiguous[0]!;
      slots["ambiguous_alias"] = amb.alias;
      if (roles.origin) slots["origin"] = roles.origin.place_id;
      // Positional fallback: a unique place mentioned before the ambiguous alias
      // is the origin ("Bayan to Acacia"); after it ("Acacia to Mercado") the
      // destination. An explicit origin marker above always wins.
      for (const m of matches) {
        if (slots["origin"] === m.place_id) continue;
        if (m.start < amb.start) slots["origin"] ??= m.place_id;
        else slots["destination"] ??= m.place_id;
      }
      return { intent: "new_trip", behaviour: "clarify_ambiguous_alias", slots };
    }
    if (outside) {
      slots["outside_place"] = outside.place_id;
      if (roles.origin && roles.origin.place_id !== outside.place_id) slots["origin"] = roles.origin.place_id;
      if (roles.destination && roles.destination.place_id !== outside.place_id)
        slots["destination"] = roles.destination.place_id;
      // positional fallback when roles put nothing on the other end
      const other = places.find((m) => m.place_id !== outside.place_id);
      if (other && !slots["origin"] && !slots["destination"]) slots["destination"] = other.place_id;
      return { intent: "new_trip", behaviour: "reject_outside_ncr", slots };
    }
    if (places.length >= 2) {
      slots["origin"] = (roles.origin ?? places[0]!).place_id;
      slots["destination"] = (roles.destination ?? places[1]!).place_id;
      slots["preference"] = this.extractPreference(norm);
      return { intent: "new_trip", behaviour: "route", slots };
    }
    if (places.length === 1) {
      const only = places[0]!;
      const unsupported = findUnsupportedEndpoint(query, this.pack);
      if (unsupported) {
        if (roles.origin) slots["origin"] = roles.origin.place_id;
        else if (roles.destination) slots["destination"] = roles.destination.place_id;
        else slots["destination"] = only.place_id;
        slots["unsupported_text"] = unsupported;
        return { intent: "new_trip", behaviour: "reject_unsupported_place", slots };
      }
      if (roles.origin) slots["origin"] = roles.origin.place_id;
      else slots["destination"] = roles.destination?.place_id ?? only.place_id;
      return { intent: "new_trip", behaviour: "clarify_missing_endpoint", slots };
    }
    const unsupported = findUnsupportedEndpoint(query, this.pack);
    if (unsupported) {
      slots["unsupported_text"] = unsupported;
      return { intent: "new_trip", behaviour: "reject_unsupported_place", slots };
    }
    // Nothing recognized and no transit signal: treat as unrelated scope.
    return { intent: "unrelated", behaviour: "redirect_unrelated", slots };
  }

  private extractPreference(norm: string): string {
    if (hasAny(norm, MARKERS.cheap)) return "lowest_fare";
    if (hasAny(norm, MARKERS.fast)) return "fastest_reported";
    return "fewest_transfers";
  }

  // ---------------------------------------------------------------
  // respond(): retrieval + behaviour + guarded explanation units
  // ---------------------------------------------------------------
  async respond(query: string, trip: TripState): Promise<RespondOutcome> {
    const parsed = await this.parse(query, trip);
    switch (parsed.behaviour) {
      case "redirect_unrelated":
        return this.finish(parsed.behaviour, [], [
          "I only help with commuting inside Metro Manila — routes, fares, transfers and follow-ups for your current trip. Want me to look up a commute?",
        ]);
      case "clarify_missing_endpoint": {
        const destId = parsed.slots["destination"];
        const destName = destId ? this.placeName(destId) : null;
        return this.finish(parsed.behaviour, [], [
          destName
            ? `Headed to ${destName}. Where are you coming from?`
            : "I need both endpoints before I can look up a commute. Where are you coming from?",
        ]);
      }
      case "clarify_ambiguous_alias": {
        const amb = findAmbiguousMatches(query, this.pack)[0]!;
        const options = amb.candidates
          .map((id) => {
            const p = this.pack.places.find((x) => x.place_id === id)!;
            return `${p.name} (${p.area})`;
          })
          .join(" or ");
        return this.finish(parsed.behaviour, [], [
          `'${amb.alias}' could mean ${options}. Which one do you mean?`,
        ]);
      }
      case "reject_outside_ncr": {
        const p = this.pack.places.find((x) => x.place_id === parsed.slots["outside_place"]);
        return this.finish(parsed.behaviour, [], [
          `${p?.name ?? "That place"} appears to be outside Metro Manila (NCR). I only handle trips with both endpoints inside NCR.`,
        ]);
      }
      case "reject_unsupported_place": {
        return this.finish(parsed.behaviour, [], [
          `'${parsed.slots["unsupported_text"]}' isn't one of my supported NCR places. Pick a supported landmark near it and I'll route from there.`,
        ]);
      }
      case "route": {
        const origin = parsed.slots["origin"]!;
        const destination = parsed.slots["destination"]!;
        return this.respondRoute(origin, destination, parsed.behaviour, parsed.slots["preference"] ?? "fewest_transfers");
      }
      case "reroute_reverse": {
        if (!trip.active || !trip.origin_place_id || !trip.destination_place_id)
          return this.failNoTrip();
        return this.respondRoute(
          trip.destination_place_id,
          trip.origin_place_id,
          parsed.behaviour,
          trip.preference ?? "fewest_transfers",
          `Reversed trip (${this.placeName(trip.destination_place_id)} to ${this.placeName(trip.origin_place_id)}).`,
        );
      }
      case "change_destination": {
        if (!trip.active || !trip.origin_place_id) return this.failNoTrip();
        return this.respondRoute(
          trip.origin_place_id,
          parsed.slots["destination"]!,
          parsed.behaviour,
          trip.preference ?? "fewest_transfers",
          `Updated destination: ${this.placeName(parsed.slots["destination"]!)}.`,
        );
      }
      case "show_alternatives": {
        if (!trip.active || !trip.origin_place_id || !trip.destination_place_id)
          return this.failNoTrip();
        const itineraries = routeSearch(this.pack, trip.origin_place_id, trip.destination_place_id);
        if (itineraries.length < 2)
          return this.finish(parsed.behaviour, [], ["No supported alternative was found for this trip in the current pack."]);
        const alt = itineraries[itineraries.length - 1]!;
        const bundle = buildBundleForItineraries(this.pack, itineraries);
        const texts: ExplanationUnit[] = [
          {
            kind: "summary",
            text: `Alternative for ${this.placeName(trip.origin_place_id)} to ${this.placeName(trip.destination_place_id)}: ${this.describeItinerary(alt)}. ${this.unknownCaveat(alt)}`,
          },
        ];
        return this.finishUnits(parsed.behaviour, bundle, texts);
      }
      case "answer_fare":
      case "answer_hours":
      case "answer_duration":
      case "answer_walk":
      case "answer_transfer":
      case "answer_boarding":
      case "answer_amenity": {
        if (!trip.active || !(trip.selected_leg_ids?.length)) return this.failNoTrip();
        const legs = this.selectedLegs(trip);
        const bundle = buildBundle(this.pack, legs);
        const units = this.answerUnits(parsed.behaviour, query, bundle, trip);
        return this.finishUnits(parsed.behaviour, bundle, units);
      }
      default:
        return this.finish("failure", [], [
          "Something went wrong on my side — your cards are still valid. Please retry.",
        ]);
    }
  }

  private failNoTrip(): RespondOutcome {
    return this.finish("clarify_missing_endpoint", [], [
      "I don't have an active trip for that follow-up. Tell me both endpoints first.",
    ]);
  }

  // ---------------------------------------------------------------
  // answer composers (all claims come from bundle records)
  // ---------------------------------------------------------------

  private selectedLegs(trip: TripState): Leg[] {
    const all = legsFromPlaceToPlace(this.pack);
    return (trip.selected_leg_ids ?? [])
      .map((id) => all.find((l) => l.leg_id === id))
      .filter((l): l is Leg => l !== undefined);
  }

  private answerUnits(
    behaviour: string,
    query: string,
    bundle: EvidenceBundle,
    _trip: TripState,
  ): ExplanationUnit[] {
    const norm = normalize(query);
    const first = bundle.cards[0];
    switch (behaviour) {
      case "answer_fare": {
        const texts = this.fareLines(bundle.cards);
        return texts.map((t) => ({ kind: "summary", text: t }));
      }
      case "answer_hours": {
        if (!first) return [{ kind: "summary", text: "I have no cards for this trip yet." }];
        if (!first.hours) {
          const nowish = /right now|ngayon|available|gumagana|definitely/.test(norm);
          return [
            {
              kind: "summary",
              text: `Operating hours for the ${first.route_name} are unknown — the pack has no hours report for it.${nowish ? " I can't say whether it runs at this moment." : ""}`,
            },
          ];
        }
        return [
          {
            kind: "summary",
            text: `Reported hours for the ${first.route_name}: ${first.hours.hours_text}. Report dated ${first.hours.source_date}. These are reported hours, not a schedule — I can't guarantee what happens at any given hour.`,
          },
        ];
      }
      case "answer_duration": {
        return bundle.cards.map((c) => ({
          kind: "summary" as const,
          text:
            c.ride_min === null
              ? `The ride time for the ${c.route_name} leg is unknown — the pack has no reported duration.`
              : `Reported ride time for the ${c.route_name} leg is about ${c.ride_min} min.`,
        }));
      }
      case "answer_walk":
        return [{ kind: "summary", text: "Walking distance and walking time for this trip are unknown — the pack has no supported walk record." }];
      case "answer_amenity":
        return [{ kind: "summary", text: "I have no record of that in the pack — things like amenities, discounts or frequencies aren't on the source-backed cards, so I can't confirm it." }];
      case "answer_transfer": {
        if (bundle.cards.length <= 1)
          return [{ kind: "summary", text: "This trip is a single ride — no transfer needed." }];
        const [a, b] = [bundle.cards[0]!, bundle.cards[1]!];
        return [
          {
            kind: "summary",
            text: `You transfer at ${a.alight_stop_name} between the ${a.route_name} and the ${b.route_name}.`,
          },
        ];
      }
      case "answer_boarding": {
        if (!first) return [{ kind: "summary", text: "I have no cards for this trip yet." }];
        const core = `Board the ${first.signboard ?? first.route_name} ${modeLabel(first.mode)} at ${first.board_stop_name} and alight at ${first.alight_stop_name}.`;
        if (/\bswap/i.test(norm))
          return [{ kind: "summary", text: `No, they can't be swapped: ${core}` }];
        if (this.isStartReversal(norm, first))
          return [{ kind: "summary", text: `No, this trip starts at ${first.board_stop_name}: ${core}` }];
        if (/^(do|does|did)\s(i|we)\s/i.test(norm) && this.isReversedClaim(norm, first))
          return [{ kind: "summary", text: `No, you ${core.charAt(0).toLowerCase()}${core.slice(1)}` }];
        if (this.isReversedClaim(norm, first))
          return [{ kind: "summary", text: `No, it's the other way around: ${core}` }];
        return [{ kind: "summary", text: core }];
      }
      default:
        return [{ kind: "summary", text: "I can't answer that from the current evidence." }];
    }
  }

  private isStartReversal(norm: string, card: BundleCard): boolean {
    const alight = `(?:${stopNameVariants(card.alight_stop_name).map(escapeRe).join("|")})`;
    return new RegExp(`${alight}[^.\\n]{0,30}(simula|start|beginning)`, "i").test(norm);
  }

  private isReversedClaim(norm: string, card: BundleCard): boolean {
    const alight = `(?:${stopNameVariants(card.alight_stop_name).map(escapeRe).join("|")})`;
    const board = `(?:${stopNameVariants(card.board_stop_name).map(escapeRe).join("|")})`;
    return (
      new RegExp(`(board|sakay|sasakay|sumakay|hop on|get on)[^.\\n]{0,30}${alight}`, "i").test(norm) ||
      this.isStartReversal(norm, card) ||
      new RegExp(`(alight|baba|get off|get down|drops? me)[^.\\n]{0,30}${board}`, "i").test(norm) ||
      /(first|muna)[^.\n]{0,25}(alight|baba|get off)/i.test(norm) ||
      new RegExp(`(alight|baba|get off)[^.\\n]{0,50}(before|bago)[^.\\n]{0,25}(board|sakay|sumakay)`, "i").test(norm) ||
      /(swap|either order|either way)/i.test(norm)
    );
  }

  private fareLines(cards: BundleCard[]): string[] {
    const out: string[] = [];
    for (const c of cards) {
      if (c.fares.length === 0) {
        out.push(
          `The fare for the ${c.route_name} leg is unknown — the pack has no fare report for it, so I can't confirm any amount.`,
        );
      } else if (c.fares.length === 1) {
        const f = c.fares[0]!;
        out.push(
          `Reported fare for the ${c.route_name} leg is ${formatPeso(f.amount_min)} (report dated ${f.effective_at ?? "unknown date"}).`,
        );
      } else {
        const parts = c.fares.map((f) => `${formatPeso(f.amount_min)} (${f.effective_at ?? "unknown date"})`);
        const min = Math.min(...c.fares.map((f) => f.amount_min));
        const max = Math.max(...c.fares.map((f) => f.amount_max));
        out.push(
          `Conflicting fare reports for the ${c.route_name} leg: ${parts.join(" and ")}. I can't say which applies now; the lowest reported fare is ${formatPeso(min)}, so budget for the higher reported ${formatPeso(max)} if unsure.`,
        );
      }
    }
    const hasConflict = cards.some((c) => c.fares.length >= 2);
    const hasUnknown = cards.some((c) => c.fares.length === 0);
    if (cards.length > 1) {
      if (hasConflict || hasUnknown) {
        out.push(
          hasConflict
            ? "A single total can't be computed because one leg has conflicting fare reports."
            : "A single total can't be computed because one leg has no fare report.",
        );
      } else {
        const sum = cards.reduce((s, c) => s + (c.fares[0]?.amount_min ?? 0), 0);
        out.push(`In total that's ${formatPeso(sum)} across ${cards.length} legs.`);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------
  // route composer
  // ---------------------------------------------------------------

  private describeItinerary(it: Leg[]): string {
    return it
      .map((leg) => composeCard(leg, this.pack))
      .map((c) => `${c.route_name} (${c.board_stop_name} to ${c.alight_stop_name}${this.fareShort(c)})`)
      .join(", then ");
  }

  private fareShort(c: BundleCard): string {
    if (c.fares.length === 0) return ", fare unknown";
    if (c.fares.length === 1) return `, reported ${formatPeso(c.fares[0]!.amount_min)} (${c.fares[0]!.effective_at})`;
    return `, conflicting reports ${c.fares.map((f) => formatPeso(f.amount_min)).join("/")}`;
  }

  private unknownCaveat(it: Leg[]): string {
    const cards = it.map((leg) => composeCard(leg, this.pack));
    const parts: string[] = [];
    if (cards.some((c) => c.fares.length === 0)) parts.push("one leg has no fare report");
    if (cards.some((c) => c.fares.length >= 2)) parts.push("one leg has conflicting fare reports");
    return parts.length > 0
      ? `Note: ${parts.join(" and ")}, so its trip total is unknown.`
      : "";
  }

  private respondRoute(
    originId: string,
    destinationId: string,
    behaviour: string,
    _preference: string,
    prefix?: string,
  ): RespondOutcome {
    const origin = this.placeName(originId);
    const destination = this.placeName(destinationId);
    const itineraries = routeSearch(this.pack, originId, destinationId);
    if (itineraries.length === 0) {
      return this.finish("no_route", [], [
        `I can't find a complete supported itinerary from ${origin} to ${destination} in the current pack. Suspended or excluded services are never shown, and I won't invent a connection.`,
      ]);
    }
    const bundle = buildBundleForItineraries(this.pack, itineraries);
    const [primary, alt] = [itineraries[0]!, itineraries[1]];
    const primaryCards = primary.map((l) => composeCard(l, this.pack));
    const units: ExplanationUnit[] = [];
    const leadCard = primaryCards[0]!;
    let summary = `${prefix ? `${prefix} ` : ""}${primary.length > 1 ? `${primary.length} rides with a transfer` : "Direct ride"}: ${leadCard.signboard ?? leadCard.route_name} ${modeLabel(leadCard.mode)}`;
    summary += `, from ${primaryCards[0]!.board_stop_name} to ${primaryCards[primaryCards.length - 1]!.alight_stop_name}.`;
    units.push({ kind: "summary", text: summary });
    primaryCards.forEach((c, i) => {
      const transferNote =
        i > 0 ? ` After transferring at ${c.board_stop_name}.` : "";
      const rideNote =
        c.ride_min === null ? "" : ` Reported ride about ${c.ride_min} min.`;
      units.push({
        kind: "step",
        cardRef: c.card_id,
        text: `Board the ${c.signboard ?? c.route_name} ${modeLabel(c.mode)} at ${c.board_stop_name} and alight at ${c.alight_stop_name}.${rideNote}${transferNote}`,
      });
    });
    units.push(...this.fareLines(primaryCards).map((t) => ({ kind: "summary" as const, text: t })));
    if (alt) {
      const altCards = alt.map((l) => composeCard(l, this.pack));
      units.push({
        kind: "comparison",
        text: `Alternative: ${altCards.map((c) => `${c.route_name}${this.fareShort(c)}`).join(", then ")}. ${this.unknownCaveat(alt)}`,
      });
    }
    return this.finishUnits(behaviour, bundle, units, bundle.cards);
  }

  // ---------------------------------------------------------------
  // finishing: every emitted unit passes the guard before "display"
  // ---------------------------------------------------------------

  private finish(
    behaviour: string,
    cards: EvidenceBundle["cards"],
    texts: string[],
  ): RespondOutcome {
    const units: ExplanationUnit[] = texts.map((t) => ({
      kind: behaviour === "redirect_unrelated" ? "redirect" : "summary",
      text: t,
    }));
    return this.finishUnits(behaviour, { pack_id: this.pack.pack_id, cards }, units, cards);
  }

  private finishUnits(
    behaviour: string,
    bundle: EvidenceBundle,
    units: ExplanationUnit[],
    cards: EvidenceBundle["cards"] = bundle.cards,
  ): RespondOutcome {
    const accepted = units.filter((u) => validateUnit(u, bundle).ok);
    return {
      behaviour,
      cards,
      units: accepted,
      displayed_text: accepted.map((u) => u.text).join(" "),
    };
  }

  private placeName(placeId: string): string {
    return this.pack.places.find((p) => p.place_id === placeId)?.name ?? placeId;
  }

  // ---------------------------------------------------------------
  // guardStream(): raw model units through the same guard
  // ---------------------------------------------------------------

  async guardStream(rawUnits: string[], trip: TripState): Promise<StreamOutcome> {
    const legs = this.selectedLegs(trip);
    const bundle = buildBundle(this.pack, legs);
    return guardStreamImpl(rawUnits, bundle);
  }
}
