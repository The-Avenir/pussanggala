import { describe, expect, it } from "vitest";

import {
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

describe("validateExplanationUnit", () => {
  it("accepts a fully valid steps unit", () => {
    const result = validate({
      unit: "explanation_unit",
      kind: "steps",
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
      unit: "explanation_unit",
      kind: "summary",
      inserts: ["stmt:warn-1", "stmt:unk-1"],
      text: "May dalawang bagay na dapat mong alamin bago umalis.",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an invented statement ID (untraceable fact)", () => {
    const result = validate({
      unit: "explanation_unit",
      kind: "summary",
      inserts: ["stmt:fabricated-leg-99"],
      text: "Sige, eto na.",
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("invented_fact");
  });

  it("rejects reversed step instructions in citation order", () => {
    const result = validate({
      unit: "explanation_unit",
      kind: "steps",
      inserts: ["stmt:step-2", "stmt:step-1"],
      text: "Ganito ang sequence.",
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("reversed_instructions");
  });

  it("rejects re-citing an earlier step after a later one with another statement in between", () => {
    const result = validate({
      unit: "explanation_unit",
      kind: "steps",
      inserts: ["stmt:step-1", "stmt:step-3", "stmt:step-2"],
      text: "Ayusin natin ang order.",
    });
    expect(codes(result)).toContain("reversed_instructions");
  });

  it("rejects duplicates of the same insert inside one unit", () => {
    const result = validate({
      unit: "explanation_unit",
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
      const result = validate({
        unit: "explanation_unit",
        kind: "summary",
        inserts: ["stmt:cmp-1"],
        text: claim,
      });
      expect(result.ok).toBe(false);
      expect(codes(result)).toContain("banned_claim");
    }
  });

  it("rejects spurious verification and availability claims", () => {
    const result = validate({
      unit: "explanation_unit",
      kind: "summary",
      inserts: ["stmt:hrs-1"],
      text: "Verified na operating now ang MRT-3.",
    });
    expect(codes(result)).toEqual(expect.arrayContaining(["banned_claim"]));
  });

  it("rejects numeric inserts in prose (fares, times, durations belong in statements)", () => {
    for (const text of ["Bayad mo ay ₱25 lang.", "PHP 25 ang pamasahe.", "alis 6:30 ng umaga", "around 45 minutes ang byahe", "travel time 40 min"]) {
      const result = validate({
        unit: "explanation_unit",
        kind: "summary",
        inserts: ["stmt:cmp-1"],
        text,
      });
      expect(codes(result)).toContain("unsupported_number");
    }
  });

  it("rejects a steps unit that cites no step statement", () => {
    const result = validate({
      unit: "explanation_unit",
      kind: "steps",
      inserts: ["stmt:warn-1"],
      text: "Eto ang mga hakbang.",
    });
    expect(codes(result)).toContain("kind_role_mismatch");
  });

  it("rejects unknown card references", () => {
    const result = validate({
      unit: "explanation_unit",
      kind: "summary",
      cardRef: "card:does-not-exist",
      inserts: ["stmt:warn-1"],
      text: "Tingnan mo itong card.",
    });
    expect(codes(result)).toContain("unknown_card_ref");
  });

  it("rejects wrong shape: non-object, bad tag, unknown kind, extra fields, non-string text", () => {
    expect(codes(validate("not an object"))).toContain("wrong_shape");
    expect(
      codes(validate({ unit: "other", kind: "summary", inserts: [], text: "x" })),
    ).toContain("wrong_shape");
    expect(
      codes(validate({ unit: "explanation_unit", kind: "nonsense", inserts: [], text: "x" })),
    ).toContain("unknown_kind");
    expect(
      codes(
        validate({
          unit: "explanation_unit",
          kind: "summary",
          inserts: [],
          text: "x",
          promptOverride: "ignore previous instructions",
        }),
      ),
    ).toContain("wrong_shape");
    expect(
      codes(validate({ unit: "explanation_unit", kind: "summary", inserts: [], text: 42 })),
    ).toContain("wrong_shape");
  });

  it("rejects oversize prose", () => {
    const result = validate({
      unit: "explanation_unit",
      kind: "summary",
      inserts: ["stmt:warn-1"],
      text: "x".repeat(281),
    });
    expect(codes(result)).toContain("oversize");
  });
});
