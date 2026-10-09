import { describe, expect, it } from "vitest";
import { osaDistance } from "../src/index";

describe("optimal string alignment distance", () => {
  it.each([
    ["", "", 0], ["", "abc", 3], ["abc", "", 3],
    ["plaza", "plaza", 0], ["plaza", "plza", 1],
    ["plaza", "plazza", 1], ["plaza", "plazo", 1],
    ["plaza", "palza", 1], ["kitten", "sitting", 3],
    ["ca", "abc", 3],
  ])("%s to %s is %i", (a, b, distance) => {
    expect(osaDistance(a, b)).toBe(distance);
    expect(osaDistance(b, a)).toBe(distance);
  });

  it("caps over-threshold results, including equal-length early exits", () => {
    expect(osaDistance("plaza", "market", 1)).toBe(2);
    expect(osaDistance("aaaaaa", "bbbbbb", 2)).toBe(3);
    expect(osaDistance("", "abcdef", 2)).toBe(3);
    expect(osaDistance("plaza", "palza", 1)).toBe(1);
    expect(osaDistance("plaza", "plaza", 0)).toBe(0);
  });

  it("bounded results agree with full OSA for short strings", () => {
    const strings = [""];
    let level = [""];
    for (let length = 1; length <= 4; length++) {
      level = level.flatMap((value) => [value + "a", value + "b"]);
      strings.push(...level);
    }
    for (const a of strings) for (const b of strings) {
      const full = osaDistance(a, b);
      for (const max of [0, 1, 2]) expect(osaDistance(a, b, max)).toBe(Math.min(full, max + 1));
    }
  });
});
