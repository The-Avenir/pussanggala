/**
 * T32 — Rules parser adapter tests.
 *
 * `RuleIntentParser` is dev/test only and adds no patterns of its own, so
 * these tests pin only what the manager relies on structurally: the adapter
 * really is core `parse`, it is async, and the core intent kinds and
 * preference values come through unchanged.
 */
import { describe, expect, it } from "vitest";
import { parse } from "@pusang-gala/core";
import { RuleIntentParser } from "../src/ruleIntentParser";
import { baseTrip } from "./fixtures/evidence";

const parser = new RuleIntentParser();
const trip = baseTrip();

describe("rule intent parser (dev/test adapter)", () => {
  it("returns a promise, so a model fallback can slot in later", async () => {
    const pending = parser.parse("from cubao to buendia", trip);
    expect(pending).toBeInstanceOf(Promise);
    expect((await pending).kind).toBe("new_trip");
  });

  it("delegates to core parse without altering the intent", async () => {
    for (const utterance of [
      "from cubao to buendia",
      "magkano pamasahe?",
      "pabalik na ako",
      "paano magluto ng adobo?",
    ]) {
      expect(await parser.parse(utterance, trip)).toEqual(parse(utterance, trip));
    }
  });

  it("extracts endpoints as core place mentions", async () => {
    const intent = await parser.parse("how do I commute from Cubao to Buendia", trip);
    expect(intent.kind).toBe("new_trip");
    expect(intent.origin).toEqual({ kind: "text", text: "Cubao", span: [22, 27] });
    expect(intent.destination).toEqual({ kind: "text", text: "Buendia", span: [31, 38] });
  });

  it("uses core snake_case intent kinds for follow-ups", async () => {
    expect((await parser.parse("magkano pamasahe?", trip)).kind).toBe("ask_fare");
    expect((await parser.parse("saan ako bababa?", trip)).kind).toBe("ask_transfer");
    expect((await parser.parse("saan ako sasakay?", trip)).kind).toBe("ask_boarding");
    expect((await parser.parse("anong oras pa sila?", trip)).kind).toBe("ask_hours");
    expect((await parser.parse("may ibang ruta ba?", trip)).kind).toBe("alternatives");
    expect((await parser.parse("pabalik naman", trip)).kind).toBe("reverse");
    expect((await parser.parse("bagong biyahe", trip)).kind).toBe("new_trip");
  });

  it("uses core preference values, not cheapest/fastest", async () => {
    expect((await parser.parse("pinakamura", trip)).preference).toBe("lowest_fare");
    expect((await parser.parse("pinakamabilis", trip)).preference).toBe("shortest_reported_time");
    expect((await parser.parse("walang lipat", trip)).preference).toBe("fewest_transfers");
  });

  it("classifies chit-chat as unrelated so no model is burned", async () => {
    expect((await parser.parse("paano magluto ng adobo?", trip)).kind).toBe("unrelated");
    expect((await parser.parse("kumusta ka?", trip)).kind).toBe("unrelated");
  });

  it("reads an ordinal as a clarification answer when one is pending", async () => {
    const clarifying = {
      ...trip,
      pendingClarification: {
        slot: "destination" as const,
        text: "cubao",
        candidates: [
          { placeId: "plc_qc_farmers", name: "Cubao Farmers Plaza", area: "Quezon City", kind: "landmark" },
          { placeId: "plc_qc_ali", name: "Ali Mall", area: "Quezon City", kind: "landmark" },
        ],
      },
    };
    const intent = await parser.parse("2", clarifying);
    expect(intent.kind).toBe("clarify_answer");
    expect(intent.choiceIndex).toBe(1);
  });
});
