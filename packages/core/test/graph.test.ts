import { expect, it } from "vitest";
import { getGraph, loadPack, type Edge } from "../src/index";
import { buildRawPack } from "./fixtures/builder";

it("caches each pack's directed eligible graph and sorts edges and access helpers", () => {
  const raw = buildRawPack({
    places: [{ id: "pl_a", name: "Synthetic A" }, { id: "pl_b", name: "Synthetic B" }],
    stops: [{ id: "st_a", place: "pl_a" }, { id: "st_b", place: "pl_b" }],
    access: [
      { id: "ac_z", place: "pl_a", stop: "st_a", dir: "both" },
      { id: "ac_b", place: "pl_a", stop: "st_a", dir: "from_stop" },
      { id: "ac_a", place: "pl_a", stop: "st_a", dir: "to_stop" },
      { id: "ac_x", place: "pl_a", stop: "st_a", dir: "both", excluded: true },
    ],
    routes: [{ id: "rt_active" }, { id: "rt_unknown", status: "unknown" }, { id: "rt_suspended", status: "suspended" }, { id: "rt_retired", status: "retired" }],
    legs: [
      { id: "lg_z", route: "rt_active", from: "st_a", to: "st_b" },
      { id: "lg_a", route: "rt_unknown", from: "st_a", to: "st_b" },
      { id: "lg_s", route: "rt_suspended", from: "st_a", to: "st_b" },
      { id: "lg_r", route: "rt_retired", from: "st_a", to: "st_b" },
      { id: "lg_x", route: "rt_active", from: "st_a", to: "st_b", excluded: true },
    ],
    walks: [{ id: "wk_a", from: "st_a", to: "st_b" }, { id: "wk_x", from: "st_a", to: "st_b", excluded: true }],
  });
  const first = loadPack(raw);
  const second = loadPack(raw);
  if (!first.ok || !second.ok) throw new Error("Synthetic fixture failed to load");
  const graph = getGraph(first.value);
  expect(getGraph(first.value)).toBe(graph);
  expect(getGraph(second.value)).not.toBe(graph);
  const id = (edge: Edge) => edge.kind === "leg" ? edge.leg.leg_id : edge.walk.walk_id;
  expect(graph.outByStop.get("st_a")?.map(id)).toEqual(["lg_a", "lg_z", "wk_a"]);
  expect(graph.outByStop.has("st_b")).toBe(false);
  expect(graph.originAccesses("pl_a").map((item) => item.access_id)).toEqual(["ac_a", "ac_z"]);
  expect(graph.destinationAccesses("pl_a").map((item) => item.access_id)).toEqual(["ac_b", "ac_z"]);
  expect(graph.originAccesses("pl_missing")).toEqual([]);
});
