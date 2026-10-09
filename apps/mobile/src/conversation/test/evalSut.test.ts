import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createConversationEvalSut, validateEvalUnitForTrip } from "../src/evalSut";
import type { DemoPack, TripState } from "../src/evalHarness/pack";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const pack = JSON.parse(
  readFileSync(
    join(REPO_ROOT, "tools", "eval", "conversation", "fixtures", "demo-pack.json"),
    "utf8",
  ),
) as DemoPack;

const trip = pack.trip_states["ts-bh"] as TripState;

describe("createConversationEvalSut", () => {
  it("returns a SUT and guardStream rejects invented fare / accepts grounded unit", async () => {
    const sut = createConversationEvalSut({ pack, aiModule: {} });
    expect(sut).toMatchObject({
      name: "conversation-ai-bridge-v0",
    });
    expect(typeof sut.parse).toBe("function");
    expect(typeof sut.respond).toBe("function");
    expect(typeof sut.guardStream).toBe("function");

    const out = await sut.guardStream(
      [
        '{"kind":"summary","text":"The fare is ₱99 and the trip is verified."}',
        '{"kind":"summary","text":"Direct jeepney; reported fare ₱13 (2025-08-14)."}',
      ],
      trip,
    );
    expect(out.accepted).toHaveLength(1);
    expect(out.rejected).toHaveLength(1);

    const valid = {
      kind: "summary" as const,
      text: "Direct jeepney; reported fare ₱13 (2025-08-14).",
    };
    expect(validateEvalUnitForTrip(valid, pack, trip)).toBe(true);
  });
});
