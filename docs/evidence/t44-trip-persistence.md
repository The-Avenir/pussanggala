# T44 — saved, history and active-trip persistence

Task lead: T44 Orca worker in the independent `t44-trip-persistence` checkout.
Branch: `feat/t44-trip-persistence`. Evidence date: 2026-10-10 (Asia/Shanghai).
Base: `ae42517be873d181e2f7ceb4c6e43d995bcc97fb`, fetched current `origin/main`
before implementation and fast-forward checked in this checkout. Draft PR:
[#22](https://github.com/The-Avenir/pussanggala/pull/22). Implementation commit:
`ce7d0fd4b6a41efdd58a5d89be8d13476fbf9344`; task-only evidence/status follow-up
records the final check rerun and PR link. No merge, main push or force-push.

Status: host implementation and validation complete; draft review, T41/T45 native
wiring and actual Android/device/data gates remain open. T44 is not marked Done.

## Contract and ownership evidence

Read INDEX, contracts v1, current PRD/SDD/BUILD and TODO §2/§6/§7 before work.
No applicable AGENTS.md was found in this checkout or its ancestor directories.
Several status statements claiming no implementation exist are stale: main already
contains T20–T25 core schemas, routing and restoration, the Expo harness, and the
synthetic mobile store. Code/shared contracts determine the implementation here.

- PRD-F15 and PRD-F21; contracts §4; SDD §3.3/§3.4; core
  `packages/core/src/schema/user.ts` and `packages/core/src/trip/restore.ts`.
- Core prerequisites T20 [#4](https://github.com/The-Avenir/pussanggala/pull/4)
  and T25 [#12](https://github.com/The-Avenir/pussanggala/pull/12) are on this base.
  Corpus builder work [#20](https://github.com/The-Avenir/pussanggala/pull/20)
  is on this base; no shipped real pack or source-backed device test is claimed.
- T41's checked-in asset loader remains a synthetic validation adapter. The native
  writable SQLite connection is resolved through `UserDatabase`, documented in
  `apps/mobile/src/store/README.md`. T40/T41 own the app dependency pin/connection;
  T45 owns startup/screen integration. Their files and shared manifests are untouched.
- Core contracts, AI/conversation, GPS, map, original checkout, main and other
  workers' changes are not modified. Only this task's TODO status line is updated.

## Implemented behaviour

`createSqliteTripStore` uses local SQLite with no memory/cloud fallback. It persists
stable endpoint/ordered step IDs, shared preferences, current manual step and actual
clock timestamps. Optional route labels are separately authored, bounded input.
Strict top-level/nested schemas reject extra raw query/chat/GPS fields before writing.
No cards, source text, model responses or GPS fixes are serialized.

The forward-only v1 migration transaction creates exactly the five SDD user tables:
`USER_SETTING`, `ACTIVE_TRIP`, `SAVED_ROUTE`, `TRIP_HISTORY`, `INSTALLED_ASSET`.
`PRAGMA user_version` tracks user migrations independently of pack schema version.
Newer user schemas are rejected without downgrade; interrupted migration DDL/version
roll back together. The active-row primary key is constrained to one, and manual
advancement is serialized and bounded by the complete ordered step count.

Restore/open/advance calls core `validateRestoration`. Changed pack IDs are allowed
only when stable records still validate. Missing/excluded/suspended/retired records,
broken order/direction, endpoint mismatch, incompatible schema and invalid step
bounds return distinct `needs_replan` states with no usable itinerary. Valid restores
rebuild current facts and return a structured `TripState`, with no chat/fix state.
Validated endpoint IDs/preferences are supplied for fresh directed replanning where
possible. A fresh selected route replaces the active row and resets step zero.

Saved/history reads also revalidate against the installed pack. Broken route JSON
with valid metadata remains deletable without exposing its contents; invalid metadata
raises a sanitized error. IDs use SQLite random bytes; label/delete queries use bound
parameters. Save is explicit; completed lookups can record `looked_up`; explicit
end-trip atomically records `taken` and removes the active row. Single saved/history
deletion and clear-all history preserve unrelated settings/assets.

`TripPersistenceControls` supplies reusable explicit save/start/resume/end/reset,
manual-step, delete and clear-history controls. T45 supplies callbacks to recompose
core cards/evidence, reroute when necessary, clear conversation memory and stop T43
foreground GPS. The pre-existing `tripStore.ts` is explicitly deprecated as a
synthetic demo seam and remains for the other worker's existing screen.

## Executed host validation

Host: Windows x64; Node **v26.11.1**. Device: **none**. Only synthetic pack fixture
`pack_demo-001` and replacement variants; no real-world routing or verification claim.

| Command/scenario | Exact result |
|---|---|
| `npm ci --no-audit --no-fund` in `apps/mobile` | Exit 0; 471 packages installed; manifest/lockfile unchanged. Existing transitive `uuid@7.0.3` deprecation warning. |
| `node apps/mobile/src/store/check.mjs` | Exit 0: dedicated TypeScript check includes native controls and tests; Vitest **34/34 tests**, 1 file passed. |
| File-backed SQLite close/reopen plus separate process read | Passed: saved/history IDs and active manual step survive without the first store's memory. |
| Host writer killed with an uncommitted SQLite update | Passed: previous committed manual step survives; interrupted update rolls back on reopen. This is host process evidence, not Android force-stop evidence. |
| Atomic end-trip history write failure/retry | Passed: failure preserves active trip and writes no history; retry succeeds. |
| Migration failure/retry and newer-schema rejection | Passed: DDL and user_version rollback together; newer DB and unrelated setting preserved. |
| Pack replacement/missing/excluded/suspended/retired/direction/continuity/schema/manual-step cases | Passed for active, saved and history views; no obsolete itinerary returned. |
| Concurrent manual advances, two store instances, last-step bounds | Passed on real host SQLite; no lost updates or out-of-range advance. |
| Strict raw-extra/nested-extra rejection, ID-only JSON/schema dump, explicit labels and deletes | Passed; exactly five tables and contracted column names; no raw chat/query/GPS persistence fields. |
| `npm run typecheck` in `apps/mobile` | Exit 0. App-local harness types also pass; this does not mount the new controls or prove a build. |
| `npm test` at root | Exit 0: core **427**, conversation **52**, AI **88**, evaluation **10** tests passed (**577 total**, 36 files). |
| `npm run typecheck` at root (final rerun after app-local install completed) | **Exit 0**: all four workspace typechecks pass. The initial attempt, while app-local dependencies were still installing, reported errors in unchanged conversation `test/evalSut.test.ts:9` (`ImportMeta.url`) and `test/guardrails.test.ts:17` (`URL`, `ImportMeta.url`). Those errors did not recur after installation; no conversation/config source fix was made. |
| `node tools/eval/allowlist-check.mjs` | Exit 0: **15/15** detector self-tests; **88** scannable files at this run; no runtime/training raw-content finding. Raw build-input directory intentionally excluded. |
| `node --test tools/eval/allowlist-check.test.mjs` | Exit 0: **12/12** fixtures passed, including planted-leak rejection. |
| `git diff --check` | Exit 0. |
| Hosted `member4-checks`, PR/push runs on `fe4214523bc031140cce83cde1febbfcc9c1d48f` | **Success** in [PR run 37979899038](https://github.com/The-Avenir/pussanggala/actions/runs/37979899038) and [push run 37979889133](https://github.com/The-Avenir/pussanggala/actions/runs/37979889133): Node 22 workspace typecheck/tests, shipped-content scan and detector fixtures. This workflow does not yet run the dedicated T44 command. |

The repository evaluation tests rewrite their tracked report with current timestamps,
Node version and host timings. Only those test-generated changes from this run were
discarded; no other worker's edits were reverted. T44 does not publish synthetic
conversation or phone-performance numbers as release evidence.

## Unresolved gates and integration requirements

- Another member's approval and affected-owner review are still required. Root
  typecheck passes after dependency installation and hosted shared checks also
  pass. Shared CI does not currently register the dedicated T44 command.
- T40/T41 must pin/install native SQLite, supply the app-private writable connection
  and use this single user migration entry point. The declared Expo method surface is
  researched from [official SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/);
  no native adapter build or ABI compatibility is measured here.
- T45 must register the dedicated T44 check in shared CI, mount the controls, call
  startup restore with the installed validated pack, recompose fresh facts, and clear
  prior conversation/GPS memory through their owning modules. During replacement,
  freeze interaction and remount controls keyed by immutable pack ID/version.
- The v1 saved/history contract has no stored schema column. This implementation
  interprets those entries as v1 and rejects incompatible packs. A later schema
  requires a reviewed forward migration, not a guessed conversion.
- Existing pre-contract synthetic Map entries are not durable user data and are not
  migrated to real routes. T45 replaces that demo path explicitly.
- Android force-stop/cold airplane-mode restart, on-device save/delete/step rendering,
  real-pack replacement, actual DB driver durability, GPS/conversation cleanup and
  S7 integration have **not been run**. No `adb` executable was available in this shell;
  no reference/fallback phone is recorded by this task. No APK/build evidence exists.
- No shipped real pack, model, map or real-data acceptance is exercised by these
  synthetic persistence cases. Corpus/reviewer/licensing gates remain separate.
- No phone latency, PSS, installed footprint, performance or support claim. The
  host SQLite tests establish correctness scenarios, not PRD phone timing targets.

INV-1–INV-7 are preserved by consuming core validation/facts, adding only local
persistence, rejecting raw extras, keeping the corpus out of runtime assets, returning
explicit reasons, leaving origin confirmation with its owner and adding no training.
