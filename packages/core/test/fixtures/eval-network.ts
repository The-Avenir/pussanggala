import { loadPack, type Pack, type RawPackTables } from "../../src/index";
import { buildRawPack, type PackSpec } from "./builder";

export const NETWORK_DIAGRAM = `Synthetic network; arrows are explicit directed records, never proximity.
Access ac_<letter> uses st_<letter>, except ac_d uses st_d-in.
All accesses have 2 reported minutes / 20 meters; q is excluded,
t is to_stop only, o is from_stop only; ac_a-alt has no outgoing edges.

Main corridor (letters identify places):
a Alpha Terminal <-(lg_jeep-ba)-- (lg_jeep-ab)-> b Bayani Market
b <-(lg_uv-cb)-- (lg_uv-bc)-> c Cedar Hospital
a --(lg_fast-ac, PHP60, 10min)--> c
a --(lg_express-ac, PHP70, 8min)--> c
a --(lg_unknown-ac, fare/time unknown)--> c
a --(lg_bargain-am, PHP5, 25min)--> m Maple Depot
m --(lg_jeep-mc, PHP5, 25min)--> c
n Narra Clinic --(lg_trike-nm, PHP8, 10min)--> m
c --(lg_modern-cd, PHP20, 15min)--> d-in Dalisay Station
d-in --(wk_d-out, 3min/100m)--> d-out
d-out --(wk_d-in, 3min/100m)--> d-in
d-out <-(lg_bus-ed)-- (lg_bus-de)-> e Emerald College
e <-(lg_trike-fe)-- (lg_trike-ef)-> f Fern Mall
f <-(lg_rail-gf)-- (lg_rail-fg)-> g Grove Hall
Main reverse legs are separate records; c->d has no reverse.
a-b: PHP10/15min; b-c: PHP15/20min; d-e: PHP20..25/15min
(two conflicting reports); e-f: PHP10/10min; f-g: PHP20/10min.
Reverse b-a/c-b/e-d/f-e/g-f have the forward cost and duration,
except e-d has one PHP20 report.
The a-b and b-c legs have distinct thread sources joined at st_b.

East corridor:
h Harbor Wharf --(lg_bus-hi, PHP12, 8min)--> i Iris Library
i --(lg_unknown-ij, fare unknown, 12min)--> j Juniper Park
j --(lg_trike-jk, PHP8, 8min)--> k Kamagong Center
k <-(lg_rail-lk)-- (lg_rail-kl, PHP18, 10min)-> l Laurel Museum
l --(lg_uv-lt, PHP10, 12min)--> t Tamarind Gate
t --(lg_modern-to, PHP10, 10min)--> o Orchid Plaza
No edge joins the two corridors.

Isolated / forbidden records:
p Pine Court --(lg_suspended-po, suspended)--> o
p --(lg_retired-ph, retired)--> h
p --(lg_excluded-pg, excluded leg)--> g
p --(wk_excluded-ph, excluded walk)--> h
q Quartz Tower has only excluded access.
r River Walk and s River Walk Annex have nearly equal coordinates
and similar names, but there is NO edge between their stops.
u Umber Village is outside; v Vista Point has ambiguous NCR membership.
Alias Central Hub means b or c and must ask for clarification.
Unmapped accepted places: n and p.
`;

export function evalNetworkSpec(): PackSpec {
  const named: [string, string, string[]][] = [
    ["a", "Alpha Terminal", ["Alpha Hub"]], ["b", "Bayani Market", ["Bayani Bazaar"]],
    ["c", "Cedar Hospital", ["Cedar Clinic"]], ["d", "Dalisay Station", ["Dalisay Rail"]],
    ["e", "Emerald College", ["Emerald Campus"]], ["f", "Fern Mall", ["Fern Shops"]],
    ["g", "Grove Hall", ["Grove Center"]], ["h", "Harbor Wharf", ["Harbor Port"]],
    ["i", "Iris Library", ["Iris Books"]], ["j", "Juniper Park", ["Juniper Garden"]],
    ["k", "Kamagong Center", ["Kamagong Hub"]], ["l", "Laurel Museum", ["Laurel Gallery"]],
    ["m", "Maple Depot", ["Maple Yard"]], ["n", "Narra Clinic", ["Narra Health"]],
    ["o", "Orchid Plaza", ["Orchid Square"]], ["p", "Pine Court", ["Pine Hall"]],
    ["q", "Quartz Tower", ["Quartz Building"]], ["r", "River Walk", ["River Path"]],
    ["s", "River Walk Annex", ["River Annex"]], ["t", "Tamarind Gate", ["Tamarind Entry"]],
  ];
  const places: PackSpec["places"] = named.map(([id, name, aliases], index) => {
    const place: PackSpec["places"][number] = { id: `pl_${id}`, name, aliases, area: `Synthetic District ${id.toUpperCase()}` };
    if (id !== "n" && id !== "p") place.coords = [14.6 + index * 0.001, 121 + index * 0.001];
    if (id === "r") place.coords = [14.63, 121.03];
    if (id === "s") place.coords = [14.630001, 121.030001];
    return place;
  });
  places.push({ id: "pl_u", name: "Umber Village", ncr: "outside" }, { id: "pl_v", name: "Vista Point", ncr: "ambiguous" });
  const stops: PackSpec["stops"] = named.map(([id, name]) => ({ id: id === "d" ? "st_d-in" : `st_${id}`, place: `pl_${id}`, name: `${name} Synthetic Stop` }));
  stops.push({ id: "st_d-out", place: "pl_d" }, { id: "st_a-alt", place: "pl_a" }, { id: "st_b-alt", place: "pl_b" }, { id: "st_c-alt", place: "pl_c" }, { id: "st_u", place: "pl_u" }, { id: "st_v", place: "pl_v" });
  const access: PackSpec["access"] = places.map((place) => {
    const id = place.id.slice(3);
    return { id: `ac_${id}`, place: place.id, stop: id === "d" ? "st_d-in" : `st_${id}`, dir: id === "t" ? "to_stop" : id === "o" ? "from_stop" : "both", walk_m: 20, walk_min: 2, excluded: id === "q" };
  });
  access.push({ id: "ac_a-alt", place: "pl_a", stop: "st_a-alt", dir: "to_stop", walk_m: 30, walk_min: 3 });
  const routes: PackSpec["routes"] = [
    { id: "rt_jeep", mode: "jeepney", signboard: "SYNTHETIC ALPHA-BAYANI" },
    { id: "rt_modern", mode: "modern_jeepney", signboard: "SYNTHETIC CEDAR-DALISAY" },
    { id: "rt_uv", mode: "uv_express", direction: "Synthetic Bayani-Cedar" },
    { id: "rt_bus", mode: "bus", signboard: "SYNTHETIC DALISAY-EMERALD" },
    { id: "rt_trike", mode: "tricycle", direction: "Synthetic local connectors" },
    { id: "rt_rail", mode: "rail", direction: "Synthetic rail connectors" },
    { id: "rt_fast", mode: "bus", signboard: "SYNTHETIC ALPHA-CEDAR FAST" },
    { id: "rt_express", mode: "uv_express", signboard: "SYNTHETIC ALPHA-CEDAR EXPRESS" },
    { id: "rt_bargain", mode: "jeepney", direction: "Synthetic Alpha-Maple" },
    { id: "rt_unknown", mode: "jeepney", status: "unknown", direction: "Synthetic uncertain service" },
    { id: "rt_suspended", mode: "bus", status: "suspended" },
    { id: "rt_retired", mode: "rail", status: "retired" },
  ];
  const legs: PackSpec["legs"] = [
    { id: "lg_jeep-ab", route: "rt_jeep", from: "st_a", to: "st_b", ride_min: 15 },
    { id: "lg_jeep-ba", route: "rt_jeep", from: "st_b", to: "st_a", ride_min: 15 },
    { id: "lg_uv-bc", route: "rt_uv", from: "st_b", to: "st_c", ride_min: 20 },
    { id: "lg_uv-cb", route: "rt_uv", from: "st_c", to: "st_b", ride_min: 20 },
    { id: "lg_fast-ac", route: "rt_fast", from: "st_a", to: "st_c", ride_min: 10 },
    { id: "lg_express-ac", route: "rt_express", from: "st_a", to: "st_c", ride_min: 8 },
    { id: "lg_unknown-ac", route: "rt_unknown", from: "st_a", to: "st_c" },
    { id: "lg_bargain-am", route: "rt_bargain", from: "st_a", to: "st_m", ride_min: 25 },
    { id: "lg_jeep-mc", route: "rt_jeep", from: "st_m", to: "st_c", ride_min: 25 },
    { id: "lg_trike-nm", route: "rt_trike", from: "st_n", to: "st_m", ride_min: 10 },
    { id: "lg_modern-cd", route: "rt_modern", from: "st_c", to: "st_d-in", ride_min: 15 },
    { id: "lg_bus-de", route: "rt_bus", from: "st_d-out", to: "st_e", ride_min: 15 },
    { id: "lg_bus-ed", route: "rt_bus", from: "st_e", to: "st_d-out", ride_min: 15 },
    { id: "lg_trike-ef", route: "rt_trike", from: "st_e", to: "st_f", ride_min: 10 },
    { id: "lg_trike-fe", route: "rt_trike", from: "st_f", to: "st_e", ride_min: 10 },
    { id: "lg_rail-fg", route: "rt_rail", from: "st_f", to: "st_g", ride_min: 10 },
    { id: "lg_rail-gf", route: "rt_rail", from: "st_g", to: "st_f", ride_min: 10 },
    { id: "lg_bus-hi", route: "rt_bus", from: "st_h", to: "st_i", ride_min: 8 },
    { id: "lg_unknown-ij", route: "rt_unknown", from: "st_i", to: "st_j", ride_min: 12 },
    { id: "lg_trike-jk", route: "rt_trike", from: "st_j", to: "st_k", ride_min: 8 },
    { id: "lg_rail-kl", route: "rt_rail", from: "st_k", to: "st_l", ride_min: 10 },
    { id: "lg_rail-lk", route: "rt_rail", from: "st_l", to: "st_k", ride_min: 10 },
    { id: "lg_uv-lt", route: "rt_uv", from: "st_l", to: "st_t", ride_min: 12 },
    { id: "lg_modern-to", route: "rt_modern", from: "st_t", to: "st_o", ride_min: 10 },
    { id: "lg_suspended-po", route: "rt_suspended", from: "st_p", to: "st_o", ride_min: 10 },
    { id: "lg_retired-ph", route: "rt_retired", from: "st_p", to: "st_h", ride_min: 10 },
    { id: "lg_excluded-pg", route: "rt_rail", from: "st_p", to: "st_g", ride_min: 10, excluded: true },
  ];
  const amounts: [string, number][] = [
    ["jeep-ab", 10], ["jeep-ba", 10], ["uv-bc", 15], ["uv-cb", 15], ["fast-ac", 60], ["express-ac", 70],
    ["bargain-am", 5], ["jeep-mc", 5], ["trike-nm", 8], ["modern-cd", 20], ["bus-de", 20], ["bus-ed", 20],
    ["trike-ef", 10], ["trike-fe", 10], ["rail-fg", 20], ["rail-gf", 20], ["bus-hi", 12], ["trike-jk", 8],
    ["rail-kl", 18], ["rail-lk", 18], ["uv-lt", 10], ["modern-to", 10],
  ];
  const fares: PackSpec["fares"] = amounts.map(([id, min]) => ({ id: `fr_${id}`, leg: `lg_${id}`, min, postedAt: "2026-09-01" }));
  fares.push({ id: "fr_bus-de-old", leg: "lg_bus-de", min: 25, postedAt: "2024-01-01" });
  return {
    places, stops, access, routes, legs, fares,
    ambiguities: [{ alias: "Central Hub", placeIds: ["pl_b", "pl_c"] }],
    walks: [{ id: "wk_d-out", from: "st_d-in", to: "st_d-out", walk_m: 100, walk_min: 3 }, { id: "wk_d-in", from: "st_d-out", to: "st_d-in", walk_m: 100, walk_min: 3 }, { id: "wk_excluded-ph", from: "st_p", to: "st_h", excluded: true }],
    hours: [{ id: "hr_jeep", route: "rt_jeep", text: "Synthetic 06:00-18:00", starts: "06:00", ends: "18:00", postedAt: "2026-09-01" }, { id: "hr_bus-a", route: "rt_bus", text: "Synthetic 06:00-18:00", starts: "06:00", ends: "18:00", postedAt: "2024-01-01" }, { id: "hr_bus-b", route: "rt_bus", text: "Synthetic 08:00-20:00", starts: "08:00", ends: "20:00", postedAt: "2026-09-01" }],
    notes: [{ id: "nt_tip", kind: "tip", body: "Synthetic boarding tip", leg: "lg_jeep-ab" }, { id: "nt_warning", kind: "warning", body: "Synthetic transfer warning", stop: "st_d-in" }, { id: "nt_conflict", kind: "conflict", body: "Synthetic reports disagree", leg: "lg_bus-de" }],
    sources: [{ id: "src_thread-a", postedAt: "2026-09-02" }, { id: "src_thread-b", postedAt: "2026-09-03" }, { id: "src_old", postedAt: "2024-01-01" }, { id: "src_null", postedAt: null }],
    recordSources: [{ kind: "leg", id: "lg_jeep-ab", source: "src_thread-a" }, { kind: "leg", id: "lg_uv-bc", source: "src_thread-b" }, { kind: "leg", id: "lg_bus-de", source: "src_old" }, { kind: "route", id: "rt_unknown", source: "src_null" }, { kind: "leg", id: "lg_unknown-ac", source: "src_null" }],
  };
}

export function evalNetworkRaw(): RawPackTables {
  return buildRawPack(evalNetworkSpec());
}

export function loadEvalNetwork(): Pack {
  const result = loadPack(evalNetworkRaw());
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}
