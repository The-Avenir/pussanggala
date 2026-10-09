import { expect, it } from "vitest";
import { loadPack, recordKey } from "../src/index";
import { buildRawPack } from "./fixtures/builder";

it("builds a valid synthetic pack with aliases, dated reports and provenance overrides", () => {
  const result = loadPack(buildRawPack({
    places: [{ id: "pl_a", name: "Synthetic A", aliases: ["Sta. Synthetic"], coords: [14.6, 121] }, { id: "pl_b", name: "Synthetic B" }],
    ambiguities: [{ alias: "Common Synthetic", placeIds: ["pl_a", "pl_b"] }],
    stops: [{ id: "st_a", place: "pl_a" }, { id: "st_b", place: "pl_b" }],
    access: [{ id: "ac_a", place: "pl_a", stop: "st_a", dir: "both" }, { id: "ac_x", place: "pl_b", stop: "st_b", dir: "both", excluded: true }],
    routes: [{ id: "rt_a" }], legs: [{ id: "lg_a", route: "rt_a", from: "st_a", to: "st_b" }],
    walks: [{ id: "wk_a", from: "st_b", to: "st_a", excluded: true }],
    fares: [{ id: "fr_a", leg: "lg_a", min: 10, postedAt: "2026-07-01" }],
    hours: [{ id: "hr_a", route: "rt_a", text: "Synthetic hours", postedAt: "2026-07-01" }],
    notes: [{ id: "nt_a", body: "Synthetic warning", leg: "lg_a" }],
    sources: [{ id: "src_extra", postedAt: null }], recordSources: [{ kind: "leg", id: "lg_a", source: "src_extra" }],
  }));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  const pack = result.value;
  expect(pack.aliasesByNorm.get("santa synthetic")?.place_id).toBe("pl_a");
  expect(pack.sourcesByRecord.get(recordKey("leg", "lg_a"))?.map((item) => item.source_id)).toEqual(["src_extra"]);
  expect(pack.sourcesByRecord.has(recordKey("place_stop", "ac_x"))).toBe(false);
  expect(pack.sourcesByRecord.get(recordKey("fare_report", "fr_a"))?.[0]?.source_id).toBe(pack.sourcesByRecord.get(recordKey("hours_report", "hr_a"))?.[0]?.source_id);
  expect(pack.placeStops.get("ac_a")?.walk_min).toBeNull();
});
