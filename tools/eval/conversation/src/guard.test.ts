import { describe, expect, it } from "vitest";

import { ExplanationUnitSchema } from "@pusang-gala/core";

import { parseUnit } from "./guard.ts";

describe("parseUnit", () => {
  it("accepts the core explanation-unit shape", () => {
    const candidate = {
      kind: "step",
      cardRef: "card-lg-bh-1",
      inserts: ["statement-1"],
      text: "Board at Bayan Terminal Bay 1.",
    };

    expect(ExplanationUnitSchema.safeParse(candidate).success).toBe(true);
    expect(parseUnit(JSON.stringify(candidate))).toEqual({
      ok: true,
      reason: "",
      unit: candidate,
    });
  });

  it("rejects legacy card_ref fields", () => {
    const result = parseUnit(
      JSON.stringify({
        kind: "step",
        card_ref: "card-lg-bh-1",
        text: "Board at Bayan Terminal Bay 1.",
      }),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects kinds outside the core schema", () => {
    expect(
      parseUnit(JSON.stringify({ kind: "failure", text: "Please retry." })).ok,
    ).toBe(false);
  });

  it("enforces the core 280-character text cap", () => {
    expect(
      parseUnit(JSON.stringify({ kind: "summary", text: "x".repeat(281) })).ok,
    ).toBe(false);
  });
});
