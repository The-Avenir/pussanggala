---
spine_type: LOG
spine_version: 0.3.0
project: Pusang Gala
slug: pusang-gala
doc_version: 0.5
status: Draft
owner: Salvador Vincent Javier
created: 2026-10-09
updated: 2026-10-09
reconciled: 2026-10-09
---

# Session Log: Pusang Gala

## 1. Current confirmed decisions

The owner confirmed the consolidated scope after grilling rounds G01–G27, then requested documentation reconciliation and a four-member TODO with mandatory branches/PRs, a Conventional PR description and checklist. These decisions supersede conflicting entries in the pre-reconciliation log at commit `3732824`.

| Date | Decision | Rationale | Docs |
|------|----------|-----------|------|
| 2026-10-09 | Working offline judged hackathon app; integral features must function beyond canned examples | Owner G06/G15 and confirmation | IDEA, PRD, SDD, TODO |
| 2026-10-09 | NCR-only endpoints; corpus-backed place coverage, not Cubao–Masinag or a full-coverage promise | Owner G01/G09/G18 | IDEA, PRD, SDD |
| 2026-10-09 | Source-backed community routes; no verified label or initial physical-survey requirement | Owner G02/G17 | IDEA, PRD, SDD, BUILD |
| 2026-10-09 | Process all 2,186 NCR posts with stored comments; extract structured facts and paraphrases; second AI pass then designated-member resolution of remaining ambiguities | Owner G11/G17/G24/G27 | IDEA, PRD, SDD, TODO |
| 2026-10-09 | Retrieval + deterministic rules → required grounded local-AI conversation; reference-phone rules-only delivery fails acceptance | Owner G05/G13/G23 | IDEA, PRD, SDD, BUILD |
| 2026-10-09 | Source-supported joins across threads allowed; unresolved or missing connections withhold the itinerary | Owner G14/G16 | PRD, SDD |
| 2026-10-09 | Short current-trip conversation and follow-ups; redirect unrelated requests; no saved raw chat | Owner G03/G12/G26 | IDEA, PRD, SDD |
| 2026-10-09 | Cards first, then validated streamed explanation; initial complete warm-response target 10 seconds, subject to measurement | Owner G22 | PRD, SDD, TODO |
| 2026-10-09 | Offline maps, schematic, foreground GPS and saved routes are required in the judged app | Owner G10/G19/G20 | IDEA, PRD, SDD, INDEX |
| 2026-10-09 | Mapped points and labelled schematic connectors; exact vehicle path only with geometry evidence | Owner G19 | PRD, SDD |
| 2026-10-09 | GPS accuracy/fix age and nearby-origin confirmation; steps advance manually | Owner G20 | PRD, SDD |
| 2026-10-09 | Old reports remain usable with warnings; exclude suspended/retired services; preserve dated conflicts and unknown fares | Owner G04/G14 | IDEA, PRD, SDD |
| 2026-10-09 | Comparisons use sufficient applicable evidence with limited claims; unknown-value alternatives stay visible | Owner G21 | PRD, SDD |
| 2026-10-09 | Report hours with dates/uncertainty; unknown hours stay unknown; scheduling/arrival prediction deferred | Owner G25 | PRD, SDD |
| 2026-10-09 | Save/restore active route and manual step with IDs/pack checks; no GPS traces or raw conversation persistence | Owner G26 | PRD, SDD |
| 2026-10-09 | Unsupported-device and transient-error fallback retains other usable features; no cloud fallback | Owner G23/G22 | IDEA, PRD, SDD |
| 2026-10-09 | Accounts, sync, submissions, confirmations and voice deferred; maintenance planning skipped; Figma WIP and UI design last | Owner G07/G08/G10 | All current docs |
| 2026-10-09 | Four accountable member workstreams; every task on a branch and PR, with another member reviewing | Owner reconciliation request | BUILD, TODO, INDEX |
| 2026-10-09 | Strictly sub-1B, measured model selection, startup-compatible licences, 4 GB/64 GB Helio reference profile and no supplied deadline carried forward | Prior owner choices retained | IDEA, PRD, SDD, BUILD |

The no-raw-shipped-content invariant is retained. Its old blanket “never commit Reddit content” wording is reconciled with the intentionally supplied repository dataset: raw input is build-time evidence only, excluded from runtime/training packages. This change does not establish source redistribution permission.

## 2. Execution prerequisites and unresolved technical gates

Product scope is confirmed. These are implementation prerequisites, not new product questions.

| Item | Accountable lead | Resolution/evidence |
|------|------------------|---------------------|
| Actual member names and designated corpus reviewer | All, coordinated by Member 2 | T00; designated human must resolve remaining route-critical ambiguity before publication |
| Exact reference/fallback phone model, ABI, Android and RAM | Member 4 + Member 3 | T00/T30; use prior 4 GB/64 GB Helio profile as planning input only |
| Shared schema and intent/evidence/stream result contracts | Member 2; affected owners review | T00/T20 |
| Native versions, model revision/hash/licence and compatible output format | Member 3 + Member 4 | T30/T31/T40; no manifest exists |
| Local map format, NCR boundary evidence, coordinates, tiles/style/glyphs/sprites | Member 4 + Member 1 | T13/T42; no local-map spike has passed |
| Actual grounded-response timing, concurrent memory and installed footprint | Member 3 + Member 4 | T31/T45/T47; provisional targets are not results |
| Usable corpus yield, review queue and provenance | Member 1 + Member 2 | T10–T16; no extracted pack exists |
| Source/model/map/font redistribution basis and attribution | Each asset owner, release coordinated by Member 4 | Before asset packaging; no additional legal conclusion is implied |
| Actual dev/build/test/lint commands | Member 4 + Member 2 | Record after scaffold; do not claim commands ran |
| Deferred maintenance, account/submission moderation, voice and Play delivery | No current implementation owner | Intentionally outside current scope |

The session instruction SKIP SPINE remains in effect; Draft status distinguishes design from implementation evidence and does not create an extra scope-approval step.

## 3. Grilling decision register

| Round | Questions | Outcome |
|-------|-----------|---------|
| G01–G08 | Coverage, verification, conversation, uncertain data, AI requirement, delivery, maintenance, Figma | NCR; supplied Reddit evidence without verified badge; short conversation; dated warnings and service exclusions; required AI; working judged app; maintenance deferred; UI last |
| G09–G15 | Endpoint boundary, required maps/GPS, retrieval corpus, follow-ups, AI authority, conflicts/incompleteness, acceptance | Both endpoints NCR; all integral features required; facts/paraphrases; current-trip context; cards anchor facts; withhold incomplete itineraries; unseen-query offline acceptance |
| G16–G22 | Cross-thread joins, review, place precision, geometry, GPS, comparisons, streaming | Supported joins only; automated then ambiguity review; supported landmarks; honest geometry; confirmed GPS origins/manual steps; qualified comparisons; cards-first streaming and 10-second target |
| G23–G27 | Device fallback, reviewer, hours, restoration, processing extent | Reference AI required; second AI pass plus designated member; dated reported hours only; ID/pack-checked restore; process all answered NCR posts |
| Confirmation | Consolidated scope | Owner: “scope is ok”; authorized reconciliation and TODO creation |

## 4. Dataset observations

Read-only inspection of the new files at commit `3732824` established:

- Full JSON: 16,387 posts, 8,556 with stored comments, 7,831 without, 15,350 stored comment texts.
- NCR JSON/CSV: 3,480 records; 2,186 have stored comments, 1,294 do not; 3,988 stored texts. CSV IDs/endpoints match NCR JSON.
- Endpoint strings are uncanonicalized; NCR labels are not a validated geographic boundary.
- Nested comments have score/text only; comment dates, IDs and reply lineage are absent. Post timestamps span 2026-04-09 to 2026-10-09 UTC and are not verification dates.
- There are no structured stops, legs, coordinates, fares, signboards, geometry or transfer links. Acknowledgements, questions and unrelated content occur among comments.
- Some CSV top answers are incomplete or truncated. One answer_count differs from its actual stored array; use computed counts.
- No extraction, source-review pack or phone benchmark was completed by reading the dataset.

## 5. Superseded decisions and retained history

The previous detailed session log is available through git history at `3732824:docs/log-pusang-gala.md`. Keep it as history, not as the current implementation contract.

| Earlier position | Current disposition |
|------------------|---------------------|
| Cubao–Antipolo/Masinag first field-verified corridor; 40–80 legs | Superseded by usable NCR corpus records and measured yield |
| Metro Manila + Rizal asset extent / 55 MB estimate | Superseded by measured NCR package; boundary eligibility separate from tile extent |
| Map/GPS in 1.1 with Firebase accounts/community features | Map/GPS required now; accounts/community deferred without a promised version |
| Optional persona line and rules-only first release if AI weak | Required grounded conversation on reference phone; fallback only for unsupported/transient cases |
| Field-verified/last_verified schema and fixed fare-rule facts | Source evidence/dates, eligibility/review state, conflicting reports and unknown values |
| Model extraction <5 seconds as complete AI gate | Complete warm explanation initial target ≤10 seconds, with separate component timings |
| Pre-picked model/quantization and assumed minimum Android | Measured runtime/model/phone choice; exact versions/minimum not claimed without tests |
| Play fast-follow custom module as first-release dependency | Judged bundled APK first; Play distribution later |
| Open legacy questions about GTFS, voice, “jev”, moderation | Not current blockers; omitted or deferred by confirmed scope |
| Branch policy awaiting confirmation | Resolved: every task must use branch + PR + another member's review |

## 6. Session completion and next work

Documentation reconciliation is prepared on `docs/reconcile-confirmed-scope`. All app tasks remain unchecked in TODO. No application code was implemented; no device or acceptance gate is marked passed. Current docs are Draft, and historical references remain evidence.
