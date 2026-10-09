import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runEvaluation } from "./run.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("conversation evaluation harness", () => {
  it("passes the preliminary stub gates and labels the report honestly", async () => {
    await expect(runEvaluation()).resolves.toBe(true);
    if (process.env["PUSANG_GALA_EVAL_SUT"] === "real") return;

    const report = JSON.parse(
      readFileSync(
        join(HERE, "..", "results", "conversation-eval-report.json"),
        "utf8",
      ),
    ) as {
      preliminary: boolean;
      sut: string;
      gates: Record<string, boolean>;
    };
    expect(report.preliminary).toBe(true);
    expect(report.sut).toBe("stub-rules-v0");
    expect(Object.values(report.gates).every(Boolean)).toBe(true);
  });
});
