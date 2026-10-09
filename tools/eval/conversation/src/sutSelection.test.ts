import { describe, expect, it } from "vitest";

import { resolveSutMode } from "./sutSelection.ts";

describe("resolveSutMode", () => {
  it("defaults to the stub", () => {
    expect(resolveSutMode([], {})).toBe("stub");
  });

  it("accepts CLI and environment real-SUT selection", () => {
    expect(resolveSutMode(["--sut=real"], {})).toBe("real");
    expect(resolveSutMode([], { PUSANG_GALA_EVAL_SUT: "real" })).toBe("real");
  });

  it("rejects unsupported SUT names", () => {
    expect(() => resolveSutMode(["--sut=cloud"], {})).toThrow(
      "--sut must be stub or real",
    );
  });
});
