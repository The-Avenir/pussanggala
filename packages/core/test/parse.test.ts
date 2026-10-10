import { describe, expect, it } from "vitest";
import { IntentSchema, parse, type Intent, type IntentKind, type Preference, type TripState } from "../src/index";

const trip: TripState = {
  packId: "pack_demo-001", schemaVersion: 1, preference: "balanced", currentStep: 0,
  originPlaceId: "pl_demo-plaza", destinationPlaceId: "pl_demo-market",
};
const pending: TripState = {
  ...trip, pendingClarification: { slot: "destination", text: "demo center", candidates: [
    { placeId: "pl_demo-market", name: "Demo Market", area: "Demo City", kind: "market" },
    { placeId: "pl_demo-plaza", name: "Demo Plaza", area: "Demo City", kind: "landmark" },
  ] },
};

function checked(query: string, state?: TripState): Intent {
  const result = parse(query, state);
  expect(IntentSchema.safeParse(result).success).toBe(true);
  expect(result.source).toBe("rules");
  for (const mention of [result.origin, result.destination]) {
    if (mention?.kind === "text") {
      expect(query.slice(...mention.span)).toBe(mention.text);
      expect(mention.text).toBe(mention.text.trim());
    }
  }
  return result;
}

function mentionText(intent: Intent, slot: "origin" | "destination"): string | undefined {
  const mention = intent[slot];
  return mention?.kind === "text" ? mention.text : undefined;
}

describe("rule-based intent parser", () => {
  it.each([
    ["Galing Demo Plaza papunta sa Sample Market", "Demo Plaza", "Sample Market"],
    ["Galing sa Demo Plaza papuntang Sample Market po", "Demo Plaza", "Sample Market"],
    ["pano pumuntang Cubao galing Recto", "Recto", "Cubao"],
    ["Pano po pumuntang Recto to Cubao?", "Recto", "Cubao"],
    ["galing ng Demo Plaza hanggang sa Sample Market", "Demo Plaza", "Sample Market"],
    ["mula sa Demo Plaza pa Sample Market", "Demo Plaza", "Sample Market"],
    ["from the Demo Plaza to the Sample Market!", "Demo Plaza", "Sample Market"],
    ["paano pumunta sa Sample Market galing Demo Plaza?", "Demo Plaza", "Sample Market"],
    ["Paano pumunta recto to cubao", "recto", "cubao"],
    ["paano pumunta sa Demo Plaza to Sample Market?", "Demo Plaza", "Sample Market"],
    ["how do I commute Demo Plaza to Sample Market?", "Demo Plaza", "Sample Market"],
    ["paano pupunta papunta sa Sample Market mula sa Demo Plaza", "Demo Plaza", "Sample Market"],
    ["paano makarating Sample Market galing sa Demo Plaza", "Demo Plaza", "Sample Market"],
    ["paano mag-commute sa Sample Market mula Demo Plaza", "Demo Plaza", "Sample Market"],
    ["how do i get to X from Y", "Y", "X"],
    ["how can i go to X from Y?", "Y", "X"],
    ["how to commute to X from Y", "Y", "X"],
    ["papuntang sa Sample Market galing Demo Plaza", "Demo Plaza", "Sample Market"],
    ["Demo Plaza to Sample Market cheapest", "Demo Plaza", "Sample Market"],
    [" Demo Plaza  to  Sample Market na lang", "Demo Plaza", "Sample Market"],
    ["İ FROM Démo Plaza to Sample Market please", "Démo Plaza", "Sample Market"],
  ])("extracts both endpoints: %s", (query, origin, destination) => {
    const result = checked(query, trip);
    expect(result.kind).toBe("new_trip");
    expect(mentionText(result, "origin")).toBe(origin);
    expect(mentionText(result, "destination")).toBe(destination);
    if (query.includes("cheapest")) expect(result.preference).toBe("lowest_fare");
  });

  const keywordCases: [string, IntentKind][] = [
    ["new trip", "new_trip"], ["bagong byahe", "new_trip"], ["start over", "new_trip"],
    ["pabalik", "reverse"], ["pauwi", "reverse"], ["way back", "reverse"],
    ["ibang ruta", "alternatives"], ["other option please", "alternatives"],
    ["magkano pamasahe?", "ask_fare"], ["how much?", "ask_fare"],
    ["saan ako sasakay", "ask_boarding"], ["where do i get on", "ask_boarding"], ["where to ride", "ask_boarding"],
    ["saan ako bababa", "ask_transfer"], ["where to get off", "ask_transfer"], ["lipat", "ask_transfer"],
    ["anong oras last trip", "ask_hours"], ["first trip?", "ask_hours"], ["bukas pa", "ask_hours"],
  ];
  it.each(keywordCases)("detects keywords: %s", (query, kind) => {
    expect(checked(query, trip).kind).toBe(kind);
  });

  it("uses the specified keyword precedence and attaches preferences", () => {
    expect(checked("new trip pabalik cheapest", trip)).toEqual({ kind: "new_trip", source: "rules", preference: "lowest_fare" });
    expect(checked("other route fastest", trip)).toEqual({ kind: "alternatives", source: "rules", preference: "shortest_reported_time" });
    expect(checked("magkano kung walang lipat", trip)).toEqual({ kind: "ask_fare", source: "rules", preference: "fewest_transfers" });
    expect(checked("walang lipat saan bababa", trip).kind).toBe("ask_transfer");
  });

  it.each([
    ["from the Demo Plaza please", "origin", "Demo Plaza"],
    ["galing sa Demo Plaza", "origin", "Demo Plaza"],
    ["mula Demo Plaza", "origin", "Demo Plaza"],
    ["sa Sample Market na lang", "destination", "Sample Market"],
    ["to Sample Market instead", "destination", "Sample Market"],
    ["going to Sample Market", "destination", "Sample Market"],
    ["go to the Sample Market", "destination", "Sample Market"],
    ["get to Sample Market", "destination", "Sample Market"],
    ["how do i get to Sample Market?", "destination", "Sample Market"],
    ["paano pumunta sa One Ayala?", "destination", "One Ayala"],
    ["paano pumunta cubao", "destination", "cubao"],
    ["pano pumuntang cubao", "destination", "cubao"],
    ["Pano po pumuntang Cubao?", "destination", "Cubao"],
    ["pa’no pumunta sa Cubao po", "destination", "Cubao"],
    ["pa'no pupuntang SM North EDSA?", "destination", "SM North EDSA"],
    ["paano pumunta po sa Cubao", "destination", "Cubao"],
    ["paano mag-commute papunta sa Sample Market?", "destination", "Sample Market"],
    ["pupunta sa Sample Market", "destination", "Sample Market"],
    ["papuntang Sample Market", "destination", "Sample Market"],
  ] as const)("extracts a single endpoint: %s", (query, slot, value) => {
    const withTrip = checked(query, trip);
    expect(withTrip.kind).toBe(slot === "origin" ? "change_origin" : "change_destination");
    expect(mentionText(withTrip, slot)).toBe(value);
    expect(mentionText(withTrip, slot === "origin" ? "destination" : "origin")).toBeUndefined();
    const withoutTrip = checked(query);
    expect(withoutTrip.kind).toBe("new_trip");
    expect(mentionText(withoutTrip, slot)).toBe(value);
  });

  it.each(["?", ".", "!", ",", ";", " na", " po", " lang", " please", " pls", " using", " via", " instead", " cheapest"])("ends mentions at %s", (ending) => {
    const result = checked(`from Demo Plaza to Sample Market${ending} more words`);
    expect(mentionText(result, "destination")).toBe("Sample Market");
  });

  it("recognizes stops only as whole words and adjusts trimmed spans", () => {
    const query = "  FROM   the  Banana Place   to   Napoleon Plaza  po  ";
    const result = checked(query);
    expect(mentionText(result, "origin")).toBe("Banana Place");
    expect(mentionText(result, "destination")).toBe("Napoleon Plaza");
    expect(result.origin).toEqual({ kind: "text", text: "Banana Place", span: [14, 26] });
  });

  const preferenceCases: [string, Preference][] = [
    ["pinakamura", "lowest_fare"], ["lowest fare", "lowest_fare"], ["tipid", "lowest_fare"],
    ["walang lipat", "fewest_transfers"], ["konting lipat", "fewest_transfers"],
    ["least transfer", "fewest_transfers"], ["fewest transfers", "fewest_transfers"],
    ["isang sakay", "fewest_transfers"], ["direct", "fewest_transfers"],
    ["pinakamabilis", "shortest_reported_time"], ["quickest", "shortest_reported_time"],
  ];
  it.each(preferenceCases)("detects preferences: %s", (query, preference) => {
    expect(checked(query, trip)).toEqual({ kind: "change_preference", source: "rules", preference });
    expect(checked(query)).toEqual({ kind: "unrelated", source: "rules", preference });
  });

  it.each([
    ["2", 1], ["9", 8], ["una", 0], ["yung una", 0], ["unang", 0], ["first", 0],
    ["second", 1], ["pangalawa", 1], ["ikalawa", 1], ["third", 2], ["pangatlo", 2],
    ["ikatlo", 2], ["fourth", 3], ["pang-apat", 3], ["pangapat", 3],
  ])("answers a pending clarification: %s", (query, choiceIndex) => {
    expect(checked(query, pending)).toEqual({ kind: "clarify_answer", source: "rules", choiceIndex });
    expect(checked(query).kind).toBe("unrelated");
  });

  it("requires the whole query to be a choice", () => {
    expect(checked("  UNA!  ", pending).choiceIndex).toBe(0);
    expect(checked("first trip", pending).kind).toBe("ask_hours");
    expect(checked("0", pending).kind).toBe("unrelated");
    expect(checked("10", pending).kind).toBe("unrelated");
  });

  it.each(["what's the weather", "", "Demo Plaza to please", "from please", "going to po", "shortcut", "openly"])("leaves unsupported input unrelated: %s", (query) => {
    expect(checked(query)).toEqual({ kind: "unrelated", source: "rules" });
  });
});
