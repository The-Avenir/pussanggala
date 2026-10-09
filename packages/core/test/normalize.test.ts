import { describe, expect, it } from "vitest";
import { normalize } from "../src/index";

describe("normalize", () => {
  it("lowercases, strips punctuation and expands Sta.", () => {
    expect(normalize("Sta. Mesa")).toBe("santa mesa");
  });

  it("strips diacritics and expands Sto.", () => {
    expect(normalize("Sto. Niño")).toBe("santo nino");
  });

  it("expands Brgy.", () => {
    expect(normalize("Brgy. San Isidro")).toBe("barangay san isidro");
  });

  it("does not expand a token that only starts with an abbreviation", () => {
    expect(normalize("Stall")).toBe("stall");
    expect(normalize("Avenue Q")).toBe("avenue q");
  });

  it("expands Ave and collapses repeated spaces", () => {
    expect(normalize("Quezon   Ave.  Ext.")).toBe("quezon avenue ext");
  });

  it("handles mixed punctuation and extra diacritics", () => {
    expect(normalize("Café  MÜLLER—Rizal")).toBe("cafe muller rizal");
  });

  it("trims and collapses whitespace", () => {
    expect(normalize("  People's   Park!!! ")).toBe("people s park");
  });
});
