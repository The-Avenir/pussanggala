import { describe, expect, it } from "vitest";
import {
  cardId,
  ExplanationUnitSchema,
  FareReportRow,
  ID_PREFIXES,
  IntentSchema,
  itineraryId,
  LegRow,
  parseRouteJson,
  PlaceRow,
  ShapeRow,
  stableId,
} from "../src/index";

const legId = stableId(ID_PREFIXES.leg);

describe("stable IDs", () => {
  it("accepts a well-formed ID", () => {
    expect(legId.safeParse("lg_cubao-1").success).toBe(true);
  });

  it("rejects a wrong prefix and uppercase", () => {
    expect(legId.safeParse("st_cubao-1").success).toBe(false);
    expect(legId.safeParse("LG_cubao-1").success).toBe(false);
    expect(legId.safeParse("lg_Cubao-1").success).toBe(false);
    expect(legId.safeParse("lg_").success).toBe(false);
  });

  it("derives itinerary and card IDs", () => {
    const id = itineraryId([
      { kind: "access", id: "ac_demo-in" },
      { kind: "leg", id: "lg_demo-1" },
      { kind: "walk", id: "wk_demo-1" },
      { kind: "access", id: "ac_demo-out" },
    ]);
    expect(id).toBe("it_ac_demo-in.lg_demo-1.wk_demo-1.ac_demo-out");
    expect(cardId(id, 1)).toBe("it_ac_demo-in.lg_demo-1.wk_demo-1.ac_demo-out#1");
  });
});

const validPlace = {
  place_id: "pl_demo-plaza",
  region_id: "rg_ncr",
  name: "Demo Plaza",
  kind: "landmark",
  area: "Demo City",
  ncr_status: "accepted",
  lat: 14.6,
  lng: 121.03,
  mapping_status: "mapped",
};

const validLeg = {
  leg_id: "lg_demo-1",
  route_id: "rt_demo",
  board_stop_id: "st_demo-a",
  alight_stop_id: "st_demo-b",
  ride_min: 25,
  dist_km: 7.5,
  eligibility: "ready",
};

const validFare = {
  fare_id: "fr_demo-1",
  leg_id: "lg_demo-1",
  amount_min: 13,
  amount_max: 15,
  currency: "PHP",
  basis: "reported_segment",
  effective_at: "2025-01-15",
};

const validShape = {
  shape_id: "sh_demo-1",
  leg_id: "lg_demo-1",
  walk_id: null,
  geojson: '{"type":"LineString","coordinates":[]}',
  geometry_kind: "schematic",
};

describe("pack row schemas", () => {
  it("parses valid PlaceRow, LegRow, FareReportRow and ShapeRow", () => {
    expect(PlaceRow.safeParse(validPlace).success).toBe(true);
    expect(LegRow.safeParse(validLeg).success).toBe(true);
    expect(FareReportRow.safeParse(validFare).success).toBe(true);
    expect(ShapeRow.safeParse(validShape).success).toBe(true);
  });

  it("rejects unpaired lat/lng", () => {
    expect(PlaceRow.safeParse({ ...validPlace, lng: null }).success).toBe(false);
  });

  it("rejects amount_min > amount_max and non-PHP currency", () => {
    expect(
      FareReportRow.safeParse({ ...validFare, amount_min: 20 }).success,
    ).toBe(false);
    expect(
      FareReportRow.safeParse({ ...validFare, currency: "USD" }).success,
    ).toBe(false);
    expect(
      FareReportRow.safeParse({ ...validFare, amount_min: -1 }).success,
    ).toBe(false);
  });

  it("rejects a shape with both leg_id and walk_id, or neither", () => {
    expect(
      ShapeRow.safeParse({ ...validShape, walk_id: "wk_demo-1" }).success,
    ).toBe(false);
    expect(ShapeRow.safeParse({ ...validShape, leg_id: null }).success).toBe(
      false,
    );
  });

  it("rejects bad enum values", () => {
    expect(
      PlaceRow.safeParse({ ...validPlace, ncr_status: "verified" }).success,
    ).toBe(false);
    expect(LegRow.safeParse({ ...validLeg, eligibility: "maybe" }).success).toBe(
      false,
    );
  });
});

describe("intent schema", () => {
  const baseIntent = {
    kind: "new_trip",
    source: "model",
    origin: { kind: "text", text: "Demo Plaza", span: [0, 10] },
  };

  it("accepts a valid text mention", () => {
    expect(IntentSchema.safeParse(baseIntent).success).toBe(true);
  });

  it("rejects a span with start >= end", () => {
    const bad = {
      ...baseIntent,
      origin: { kind: "text", text: "Demo", span: [4, 4] },
    };
    expect(IntentSchema.safeParse(bad).success).toBe(false);
    const reversed = {
      ...baseIntent,
      origin: { kind: "text", text: "Demo", span: [9, 2] },
    };
    expect(IntentSchema.safeParse(reversed).success).toBe(false);
  });
});

describe("parseRouteJson", () => {
  it("parses a valid ItineraryRef", () => {
    const ref = { v: 1, steps: [{ kind: "leg", id: "lg_demo-1" }] };
    expect(parseRouteJson(JSON.stringify(ref))).toEqual({ ok: true, value: ref });
  });

  it("rejects bad JSON and wrong shapes", () => {
    expect(parseRouteJson("not json")).toEqual({
      ok: false,
      error: "invalid_route_json",
    });
    expect(parseRouteJson('{"v":2,"steps":[]}')).toEqual({
      ok: false,
      error: "invalid_route_json",
    });
  });
});

describe("explanation units", () => {
  it("accepts a unit within the 280-char limit", () => {
    expect(
      ExplanationUnitSchema.safeParse({ kind: "summary", text: "x".repeat(280) })
        .success,
    ).toBe(true);
  });

  it("rejects text over 280 chars", () => {
    expect(
      ExplanationUnitSchema.safeParse({ kind: "summary", text: "x".repeat(281) })
        .success,
    ).toBe(false);
  });
});
