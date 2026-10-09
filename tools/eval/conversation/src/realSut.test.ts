import { describe, expect, it, vi } from "vitest";

import { RealSutUnavailableError, loadRealSut } from "./realSut.ts";
import type { DemoPack } from "./pack.ts";
import type { SystemUnderTest } from "./sut.ts";

const pack = { pack_id: "test-pack" } as DemoPack;

const sut: SystemUnderTest = {
  name: "real-test",
  async parse() {
    return { intent: "new_trip", behaviour: "route", slots: {} };
  },
  async respond() {
    return { behaviour: "route", cards: [], units: [], displayed_text: "" };
  },
  async guardStream() {
    return { accepted: [], rejected: [], displayed_text: "" };
  },
};

describe("loadRealSut", () => {
  it("wires the conversation factory to the AI module", async () => {
    const aiModule = { runtime: "local" };
    const createConversationEvalSut = vi.fn(async () => sut);
    const importer = vi.fn(async (name: string) =>
      name === "@pusang-gala/conversation"
        ? { createConversationEvalSut }
        : aiModule,
    );

    await expect(loadRealSut(pack, importer)).resolves.toBe(sut);
    expect(createConversationEvalSut).toHaveBeenCalledWith({ pack, aiModule });
  });

  it("reports unavailable packages as a skippable adapter error", async () => {
    const importer = vi.fn(async () => {
      throw new Error("module not found");
    });

    await expect(loadRealSut(pack, importer)).rejects.toEqual(
      expect.objectContaining<RealSutUnavailableError>({
        name: "RealSutUnavailableError",
        message: expect.stringContaining("@pusang-gala/conversation"),
      }),
    );
  });
});
