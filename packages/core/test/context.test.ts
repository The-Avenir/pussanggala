import { describe, expect, it } from "vitest";
import { buildComparisons, buildContext, compose, loadPack, searchItineraries, type Card, type ContextInput, type TripState } from "../src/index";
import { buildRawPack, type PackSpec } from "./fixtures/builder";

const now = new Date("2026-10-09T00:00:00Z");

function fixture() {
  const spec: PackSpec = {
    places: [{ id: "pl_a", name: "Synthetic Origin" }, { id: "pl_b", name: "Synthetic Destination" }],
    stops: [{ id: "st_a", place: "pl_a" }, { id: "st_b", place: "pl_b" }],
    access: [{ id: "ac_a", place: "pl_a", stop: "st_a", dir: "both" }, { id: "ac_b", place: "pl_b", stop: "st_b", dir: "both" }],
    routes: Array.from({ length: 6 }, (_, i) => ({ id: `rt_${i}` })),
    legs: Array.from({ length: 6 }, (_, i) => ({ id: `lg_${i}`, route: `rt_${i}`, from: "st_a", to: "st_b" })),
    fares: Array.from({ length: 6 }, (_, i) => ({ id: `fr_${i}`, leg: `lg_${i}`, min: 10 + i })),
    hours: [{ id: "hr_4", route: "rt_4", text: "Synthetic reported hours" }],
    notes: [
      { id: "nt_card-tip", body: "Synthetic leg note", leg: "lg_5", kind: "tip" },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `nt_a-tip-${i}`, body: "Synthetic tip", stop: "st_a", kind: "tip" as const })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `nt_b-conflict-${i}`, body: "Synthetic conflict", stop: "st_a", kind: "conflict" as const })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `nt_c-warning-${i}`, body: "Synthetic warning", stop: "st_a", kind: "warning" as const })),
    ],
    sources: [{ id: "src_old", postedAt: "2025-01-01" }],
    recordSources: [{ kind: "note", id: "nt_c-warning-0", source: "src_old" }],
  };
  const loaded = loadPack(buildRawPack(spec));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  const pack = loaded.value;
  const search = searchItineraries("pl_a", "pl_b", pack);
  if (search.status !== "ok") throw new Error(search.reason);
  const itineraries = search.itineraries;
  const selected = itineraries[5]!;
  const cards = compose(selected, pack, now);
  const trip: TripState = { packId: pack.manifest.pack_id, schemaVersion: 1, originPlaceId: "pl_a", destinationPlaceId: "pl_b", preference: "balanced", selected: selected.ref, currentStep: 0 };
  const input: ContextInput = { trip, cards, itineraries, comparisons: [], hourStatements: [], now };
  return { pack, input, selected };
}

describe("bounded evidence context", () => {
  it("caps cards, alternatives and extra notes with deterministic severity ordering", () => {
    const { pack, input, selected } = fixture();
    const firstCard = input.cards[0]!;
    input.cards = Array.from({ length: 13 }, (_, i): Card => ({ ...firstCard, cardId: `${selected.id}#${i}` }));
    const bundle = buildContext(input, pack);
    expect(bundle.v).toBe(1);
    expect(bundle.packId).toBe(pack.manifest.pack_id);
    expect(bundle.trip).toEqual(input.trip);
    expect(bundle.cards).toEqual(input.cards.slice(0, 12));
    expect(bundle.allowedCardIds).toEqual(input.cards.slice(0, 12).map((card) => card.cardId));
    expect(bundle.allowedCardIds).not.toContain(`${selected.id}#12`);
    expect(bundle.alternatives.map((itinerary) => itinerary.id)).toEqual(input.itineraries.slice(0, 3).map((itinerary) => itinerary.id));
    expect(bundle.alternatives).toHaveLength(3);
    expect(bundle.notes.map((note) => note.noteId)).toEqual([
      "nt_c-warning-0", "nt_c-warning-1", "nt_c-warning-2", "nt_c-warning-3",
      "nt_b-conflict-0", "nt_b-conflict-1", "nt_b-conflict-2", "nt_b-conflict-3",
    ]);
    expect(bundle.notes[0]?.sources[0]).toMatchObject({ sourceId: "src_old", postedAt: "2025-01-01", stale: true });
    expect(bundle.allowedRecordIds).not.toContain("nt_a-tip-0");
    expect(bundle.allowedRecordIds).not.toContain("lg_4");
    expect(bundle.allowedRecordIds).toContain("lg_5");
  });

  it("excludes the selected itinerary even when it appears in the middle of the candidate list", () => {
    const { pack, input, selected } = fixture();
    input.itineraries = [input.itineraries[0]!, selected, ...input.itineraries.slice(1, 5)];
    const bundle = buildContext(input, pack);
    expect(bundle.alternatives.map((itinerary) => itinerary.id)).toEqual([input.itineraries[0]!.id, input.itineraries[2]!.id, input.itineraries[3]!.id]);
    expect(bundle.alternatives.some((itinerary) => itinerary.id === selected.id)).toBe(false);
    expect(bundle.alternatives[0]).toEqual({
      id: input.itineraries[0]!.id, rideCount: 1, transferCount: 0,
      fare: input.itineraries[0]!.fare, reportedRideMinutes: { known: false },
    });
  });

  it("keeps card notes first in card order, deduplicates and preserves injected-date provenance", () => {
    const { pack, input } = fixture();
    const ride = input.cards[1]!;
    if (ride.kind !== "ride") throw new Error("Expected ride card");
    input.cards.push({ ...ride, cardId: `${ride.cardId}-duplicate` });
    const bundle = buildContext(input, pack);
    expect(bundle.notes.map((note) => note.noteId)).toEqual(ride.notes.slice(0, 8).map((note) => note.noteId));
    expect(bundle.notes[0]?.noteId).toBe("nt_card-tip");
    expect(new Set(bundle.notes.map((note) => note.noteId)).size).toBe(bundle.notes.length);
    input.now = new Date("2027-10-09T00:00:00Z");
    const updated = buildContext(input, pack);
    expect(updated.notes[0]?.sources[0]?.ageDays).toBe(bundle.notes[0]!.sources[0]!.ageDays! + 365);
  });

  it("includes extra notes only from stops on retained cards", () => {
    const { pack, input } = fixture();
    input.cards = [input.cards[2]!];
    const bundle = buildContext(input, pack);
    expect(bundle.notes).toEqual([]);
  });

  it("filters comparisons whose winner or compared set falls outside the included itineraries", () => {
    const { pack, input, selected } = fixture();
    const retained = [...input.itineraries.slice(0, 3), selected];
    const kept = buildComparisons(retained);
    const outside = buildComparisons(input.itineraries.slice(3, 5));
    const full = buildComparisons(input.itineraries);
    expect(kept).toHaveLength(1);
    expect(outside).toHaveLength(1);
    expect(full).toHaveLength(1);
    input.comparisons = [...kept, ...outside, ...full];
    expect(buildContext(input, pack).comparisons).toEqual(kept);
  });

  it("unions card, retained itinerary, hours and note IDs into the grounding allowlist", () => {
    const { pack, input, selected } = fixture();
    const report = input.cards[1]!;
    if (report.kind !== "ride") throw new Error("Expected ride");
    const hourSources = compose(input.itineraries[4]!, pack, now)[1]!;
    if (hourSources.kind !== "ride") throw new Error("Expected ride");
    input.hourStatements = [{ routeId: "rt_4", status: "reported", reports: hourSources.hours, conflict: false, text: "Synthetic reported hours" }];
    const bundle = buildContext(input, pack);
    for (const card of bundle.cards) {
      for (const id of card.recordIds) expect(bundle.allowedRecordIds).toContain(id);
    }
    for (const itinerary of [...input.itineraries.slice(0, 3), selected]) {
      for (const id of itinerary.recordIds) expect(bundle.allowedRecordIds).toContain(id);
    }
    expect(bundle.allowedRecordIds).toContain("rt_4");
    expect(bundle.allowedRecordIds).toContain("hr_4");
    expect(bundle.allowedRecordIds).not.toContain("lg_4");
    expect(bundle.hourStatements).toEqual(input.hourStatements);
    for (const note of bundle.notes) expect(bundle.allowedRecordIds).toContain(note.noteId);
    expect(bundle.allowedRecordIds).toEqual([...new Set(bundle.allowedRecordIds)].sort());
  });

  it("produces identical output for repeated calls without mutating the input", () => {
    const { pack, input } = fixture();
    const before = structuredClone(input);
    expect(buildContext(input, pack)).toEqual(buildContext(input, pack));
    expect(input).toEqual(before);
  });

  it("supports empty cards and uses at most three available itineraries as alternatives", () => {
    const { pack, input } = fixture();
    input.cards = [];
    const bundle = buildContext(input, pack);
    expect(bundle.cards).toEqual([]);
    expect(bundle.allowedCardIds).toEqual([]);
    expect(bundle.notes).toEqual([]);
    expect(bundle.alternatives.map((itinerary) => itinerary.id)).toEqual(input.itineraries.slice(0, 3).map((itinerary) => itinerary.id));
    input.itineraries = [];
    expect(buildContext(input, pack)).toEqual({ v: 1, packId: pack.manifest.pack_id, trip: input.trip, cards: [], alternatives: [], comparisons: [], hourStatements: [], notes: [], allowedCardIds: [], allowedRecordIds: [] });
  });
});
