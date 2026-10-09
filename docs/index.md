---
spine_type: INDEX
spine_version: 0.3.0
project: Pusang Gala
slug: pusang-gala
doc_version: 0.3
status: Draft
owner: Salvador Vincent Javier
created: 2026-10-09
updated: 2026-10-09
reconciled: 2026-10-09
---

# Documentation Index: Pusang Gala

**Project slug:** `pusang-gala`
**Tier:** 2 (Application)
**Maintained by:** Salvador Vincent Javier

Built on SPINE 0.3.0

---

## 1. Document Suite

| Document | File | Version | Status | Updated | Reconciled |
|----------|------|---------|--------|---------|------------|
| IDEA · Idea Brief | [idea-pusang-gala.md](idea-pusang-gala.md) | 0.4 | Draft | 2026-10-09 | 2026-10-09 |
| BUILD · Build Guide | [build-pusang-gala.md](build-pusang-gala.md) | 0.4 | Draft | 2026-10-09 | 2026-10-09 |
| PRD · Product Requirements | [prd-pusang-gala.md](prd-pusang-gala.md) | 0.4 | Draft | 2026-10-09 | 2026-10-09 |
| SDD · System Design | [sdd-pusang-gala.md](sdd-pusang-gala.md) | 0.4 | Draft | 2026-10-09 | 2026-10-09 |
| QAD · QA & Test Plan | n/a | n/a | N/A (tier 2; acceptance lives in PRD §3.1 and SDD §9 spike gates; add at tier 3) | n/a | n/a |
| OPS · Ops & Observability | n/a | n/a | N/A (no server or deploy pipeline; the app is an offline-only APK) | n/a | n/a |
| LOG · Session Log | [log-pusang-gala.md](log-pusang-gala.md) | 0.4 | Draft | 2026-10-09 | 2026-10-09 |

**Materialized at repo root (not in `docs/`):** `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` (local SPINE pointers, gitignored per machine).

**Reference material (not SPINE docs, not authoritative):** `docs/reference/`. It holds the pre-SPINE proposal, the validation report, the system architecture, the competitor analysis, the connectivity evidence, and the earlier feasibility assessment (formerly the root `IDEA.md`). Treat it as evidence: where it conflicts with a SPINE doc, the SPINE doc wins.

### 1.1 RFCs

None

---

## 2. Change Log

| CR ID | Date | Summary | Trigger doc | Docs touched | File |
|-------|------|---------|-------------|--------------|------|
| none | | No CRs this session | | | |

---

## 3. Traceability Matrix

| PRD-F# | Feature | Priority | In SDD | In QAD | In RFC |
|--------|---------|----------|--------|--------|--------|
| PRD-F1 | Taglish question understanding | Must-Have | yes | N/A | N/A |
| PRD-F2 | Place resolution with clarification | Must-Have | yes | N/A | N/A |
| PRD-F3 | Verified offline routing | Must-Have | yes | N/A | N/A |
| PRD-F4 | Step cards with provenance | Must-Have | yes | N/A | N/A |
| PRD-F5 | Cat persona (text) | Must-Have | yes | N/A | N/A |
| PRD-F8 | Offline setup and readiness | Must-Have | yes | N/A | N/A |
| PRD-F9 | Honest failure states | Must-Have | yes | N/A | N/A |
| PRD-F10 | Corridor pack build tooling | Must-Have | yes | N/A | N/A |
| PRD-F12 | Schematic route view | Must-Have | yes | N/A | N/A |
| PRD-F15 | Saved routes and history (local) | Must-Have | yes | N/A | N/A |

QAD is N/A at tier 2, so the "In QAD" column is N/A rather than a gap.

### 3.1 Invariant Matrix

The negative tests are planned names; no code exists yet.

| INV-# | Rule | Status | Enforced in | Negative test |
|-------|------|--------|-------------|---------------|
| INV-1 | Never invent a route; only verified pack records are shown | Active | SDD §5.1 (router, validators, card composer, persona guard, pack builder) | `packages/core/src/route/inv1.neg.test.ts`: routes between unconnected stops, injects an unverified leg, feeds the persona guard a line with a fabricated fare or place |
| INV-2 | Never require network for the core experience | Active | SDD §5.1 (network guard, import boundary) | `apps/mobile/src/net/inv2.neg.test.ts` (fetch from the core throws; an ESLint fixture importing Firebase from the core fails), plus an on-device airplane-mode run of every Must-Have feature |
| INV-3 | Never send location, queries or trips off-device without opt-in | Active | SDD §5.1 (opt-in gate, schema test, dependency allowlist) | `apps/mobile/src/account/inv3.neg.test.ts`: signed in with sync off, asserts zero writes; a schema test asserts no query-text or coordinate fields; a CI dependency-ban check |
| INV-4 | Never ship or commit Reddit text or usernames | Active | SDD §5.1 (pack builder scan, .gitignore, CI scan) | `tools/pack-builder/inv4.neg.test.ts`: seeds a note copied from a fixture comment, and a `u/` username |
| INV-5 | Never present stale or unverified data, or an old GPS fix, as current | Active | SDD §5.1 (staleness labeller, router status filter) | `packages/core/src/validate/inv5.neg.test.ts`: renders a leg older than `stale_after_days`, an old fare rule and an old fix; asserts the stale labels |
| INV-6 | Never silently pick among ambiguous places | Active | SDD §5.1 (place resolver, PLACE_AMBIGUITY) | `packages/core/src/resolve/inv6.neg.test.ts`: resolves "sm" and "gateway" and near-tie typos; asserts NeedsClarification |
| INV-7 | Never put route facts in model weights | Active | SDD §5.1 (fine-tune data generator check) | `tools/finetune/inv7.neg.test.ts`: injects a real stop name or signboard into the training set; asserts the CI check fails |

---

## 4. Incident Log

| PM ID | Date | Severity | Summary | Actions closed | File |
|-------|------|----------|---------|----------------|------|
| none | | | | | |

---

## 5. Health Check

- [x] Every `Locked` doc's `reconciled` date is newer than the last code change in its area (no Locked docs, no code)
- [x] No doc has sat in `Draft` past its expected movement date (all created 2026-10-09)
- [x] Every open change record has propagated downstream (no CRs)
- [x] Every feature ID referenced by SDD, RFC, or QAD still exists in the PRD
- [x] §3 Traceability Matrix covers every Must-Have
- [x] §3.1 Invariant Matrix: every `Active` invariant has a designed enforcement point and a named negative test (the tests are not written yet)
- [x] Validator green (`python $SPINE_HOME/scripts/check.py docs/`)
- [x] Latest checkpoint verifies clean (no checkpoints yet)
- [x] No secrets committed in `docs/`

---

## 6. Notes

- Everything is `Draft`. The remaining open questions are in LOG §2.
- Implementation is blocked until lock, except the SDD §9 device spikes if the owner authorizes them.
- Versions in BUILD §2 were verified against registries on 2026-10-09. No device benchmark has been run.
