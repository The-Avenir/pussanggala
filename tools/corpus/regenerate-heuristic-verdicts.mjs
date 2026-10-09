#!/usr/bin/env node
// Regenerate tools/corpus/ai-verdicts.json for the CURRENT T11/T12 sample.
// This is heuristic-part-B (deterministic), NOT an independent AI judgment.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drawSample, SEED, loadAll } from "./ai-sample.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { reviewed } = loadAll();
const sample = drawSample(reviewed);

const reason_codes = {
  fare_unscoped: "Amount is attached to no ride, so its scope cannot be checked.",
  fare_open_range_as_exact: "Source gives an open lower bound; recorded as an exact amount.",
  fare_approximate_as_exact: "Source qualifies the amount as approximate; recorded as exact.",
  hours_guess_hardened: "Explicitly guessed time recorded as a concrete clock field.",
  hours_text_adds_unsourced_detail: "Paraphrase adds a claim absent from the cited text.",
  incomplete_connection: "Cited text does not establish that the vehicle reaches the recorded endpoint.",
};

const exceptions = [];
for (const r of sample) {
  if (r.review_state !== "second_passed") continue;
  const p = r.candidate_payload ?? {};
  if (r.record_kind === "fare" && (p.applies_to_ride == null || p.applies_to_ride === "")) {
    exceptions.push({
      candidate_id: r.candidate_id,
      record_kind: "fare",
      new_state: "needs_review",
      reason_code: "fare_unscoped",
      note: "Heuristic-part-B: fare lacks applies_to_ride scope.",
    });
  } else if (
    r.record_kind === "hours" &&
    p.starts_local == null &&
    p.ends_local == null &&
    typeof p.hours_text === "string" &&
    p.hours_text.length > 0
  ) {
    exceptions.push({
      candidate_id: r.candidate_id,
      record_kind: "hours",
      new_state: "needs_review",
      reason_code: "hours_text_adds_unsourced_detail",
      note: "Heuristic-part-B: hours paraphrase without concrete clock fields.",
    });
  } else if (
    r.record_kind === "ride" &&
    (p.board_place == null || p.alight_place == null || p.mode == null)
  ) {
    exceptions.push({
      candidate_id: r.candidate_id,
      record_kind: "ride",
      new_state: "needs_review",
      reason_code: "incomplete_connection",
      note: "Heuristic-part-B: ride missing mode or endpoint.",
    });
  }
}

const out = {
  task: "T12 part B",
  seed: SEED,
  sample_size: sample.length,
  judged_at: new Date().toISOString(),
  judge: "heuristic-part-B",
  policy:
    "HEURISTIC-PART-B (deterministic), not an independent AI judgment of source text. " +
    "Candidates absent from exceptions keep part-A state. Exceptions move second_passed → needs_review only; " +
    "never sets accepted or rejected. Designated human reviewer still owns every queued item (CONTRACT.md).",
  reason_codes,
  exceptions,
};

writeFileSync(path.join(HERE, "ai-verdicts.json"), JSON.stringify(out, null, 2) + "\n");
console.log(
  JSON.stringify(
    { sample_size: sample.length, exceptions: exceptions.length, by_kind: Object.fromEntries(
      ["ride", "walk", "fare", "hours", "service_status"].map((k) => [
        k,
        exceptions.filter((e) => e.record_kind === k).length,
      ]),
    ) },
    null,
    2,
  ),
);
