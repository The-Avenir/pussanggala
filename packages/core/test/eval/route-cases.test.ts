import { describe, expect, it } from "vitest";
import { recordKey, route, type Preference } from "../../src/index";
import { loadEvalNetwork } from "../fixtures/eval-network";

interface RouteCase {
  name: string;
  from: string;
  to: string;
  preference: Preference;
  expectSteps?: string[];
  expectContains?: string[][];
  expectRides: number;
}

function path(from: string, to: string, middle: string[]): string[] {
  return [`ac_${from}`, ...middle, `ac_${to}`];
}

function caseOf(name: string, from: string, to: string, rides: number, middle: string[], preference: Preference = "balanced"): RouteCase {
  return { name, from: `pl_${from}`, to: `pl_${to}`, preference, expectSteps: path(from, to, middle), expectRides: rides };
}

const cases: RouteCase[] = [
  caseOf("direct jeepney Alpha-Bayani", "a", "b", 1, ["lg_jeep-ab"]),
  caseOf("direct UV Bayani-Cedar", "b", "c", 1, ["lg_uv-bc"]),
  caseOf("direct modern jeepney Cedar-Dalisay", "c", "d", 1, ["lg_modern-cd"]),
  caseOf("bus after station access walk", "d", "e", 1, ["wk_d-out", "lg_bus-de"]),
  caseOf("direct tricycle Emerald-Fern", "e", "f", 1, ["lg_trike-ef"]),
  caseOf("direct rail Fern-Grove", "f", "g", 1, ["lg_rail-fg"]),
  caseOf("direct bus Harbor-Iris", "h", "i", 1, ["lg_bus-hi"]),
  caseOf("unknown-fare service Iris-Juniper", "i", "j", 1, ["lg_unknown-ij"]),
  caseOf("direct tricycle Juniper-Kamagong", "j", "k", 1, ["lg_trike-jk"]),
  caseOf("direct rail Kamagong-Laurel", "k", "l", 1, ["lg_rail-kl"]),
  caseOf("origin-only Tamarind reaches destination-only Orchid", "t", "o", 1, ["lg_modern-to"]),
  caseOf("unmapped Narra still supports a text route", "n", "m", 1, ["lg_trike-nm"]),
  caseOf("Maple-Cedar direct segment", "m", "c", 1, ["lg_jeep-mc"]),
  caseOf("lowest fare favors two cheap reported rides", "a", "c", 2, ["lg_bargain-am", "lg_jeep-mc"], "lowest_fare"),
  caseOf("fewest transfers favors lower-fare direct ride", "a", "c", 1, ["lg_fast-ac"], "fewest_transfers"),
  caseOf("shortest reported time favors express direct ride", "a", "c", 1, ["lg_express-ac"], "shortest_reported_time"),
  caseOf("balanced breaks direct-ride tie by reported time", "a", "c", 1, ["lg_express-ac"]),
  {
    name: "cross-thread same-stop transfer is among supported alternatives", from: "pl_a", to: "pl_c", preference: "lowest_fare", expectRides: 2,
    expectContains: [path("a", "c", ["lg_jeep-ab", "lg_uv-bc"]), path("a", "c", ["lg_unknown-ac"])],
  },
  caseOf("Bayani-Dalisay two different routes", "b", "d", 2, ["lg_uv-bc", "lg_modern-cd"]),
  caseOf("Cedar-Emerald explicit station walk transfer", "c", "e", 2, ["lg_modern-cd", "wk_d-out", "lg_bus-de"]),
  caseOf("Bayani-Emerald three rides and one walk", "b", "e", 3, ["lg_uv-bc", "lg_modern-cd", "wk_d-out", "lg_bus-de"]),
  caseOf("Cedar-Fern three rides", "c", "f", 3, ["lg_modern-cd", "wk_d-out", "lg_bus-de", "lg_trike-ef"]),
  caseOf("Cedar-Grove four rides", "c", "g", 4, ["lg_modern-cd", "wk_d-out", "lg_bus-de", "lg_trike-ef", "lg_rail-fg"]),
  caseOf("Dalisay-Fern two rides", "d", "f", 2, ["wk_d-out", "lg_bus-de", "lg_trike-ef"]),
  caseOf("Dalisay-Grove three rides", "d", "g", 3, ["wk_d-out", "lg_bus-de", "lg_trike-ef", "lg_rail-fg"]),
  caseOf("Bayani-Fern four-ride boundary", "b", "f", 4, ["lg_uv-bc", "lg_modern-cd", "wk_d-out", "lg_bus-de", "lg_trike-ef"]),
  caseOf("Alpha-Dalisay fewest transfers", "a", "d", 2, ["lg_fast-ac", "lg_modern-cd"], "fewest_transfers"),
  caseOf("Alpha-Emerald three-ride direct prefix", "a", "e", 3, ["lg_fast-ac", "lg_modern-cd", "wk_d-out", "lg_bus-de"], "fewest_transfers"),
  caseOf("Alpha-Fern four-ride direct prefix", "a", "f", 4, ["lg_fast-ac", "lg_modern-cd", "wk_d-out", "lg_bus-de", "lg_trike-ef"], "fewest_transfers"),
  caseOf("Maple-Dalisay two rides", "m", "d", 2, ["lg_jeep-mc", "lg_modern-cd"]),
  caseOf("Maple-Emerald three rides", "m", "e", 3, ["lg_jeep-mc", "lg_modern-cd", "wk_d-out", "lg_bus-de"]),
  caseOf("Narra-Cedar two rides", "n", "c", 2, ["lg_trike-nm", "lg_jeep-mc"]),
  caseOf("Narra-Dalisay three rides", "n", "d", 3, ["lg_trike-nm", "lg_jeep-mc", "lg_modern-cd"]),
  caseOf("Narra-Emerald four rides", "n", "e", 4, ["lg_trike-nm", "lg_jeep-mc", "lg_modern-cd", "wk_d-out", "lg_bus-de"]),
  caseOf("Harbor-Juniper missing fare on second ride", "h", "j", 2, ["lg_bus-hi", "lg_unknown-ij"]),
  caseOf("Harbor-Kamagong three rides", "h", "k", 3, ["lg_bus-hi", "lg_unknown-ij", "lg_trike-jk"]),
  caseOf("Harbor-Laurel four rides", "h", "l", 4, ["lg_bus-hi", "lg_unknown-ij", "lg_trike-jk", "lg_rail-kl"]),
  caseOf("Iris-Kamagong two rides", "i", "k", 2, ["lg_unknown-ij", "lg_trike-jk"]),
  caseOf("Iris-Laurel three rides", "i", "l", 3, ["lg_unknown-ij", "lg_trike-jk", "lg_rail-kl"]),
  caseOf("Juniper-Laurel two rides", "j", "l", 2, ["lg_trike-jk", "lg_rail-kl"]),
  caseOf("Laurel-Orchid transfers through origin-only Tamarind", "l", "o", 2, ["lg_uv-lt", "lg_modern-to"]),
  caseOf("Kamagong-Orchid three rides", "k", "o", 3, ["lg_rail-kl", "lg_uv-lt", "lg_modern-to"]),
  caseOf("Juniper-Orchid four rides", "j", "o", 4, ["lg_trike-jk", "lg_rail-kl", "lg_uv-lt", "lg_modern-to"]),
  caseOf("distinct reverse jeepney Bayani-Alpha", "b", "a", 1, ["lg_jeep-ba"]),
  caseOf("distinct reverse UV Cedar-Bayani", "c", "b", 1, ["lg_uv-cb"]),
  caseOf("Cedar-Alpha directed reverse transfer", "c", "a", 2, ["lg_uv-cb", "lg_jeep-ba"]),
  caseOf("distinct reverse rail Grove-Fern", "g", "f", 1, ["lg_rail-gf"]),
  caseOf("distinct reverse tricycle Fern-Emerald", "f", "e", 1, ["lg_trike-fe"]),
  caseOf("reverse bus uses reverse destination walk", "e", "d", 1, ["lg_bus-ed", "wk_d-in"]),
  caseOf("Grove-Emerald two distinct reverse rides", "g", "e", 2, ["lg_rail-gf", "lg_trike-fe"]),
  caseOf("Grove-Dalisay three reverse rides and walk", "g", "d", 3, ["lg_rail-gf", "lg_trike-fe", "lg_bus-ed", "wk_d-in"]),
  caseOf("distinct reverse rail Laurel-Kamagong", "l", "k", 1, ["lg_rail-lk"]),
];

describe("synthetic source-supported positive route evaluation", () => {
  const pack = loadEvalNetwork();
  it.each(cases)("$name", (testCase) => {
    const result = route(testCase.from, testCase.to, testCase.preference, pack);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error(`${testCase.name}: ${result.reason}`);
    const actualSteps = result.itineraries.map((itinerary) => itinerary.ref.steps.map((step) => step.id));
    if (testCase.expectSteps) expect(actualSteps[0]).toEqual(testCase.expectSteps);
    for (const expected of testCase.expectContains ?? []) expect(actualSteps).toContainEqual(expected);
    expect(result.itineraries[0]?.rideCount).toBe(testCase.expectRides);
    if (testCase.name.startsWith("cross-thread")) {
      expect(pack.sourcesByRecord.get(recordKey("leg", "lg_jeep-ab"))?.[0]?.source_id).toBe("src_thread-a");
      expect(pack.sourcesByRecord.get(recordKey("leg", "lg_uv-bc"))?.[0]?.source_id).toBe("src_thread-b");
    }
  });
});
