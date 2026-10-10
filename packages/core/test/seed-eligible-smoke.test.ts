import { describe, expect, it } from "vitest";
import { loadPack, route } from "../src/index";
import { loadSeedEligibleRaw } from "./fixtures/seed-eligible-pack";

describe("data/seed/eligible smoke", () => {
  it("loadPack accepts the cleaned eligible pack tables", () => {
    const raw = loadSeedEligibleRaw();
    const result = loadPack(raw);
    if (!result.ok) {
      throw new Error(
        `loadPack failed: ${JSON.stringify(result.error.slice(0, 5))}`,
      );
    }
    const pack = result.value;
    expect(pack.places.size).toBeGreaterThan(0);
    expect(pack.routes.size).toBeGreaterThan(0);
    expect(pack.legs.size).toBeGreaterThan(0);
  });

  it.each([
    ["rail", "mrt north avenue", "mrt guadalupe"],
    ["rail", "mrt north avenue", "mrt cubao"],
    ["rail", "mrt north avenue", "mrt taft"],
    ["rail", "mrt north avenue", "mrt shaw"],
    ["rail", "mrt ortigas", "mrt cubao"],
    ["rail", "mrt quezon avenue", "mrt ayala"],
    ["rail", "lrt2 cubao", "lrt2 katipunan"],
    ["jeepney", "guadalupe", "market market"],
    ["jeepney", "telus mckinley", "market market"],
    ["jeepney", "sm north", "up diliman"],
    ["jeepney", "philcoa", "up diliman"],
    ["jeepney", "lrt2 cubao", "ust"],
    ["jeepney", "shaw blvd", "pasig palengke"],
    ["jeepney", "bcda", "mckinley"],
  ])("routes the curated %s journey from %s to %s without invented fares", (mode, origin, destination) => {
    const loaded = loadPack(loadSeedEligibleRaw());
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    const pack = loaded.value;
    const originId = pack.aliasesByNorm.get(origin)?.place_id;
    const destinationId = pack.aliasesByNorm.get(destination)?.place_id;
    if (!originId || !destinationId) throw new Error("Missing curated station alias");
    const result = route(originId, destinationId, "fewest_transfers", pack);
    if (result.status !== "ok") throw new Error(result.reason);
    const directRail = result.itineraries.find((item) => item.rideCount === 1 &&
      item.routeIds.every((id) => pack.routes.get(id)?.mode === mode));
    expect(directRail).toBeDefined();
    expect(directRail?.fare.status).toBe("unknown");
  });
});
