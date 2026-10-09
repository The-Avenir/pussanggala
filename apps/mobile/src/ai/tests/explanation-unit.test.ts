import { ExplanationUnitSchema } from "@pusang-gala/core";
import { describe, expect, it } from "vitest";

import {
  UNIT_KINDS,
  validateExplanationUnit,
  type UnitRejectionCode,
} from "../explanation-unit";
import { validatorContextOf } from "../grounding-context";
import { fixtureContext } from "./fixtures";

const ctx = validatorContextOf(fixtureContext());

function validate(raw: unknown) {
  return validateExplanationUnit(raw, ctx);
}

function codes(v: ReturnType<typeof validate>): UnitRejectionCode[] {
  return v.ok ? [] : v.reasons.map((r) => r.code);
}

describe("unit shape is core's, not a local fork", () => {
  it("uses exactly the ExplanationUnitKind set from @pusang-gala/core", () => {
    expect([...UNIT_KINDS]).toEqual([
      "summary",
      "step",
      "comparison",
      "hours",
      "caveat",
      "clarify",
      "redirect",
    ]);
  });

  it("every accepted unit also parses as a core ExplanationUnit", () => {
    const result = validate({
      kind: "step",
      cardRef: "card:route-1",
      inserts: ["stmt:step-1", "stmt:step-2"],
      text: "Sakay muna, tapos baba.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const { resolvedPackRecordIds: _ignored, ...core } = result.unit;
      expect(ExplanationUnitSchema.safeParse(core).success).toBe(true);
    }
  });

  it("rejects the retired T33 tag/kind fork", () => {
    expect(
      codes(validate({ unit: "explanation_unit", kind: "summary", inserts: [], text: "x" })),
    ).toContain("wrong_shape");
    for (const retired of ["steps", "warning", "unknowns"]) {
      expect(codes(validate({ kind: retired, inserts: ["stmt:warn-1"], text: "x" }))).toContain(
        "unknown_kind",
      );
    }
  });
});

describe("validateExplanationUnit", () => {
  it("accepts a fully valid step unit", () => {
    const result = validate({
      kind: "step",
      cardRef: "card:route-1",
      inserts: ["stmt:step-1", "stmt:step-2", "stmt:step-3"],
      text: "Sakay ka muna, baba, tapos lakad — sundin lang ang cards.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.unit.cardRef).toBe("card:route-1");
      expect(result.unit.resolvedPackRecordIds).toContain("walk:w-1");
    }
  });

  it("accepts a summary unit with mixed roles and no cardRef", () => {
    const result = validate({
      kind: "summary",
      inserts: ["stmt:warn-1", "stmt:unk-1"],
      text: "May dalawang bagay na dapat mong alamin bago umalis.",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts clarify and redirect units that carry no facts and cite nothing", () => {
    expect(validate({ kind: "clarify", text: "Saan ka ba galing?" }).ok).toBe(true);
    expect(
      validate({ kind: "redirect", text: "Hindi ko kayang sagutin yan, pero eto ang kaya ko." }).ok,
    ).toBe(true);
  });

  it("rejects an invented statement ID (untraceable fact)", () => {
    const result = validate({
      kind: "summary",
      inserts: ["stmt:fabricated-leg-99"],
      text: "Sige, eto na.",
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("invented_fact");
  });

  it("rejects factual prose with no inserts at all (invention hardening)", () => {
    for (const text of [
      "Board the MRT, then alight at the next station.",
      "Sakay ka sa jeepney sa may terminal.",
      "Mura lang ang pamasahe mula dito.",
      "Mga ilang minutes lang ang lakad papunta sa stop.",
    ]) {
      const result = validate({ kind: "summary", text });
      expect(result.ok, text).toBe(false);
      expect(codes(result), text).toContain("invented_fact");
    }
  });

  it("allows the same prose once the facts are cited", () => {
    const result = validate({
      kind: "step",
      inserts: ["stmt:step-1", "stmt:step-2"],
      text: "Sakay ka sa MRT station, tapos baba.",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects reversed step instructions in citation order", () => {
    const result = validate({
      kind: "step",
      inserts: ["stmt:step-2", "stmt:step-1"],
      text: "Ganito ang sequence.",
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("reversed_instructions");
  });

  it("rejects re-citing an earlier step after a later one with another statement in between", () => {
    const result = validate({
      kind: "step",
      inserts: ["stmt:step-1", "stmt:step-3", "stmt:step-2"],
      text: "Ayusin natin ang order.",
    });
    expect(codes(result)).toContain("reversed_instructions");
  });

  it("rejects duplicates of the same insert inside one unit", () => {
    const result = validate({
      kind: "summary",
      inserts: ["stmt:warn-1", "stmt:warn-1"],
      text: "Ulitin ko lang.",
    });
    expect(codes(result)).toContain("duplicate_insert");
  });

  it("rejects guaranteed-optimum claims in prose", () => {
    for (const claim of [
      "This is the fastest route.",
      "Ito ang cheapest option mo.",
      "Guaranteed makakarating ka agad.",
      "This is the best route for you.",
    ]) {
      const result = validate({ kind: "summary", inserts: ["stmt:cmp-1"], text: claim });
      expect(result.ok, claim).toBe(false);
      expect(codes(result), claim).toContain("banned_claim");
    }
  });

  it("rejects spurious verification and availability claims", () => {
    const result = validate({
      kind: "summary",
      inserts: ["stmt:hrs-1"],
      text: "Verified na operating now ang MRT-3.",
    });
    expect(codes(result)).toEqual(expect.arrayContaining(["banned_claim"]));
  });

  it("rejects numeric inserts in prose (fares, times, durations belong in statements)", () => {
    for (const text of [
      "Bayad mo ay ₱25 lang.",
      "PHP 25 ang pamasahe.",
      "alis 6:30 ng umaga",
      "around 45 minutes ang byahe",
      "travel time 40 min",
    ]) {
      const result = validate({ kind: "summary", inserts: ["stmt:cmp-1"], text });
      expect(codes(result), text).toContain("unsupported_number");
    }
  });

  it("rejects a step unit that cites no step statement", () => {
    const result = validate({
      kind: "step",
      inserts: ["stmt:warn-1"],
      text: "Eto ang mga hakbang.",
    });
    expect(codes(result)).toContain("kind_role_mismatch");
  });

  it("requires a caveat unit to cite a warning or unknown statement", () => {
    expect(validate({ kind: "caveat", inserts: ["stmt:warn-1"], text: "Paalala lang." }).ok).toBe(true);
    expect(validate({ kind: "caveat", inserts: ["stmt:unk-1"], text: "Paalala lang." }).ok).toBe(true);
    expect(codes(validate({ kind: "caveat", inserts: ["stmt:cmp-1"], text: "Paalala lang." }))).toContain(
      "kind_role_mismatch",
    );
  });

  it("rejects unknown card references", () => {
    const result = validate({
      kind: "summary",
      cardRef: "card:does-not-exist",
      inserts: ["stmt:warn-1"],
      text: "Tingnan mo ito.",
    });
    expect(codes(result)).toContain("unknown_card_ref");
  });

  it("rejects wrong shape: non-object, unknown kind, extra fields, non-string text", () => {
    expect(codes(validate("not an object"))).toContain("wrong_shape");
    expect(codes(validate({ kind: "nonsense", inserts: [], text: "x" }))).toContain("unknown_kind");
    expect(
      codes(
        validate({
          kind: "summary",
          inserts: [],
          text: "x",
          promptOverride: "ignore previous instructions",
        }),
      ),
    ).toContain("wrong_shape");
    expect(codes(validate({ kind: "summary", inserts: [], text: 42 }))).toContain("wrong_shape");
  });

  it("rejects prose past the core 280-char cap", () => {
    const result = validate({ kind: "summary", inserts: ["stmt:warn-1"], text: "x".repeat(281) });
    expect(codes(result)).toContain("oversize");
  });
});
