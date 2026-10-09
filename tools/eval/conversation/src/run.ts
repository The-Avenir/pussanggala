/**
 * T35 evaluation runner: conversation + grounding quality harness.
 *
 * Usage (from the repo root):
 *   node tools/eval/conversation/src/run.ts
 *   node tools/eval/conversation/src/run.ts --json   # machine-readable only
 *
 * Exit code 0 = all gates pass; 1 = corpus invalid, harness self-check failed
 * or a gate failed. See EVALUATION-NOTES.md for the full contract.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadJson, buildBundle } from "./pack.ts";
import type { DemoPack, TripState } from "./pack.ts";
import { validateCorpora } from "./schema.ts";
import type { AdversarialCase, IntentCase } from "./schema.ts";
import { detectUnsupportedClaims, guardStream } from "./guard.ts";
import { StubRulesSut } from "./stubSut.ts";
import type { SystemUnderTest } from "./sut.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures");
const RESULTS = join(HERE, "..", "results");
const REPORT_PATH = join(RESULTS, "conversation-eval-report.json");

const pack = loadJson<DemoPack>(join(FIXTURES, "demo-pack.json"));
const intentCorpus = loadJson<{ cases: IntentCase[] }>(join(FIXTURES, "intent-cases.json"));
const adversarialCorpus = loadJson<{ cases: AdversarialCase[] }>(
  join(FIXTURES, "adversarial-cases.json"),
);

const m1Gate = 0.9;

function trip(ref: string): TripState {
  const t = pack.trip_states[ref];
  if (!t) throw new Error(`unknown trip state ${ref}`);
  return t;
}

function stats(values: number[]): { n: number; mean: number; p50: number; p95: number; max: number } {
  if (values.length === 0) return { n: 0, mean: 0, p50: 0, p95: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    n: sorted.length,
    mean: Number((sum / sorted.length).toFixed(3)),
    p50: Number(pick(0.5).toFixed(3)),
    p95: Number(pick(0.95).toFixed(3)),
    max: Number(sorted[sorted.length - 1]!.toFixed(3)),
  };
}

async function timed<T>(ms: number[], fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    ms.push(performance.now() - t0);
  }
}

interface Failure {
  case_id: string;
  reason: string;
  detail?: string;
}

function checkTextAssertions(
  c: AdversarialCase,
  displayed: string,
  failures: Failure[],
): void {
  const lower = displayed.toLowerCase();
  for (const want of c.expected.must_contain ?? []) {
    if (!lower.includes(want.toLowerCase()))
      failures.push({ case_id: c.id, reason: "must_contain", detail: `missing '${want}'` });
  }
  for (const ban of c.expected.must_not_contain ?? []) {
    if (lower.includes(ban.toLowerCase()))
      failures.push({ case_id: c.id, reason: "must_not_contain", detail: `found '${ban}'` });
  }
  for (const pattern of c.expected.must_not_regex ?? []) {
    const re = new RegExp(pattern, "i");
    if (re.test(displayed))
      failures.push({ case_id: c.id, reason: "must_not_regex", detail: `matched /${pattern}/` });
  }
  if (c.expected.must_order) {
    let cursor = 0;
    for (const piece of c.expected.must_order) {
      const at = lower.indexOf(piece.toLowerCase(), cursor);
      if (at < 0) {
        failures.push({ case_id: c.id, reason: "must_order", detail: `'${piece}' missing/out of order` });
        break;
      }
      cursor = at + piece.length;
    }
  }
}

async function main(): Promise<void> {
  const jsonOnly = process.argv.includes("--json");
  const failures: Failure[] = [];
  const parseMs: number[] = [];
  const respondMs: number[] = [];
  const streamMs: number[] = [];

  // ---------- 1) corpus validation ----------
  const corpus = validateCorpora(
    intentCorpus.cases,
    adversarialCorpus.cases,
    Object.keys(pack.trip_states),
  );
  for (const e of corpus.errors) failures.push({ case_id: "CORPUS", reason: "corpus_invalid", detail: e });

  // ---------- 2) harness self-checks (the guard must catch planted violations) ----------
  const selfCheckFailures: string[] = [];
  {
    const bhTrip = trip("ts-bh");
    const legs = (bhTrip.selected_leg_ids ?? [])
      .map((id) => pack.legs.find((l) => l.leg_id === id))
      .filter((l) => l !== undefined)
      .map((l) => l!);
    const bundle = buildBundle(pack, legs);
    const planted = guardStream(
      [
        "{\"kind\":\"summary\",\"text\":\"The fare is ₱99 and the trip is verified.\"}",
        "{\"kind\":\"summary\",\"text\":\"Direct jeepney; reported fare ₱13 (2025-08-14).\"}",
      ],
      bundle,
    );
    if (planted.accepted.length !== 1 || planted.rejected.length !== 1)
      selfCheckFailures.push("guard failed to reject a planted fabricated-fare unit");
    if (detectUnsupportedClaims("Alight at Bayan Terminal Bay 1 then board the jeep.", bundle).length === 0)
      selfCheckFailures.push("detector failed to catch a planted reversed instruction");
    const hrLegs = (trip("ts-hr").selected_leg_ids ?? [])
      .map((id) => pack.legs.find((l) => l.leg_id === id))
      .map((l) => l!);
    const hrBundle = buildBundle(pack, hrLegs);
    if (detectUnsupportedClaims("The UV Express fare is ₱40.", hrBundle).length === 0)
      selfCheckFailures.push("detector failed to catch a planted conflict-hiding claim");
    if (detectUnsupportedClaims("Direct ride; reported fare ₱13 (2025-08-14).", bundle).length !== 0)
      selfCheckFailures.push("detector falsely flagged a supported sentence");
  }
  for (const f of selfCheckFailures) failures.push({ case_id: "SELF-CHECK", reason: "harness_self_check", detail: f });

  // ---------- 3) SUT wiring ----------
  const sut: SystemUnderTest = new StubRulesSut(pack);

  // ---------- 4) intent suite ----------
  let intentCorrect = 0;
  let behaviourCorrect = 0;
  const requiredSlotTotal = { all: 0, held_out: 0 };
  const requiredSlotCorrect = { all: 0, held_out: 0 };
  const bySplit: Record<string, { n: number; intent: number; behaviour: number }> = {};
  for (const c of intentCorpus.cases) {
    bySplit[c.split] ??= { n: 0, intent: 0, behaviour: 0 };
    bySplit[c.split]!.n += 1;
    const parsed = await timed(parseMs, () => sut.parse(c.query, trip(c.trip_state)));
    const responded = await timed(respondMs, () => sut.respond(c.query, trip(c.trip_state)));
    const intentOk = parsed.intent === c.expected.intent;
    const behaviourOk = responded.behaviour === c.expected.behaviour;
    if (intentOk) {
      intentCorrect += 1;
      bySplit[c.split]!.intent += 1;
    } else {
      failures.push({ case_id: c.id, reason: "intent", detail: `expected ${c.expected.intent}, got ${parsed.intent}` });
    }
    if (behaviourOk) {
      behaviourCorrect += 1;
      bySplit[c.split]!.behaviour += 1;
    } else {
      failures.push({ case_id: c.id, reason: "behaviour", detail: `expected ${c.expected.behaviour}, got ${responded.behaviour}` });
    }
    // M1: exact required-slot accuracy (only cases that declare required slots)
    if (c.expected.required_slots.length > 0) {
      requiredSlotTotal.all += 1;
      if (c.split === "held_out") requiredSlotTotal.held_out += 1;
      const slotsOk = c.expected.required_slots.every(
        (k) => (parsed.slots[k] ?? "") === c.expected.slots[k],
      );
      if (slotsOk) {
        requiredSlotCorrect.all += 1;
        if (c.split === "held_out") requiredSlotCorrect.held_out += 1;
      } else {
        failures.push({
          case_id: c.id,
          reason: "required_slots",
          detail: `expected ${JSON.stringify(c.expected.slots)}, got ${JSON.stringify(parsed.slots)}`,
        });
      }
    }
    // M3 applies everywhere: no unsupported claim may be displayed
    const claims = detectUnsupportedClaims(responded.displayed_text, {
      pack_id: pack.pack_id,
      cards: responded.cards,
    });
    if (claims.length > 0)
      failures.push({ case_id: c.id, reason: "unsupported_claim", detail: claims.join("; ") });
  }

  // ---------- 5) adversarial suite ----------
  const byCategory: Record<string, { n: number; pass: number }> = {};
  for (const c of adversarialCorpus.cases) {
    byCategory[c.category] ??= { n: 0, pass: 0 };
    byCategory[c.category]!.n += 1;
    const before = failures.length;
    if (c.mode === "stream") {
      const out = await timed(streamMs, () => sut.guardStream(c.raw_units ?? [], trip(c.trip_state)));
      const expectedAccepted = c.expected.accepted_indexes ?? [];
      const actualAccepted = out.accepted.map((a) => a.index).sort((x, y) => x - y);
      const same =
        actualAccepted.length === expectedAccepted.length &&
        actualAccepted.every((v, i) => v === [...expectedAccepted].sort((x, y) => x - y)[i]);
      if (!same)
        failures.push({
          case_id: c.id,
          reason: "stream_acceptance",
          detail: `expected accepted [${expectedAccepted.join(",")}], got [${actualAccepted.join(",")}]; rejected: ${out.rejected.map((r) => `#${r.index} ${r.reason}`).join(" | ")}`,
        });
      checkTextAssertions(c, out.displayed_text, failures);
    } else {
      const out = await timed(respondMs, () => sut.respond(c.query ?? "", trip(c.trip_state)));
      if (out.behaviour !== c.expected.behaviour)
        failures.push({
          case_id: c.id,
          reason: "behaviour",
          detail: `expected ${c.expected.behaviour}, got ${out.behaviour}`,
        });
      checkTextAssertions(c, out.displayed_text, failures);
    }
    if (failures.length === before) byCategory[c.category]!.pass += 1;
  }

  // ---------- 6) metrics + gates ----------
  const m1HeldOut =
    requiredSlotTotal.held_out === 0
      ? null
      : requiredSlotCorrect.held_out / requiredSlotTotal.held_out;
  const adversarialFailed = adversarialCorpus.cases.filter((c) =>
    failures.some((f) => f.case_id === c.id),
  ).length;
  const unsupportedDisplayed = failures.filter((f) => f.reason === "unsupported_claim" || f.reason === "must_not_contain" || f.reason === "must_not_regex").length;
  const gates = {
    corpus_valid: corpus.errors.length === 0,
    harness_self_check: selfCheckFailures.length === 0,
    m1_held_out_required_slot_accuracy_gte_90pct: m1HeldOut !== null && m1HeldOut >= m1Gate,
    m3_zero_unsupported_claims_displayed: unsupportedDisplayed === 0,
    adversarial_suite_all_pass: adversarialFailed === 0,
  };
  const passed = Object.values(gates).every(Boolean);

  const report = {
    generated_at: new Date().toISOString(),
    preliminary: true,
    preliminary_reason:
      "SUT is the deterministic stub (stub-rules-v0). Scores validate the harness and floor the acceptance gates; model-backed numbers await T32/T33/T34 integration (see EVALUATION-NOTES.md). Latency is host-side harness timing only - device M1/M4/M5 evidence is NOT recorded here.",
    sut: sut.name,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    corpus: corpus.stats,
    intent_suite: {
      cases: intentCorpus.cases.length,
      intent_accuracy: intentCorrect / intentCorpus.cases.length,
      behaviour_accuracy: behaviourCorrect / intentCorpus.cases.length,
      by_split: bySplit,
      m1_required_slot_accuracy: {
        all: requiredSlotTotal.all === 0 ? null : requiredSlotCorrect.all / requiredSlotTotal.all,
        held_out: m1HeldOut,
        held_out_cases_scored: requiredSlotTotal.held_out,
        gate: `>= ${m1Gate}`,
      },
    },
    adversarial_suite: {
      cases: adversarialCorpus.cases.length,
      passed: adversarialCorpus.cases.length - adversarialFailed,
      failed: adversarialFailed,
      unsupported_claims_displayed: unsupportedDisplayed,
      by_category: byCategory,
    },
    latency_ms: {
      parse: stats(parseMs),
      respond: stats(respondMs),
      guard_stream: stats(streamMs),
    },
    gates,
    failures,
  };

  mkdirSync(RESULTS, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

  if (!jsonOnly) {
    const line = "-".repeat(72);
    console.log(line);
    console.log("T35 conversation/grounding evaluation — PRELIMINARY (stub SUT)");
    console.log(line);
    console.log(
      `corpus: ${corpus.stats.intent_total} intent (${corpus.stats.intent_train} train / ${corpus.stats.intent_held_out} held-out) + ${corpus.stats.adversarial_total} adversarial cases`,
    );
    for (const w of corpus.warnings) console.log(`  note: ${w}`);
    console.log(
      `intent: accuracy ${(report.intent_suite.intent_accuracy * 100).toFixed(1)}% | behaviour ${(report.intent_suite.behaviour_accuracy * 100).toFixed(1)}% | M1 held-out ${m1HeldOut === null ? "n/a" : (m1HeldOut * 100).toFixed(1) + "%"} (gate >=90%)`,
    );
    console.log(
      `adversarial: ${report.adversarial_suite.passed}/${report.adversarial_suite.cases} pass | unsupported claims displayed: ${unsupportedDisplayed} (gate = 0)`,
    );
    for (const [cat, s] of Object.entries(byCategory)) {
      console.log(`  ${cat.padEnd(32)} ${s.pass}/${s.n}`);
    }
    console.log(
      `latency (host, ms): parse p50 ${report.latency_ms.parse.p50} / respond p50 ${report.latency_ms.respond.p50} p95 ${report.latency_ms.respond.p95} / stream p50 ${report.latency_ms.guard_stream.p50}`,
    );
    console.log(line);
    for (const [gate, ok] of Object.entries(gates)) {
      console.log(`${ok ? "PASS" : "FAIL"}  ${gate}`);
    }
    if (failures.length > 0) {
      console.log(line);
      console.log(`failures (${failures.length}):`);
      for (const f of failures.slice(0, 40)) {
        console.log(`  ${f.case_id} [${f.reason}] ${f.detail ?? ""}`);
      }
      if (failures.length > 40) console.log(`  ...and ${failures.length - 40} more (see report)`);
    }
    console.log(`report written to ${REPORT_PATH}`);
  } else {
    console.log(JSON.stringify(report));
  }

  process.exit(passed ? 0 : 1);
}

await main();
