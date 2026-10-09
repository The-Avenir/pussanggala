import { describe, expect, it } from "vitest";
import { loadPack, resolve, type Pack, type RawPackTables, type TripState } from "../src/index";
import { minimalRawPack } from "./fixtures/minimal-pack";

const trip: TripState = {
  packId: "pack_demo-001", schemaVersion: 1, preference: "balanced", currentStep: 0,
  originPlaceId: "pl_demo-plaza", destinationPlaceId: "pl_demo-market",
};

function pack(mutate?: (raw: RawPackTables) => void): Pack {
  const raw = structuredClone(minimalRawPack());
  mutate?.(raw);
  const result = loadPack(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

function text(value: string, loaded = pack()) {
  return resolve({ kind: "text", text: value, span: [0, value.length] }, loaded);
}

function status(raw: RawPackTables, id: string, value: string): void {
  const place = (raw.places as Record<string, unknown>[]).find((row) => row.place_id === id)!;
  place.ncr_status = value;
}

function alias(raw: RawPackTables, norm: string, id: string): void {
  raw.place_aliases.push({ alias_id: raw.place_aliases.length + 1, alias_norm: norm, alias_display: norm, place_id: id });
}

describe("place resolution", () => {
  it("resolves normalized exact aliases", () => {
    expect(text("  DEMO-Plaza! ")).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: "exact" });
    expect(text("Sta. Demo Plaza")).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: "exact" });
  });

  it("reports exact outside places", () => {
    expect(text("Faraway Ville")).toEqual({ status: "outside_ncr", placeId: "pl_faraway-ville", name: "Faraway Ville" });
  });

  it("shows deterministic ambiguity choices including area and kind", () => {
    expect(text("demo center")).toEqual({ status: "needs_clarification", candidates: [
      { placeId: "pl_demo-market", name: "Demo Market", area: "Demo City", kind: "market" },
      { placeId: "pl_demo-plaza", name: "Demo Plaza", area: "Demo City", kind: "landmark" },
    ] });
  });

  it("resolves a unique one-character typo as fuzzy", () => {
    expect(text("Demo Plza")).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: "fuzzy" });
  });

  it("does not fuzzy match queries shorter than five characters", () => {
    const loaded = pack((raw) => alias(raw, "demo", "pl_demo-plaza"));
    expect(text("deom", loaded)).toEqual({ status: "unsupported", reason: "unsupported_place", suggestions: [] });
  });

  it("clarifies multiple aliases within threshold and deduplicates places", () => {
    const loaded = pack((raw) => {
      alias(raw, "demo plaze", "pl_demo-market");
      alias(raw, "demo plazz", "pl_demo-plaza");
    });
    const result = text("demo plaz", loaded);
    expect(result.status).toBe("needs_clarification");
    if (result.status !== "needs_clarification") throw new Error("expected clarification");
    expect(result.candidates.map((row) => row.placeId)).toEqual(["pl_demo-market", "pl_demo-plaza"]);
  });

  it("fuzzy ambiguity hits contribute every accepted candidate", () => {
    const result = text("demo cente");
    expect(result.status).toBe("needs_clarification");
    if (result.status !== "needs_clarification") throw new Error("expected clarification");
    expect(result.candidates.map((row) => row.placeId)).toEqual(["pl_demo-market", "pl_demo-plaza"]);
  });

  it("uses one edit for lengths five through eight and two for nine or more", () => {
    const loaded = pack((raw) => alias(raw, "plaza", "pl_demo-plaza"));
    expect(text("plaze", loaded)).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: "fuzzy" });
    expect(text("plzze", loaded)).toEqual({ status: "unsupported", reason: "unsupported_place", suggestions: [] });
    expect(text("demx plzza", loaded)).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: "fuzzy" });
  });

  it("sorts tied names by ID and ignores outside candidates when accepted ones exist", () => {
    const loaded = pack((raw) => {
      for (const row of raw.places as Record<string, unknown>[]) row.name = "Same Name";
      alias(raw, "demo plaze", "pl_demo-market");
      alias(raw, "demo plazz", "pl_faraway-ville");
    });
    const result = text("demo plaz", loaded);
    expect(result.status).toBe("needs_clarification");
    if (result.status !== "needs_clarification") throw new Error("expected clarification");
    expect(result.candidates.map((row) => row.placeId)).toEqual(["pl_demo-market", "pl_demo-plaza"]);
  });

  it("ranks fuzzy candidates by edit distance before name", () => {
    const loaded = pack((raw) => {
      (raw.places[1] as Record<string, unknown>).name = "Zulu Market";
      alias(raw, "demo plax", "pl_demo-market");
    });
    const result = text("demo plaxx", loaded);
    expect(result.status).toBe("needs_clarification");
    if (result.status !== "needs_clarification") throw new Error("expected clarification");
    expect(result.candidates.map((row) => row.placeId)).toEqual(["pl_demo-market", "pl_demo-plaza"]);
  });

  it("resolves a unique accepted fuzzy candidate even with an outside hit", () => {
    const loaded = pack((raw) => alias(raw, "demo plaze", "pl_faraway-ville"));
    expect(text("demo plaz", loaded)).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: "fuzzy" });
  });

  it("limits exact and fuzzy ambiguity lists to four accepted choices", () => {
    const loaded = pack((raw) => {
      status(raw, "pl_faraway-ville", "accepted");
      const first = raw.places[0] as Record<string, unknown>;
      const source = raw.record_sources[1] as Record<string, unknown>;
      raw.places.push({ ...first, place_id: "pl_extra-a", name: "Extra A" });
      raw.record_sources.push({ ...source, link_id: 23, record_id: "pl_extra-a" });
      for (const [index, id] of ["pl_demo-terminal", "pl_faraway-ville", "pl_extra-a"].entries()) {
        raw.place_ambiguities.push({ ambiguity_id: index + 3, alias_norm: "demo center", place_id: id });
      }
    });
    for (const query of ["demo center", "demo cente"]) {
      const result = text(query, loaded);
      expect(result.status).toBe("needs_clarification");
      if (result.status !== "needs_clarification") throw new Error("expected clarification");
      expect(result.candidates.map((row) => row.placeId)).toEqual(["pl_demo-market", "pl_demo-plaza", "pl_demo-terminal", "pl_extra-a"]);
    }
  });

  it.each(["demo center", "demo cente"])("filters non-NCR ambiguity choices for %s", (query) => {
    const loaded = pack((raw) => status(raw, "pl_demo-market", "outside"));
    expect(text(query, loaded)).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: query === "demo center" ? "exact" : "fuzzy" });
  });

  it("returns ncr_unresolved when no exact ambiguity candidate is accepted", () => {
    const loaded = pack((raw) => {
      status(raw, "pl_demo-market", "outside");
      status(raw, "pl_demo-plaza", "ambiguous");
    });
    expect(text("demo center", loaded)).toEqual({ status: "unsupported", reason: "ncr_unresolved", suggestions: [] });
    expect(text("demo cente", loaded)).toEqual({ status: "outside_ncr", placeId: "pl_demo-market", name: "Demo Market" });
  });

  it("resolves trip references using the selected slot", () => {
    const loaded = pack();
    expect(resolve({ kind: "trip_ref", ref: "origin" }, loaded, trip)).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: "trip_ref" });
    expect(resolve({ kind: "trip_ref", ref: "destination" }, loaded, trip)).toEqual({ status: "resolved", placeId: "pl_demo-market", match: "trip_ref" });
    expect(resolve({ kind: "trip_ref", ref: "origin" }, loaded)).toEqual({ status: "unsupported", reason: "no_trip_context", suggestions: [] });
    expect(resolve({ kind: "trip_ref", ref: "origin" }, loaded, { ...trip, originPlaceId: undefined })).toEqual({ status: "unsupported", reason: "no_trip_context", suggestions: [] });
  });

  it("checks known, unknown, outside and unresolved place IDs", () => {
    const loaded = pack((raw) => status(raw, "pl_demo-terminal", "ambiguous"));
    expect(resolve({ kind: "place_id", placeId: "pl_demo-plaza" }, loaded)).toEqual({ status: "resolved", placeId: "pl_demo-plaza", match: "id" });
    expect(resolve({ kind: "place_id", placeId: "pl_missing" }, loaded)).toEqual({ status: "unsupported", reason: "unsupported_place", suggestions: [] });
    expect(resolve({ kind: "place_id", placeId: "pl_faraway-ville" }, loaded).status).toBe("outside_ncr");
    expect(resolve({ kind: "place_id", placeId: "pl_demo-terminal" }, loaded)).toEqual({ status: "unsupported", reason: "ncr_unresolved", suggestions: [] });
    expect(text("Demo Terminal", loaded)).toEqual({ status: "unsupported", reason: "ncr_unresolved", suggestions: [] });
    expect(text("Demo Termina", loaded)).toEqual({ status: "unsupported", reason: "ncr_unresolved", suggestions: [] });
  });

  it("ranks outside fuzzy hits when no accepted hit remains", () => {
    expect(text("Faraway Vile")).toEqual({ status: "outside_ncr", placeId: "pl_faraway-ville", name: "Faraway Ville" });
  });

  it("suggests only accepted places sharing a token of at least three characters", () => {
    const result = text("demo unknown depot");
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") throw new Error("expected unsupported");
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions.every((row) => row.name.startsWith("Demo "))).toBe(true);
    expect(text("de unknown")).toEqual({ status: "unsupported", reason: "unsupported_place", suggestions: [] });
  });

  it("rejects empty normalized mentions", () => {
    expect(text("!? ")).toEqual({ status: "unsupported", reason: "unsupported_place", suggestions: [] });
  });

  it("also suggests accepted places sharing only an ambiguity alias token", () => {
    const result = text("unknown center");
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") throw new Error("expected unsupported");
    expect(result.suggestions.map((row) => row.placeId)).toEqual(["pl_demo-market", "pl_demo-plaza"]);
  });
});
