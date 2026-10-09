import { describe, expect, it } from "vitest";
import { loadPack } from "../src/index";
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
});
