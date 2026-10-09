---
document_type: TODO
project: Pusang Gala
slug: pusang-gala
doc_version: 0.1
status: Draft
owner: Salvador Vincent Javier
created: 2026-10-09
updated: 2026-10-09
reconciled: 2026-10-09
---

# Pusang Gala — Four-member TODO and PR workflow

**Scope:** [IDEA](idea-pusang-gala.md) · **Acceptance:** [PRD](prd-pusang-gala.md) · **Contracts:** [SDD](sdd-pusang-gala.md) · **Build:** [BUILD](build-pusang-gala.md)

This is an implementation plan for the confirmed working hackathon app. All implementation tasks are initially unchecked; the repo has documentation and a raw dataset, not a completed app. The current documentation reconciliation does not implement application code.

## 1. Four members and ownership

Use Member 1–4 until actual names are assigned in T00. Each task has one accountable lead; reviewers collaborate without competing ownership of the same files.

| Member | Owns | Primary paths | Cross-review responsibility |
|--------|------|---------------|-----------------------------|
| Member 1 — Justin — Corpus and evidence | Dataset audit, extraction, second AI evidence pass, ambiguity queue, source review coordination, pack builder and coverage report | `tools/corpus/`, `tools/pack-builder/`, `data/seed/` | Review Member 2's evidence/route assumptions; designate a human reviewer for unresolved records |
| Member 2 — Franz — Routing and retrieval | Shared core contracts, places/aliases, graph, rule validation, comparisons, cards and bounded RAG evidence | `packages/core/`, route/place/evidence fixtures | Review Member 1's pack schema and Member 3's grounding contract |
| Member 3 — CJ — Local AI and conversation | Native model runtime, model evaluation, intent/follow-ups, conversation state and validated streaming | `apps/mobile/src/ai/`, `apps/mobile/src/conversation/`, conversation eval fixtures | Review Member 4's inference integration and memory behaviour |
| Member 4 — Vincent — Mobile, maps, GPS and release | Expo scaffold/native build, asset/DB adapters, offline maps, GPS, saved/active trips, functional app integration and APK | `apps/mobile/` outside AI/conversation ownership, `tools/map-pack/` | Review Member 3's native integration; coordinate full-app gates |

Shared contracts v1: [contracts-pusang-gala.md](contracts-pusang-gala.md).

Member 2 leads the shared schema/API contract PR. Member 4 owns the app manifest/lockfile; other members propose dependency changes through that PR or a focused coordinated PR. All four review integration evidence and participate in final acceptance.

## 2. Mandatory branches and pull requests

**Always create a new task branch and a PR for every task: features, fixes, spikes, documentation and data-pipeline changes. Never work directly on main and never push directly to main.**

1. Start from clean, current main using a fast-forward pull. Preserve another member's work.
2. Create `<type>/tNN-short-slug`; use `feat`, `fix`, `spike`, `docs` or `chore`.
3. Keep one focused task/change per PR. Open a draft PR early for interface/dependency coordination.
4. Push only the task branch; target main. State dependent PRs and do not merge before prerequisites.
5. Use a Conventional Commit title: `type(scope): imperative summary`. Suggested scopes: corpus, core, ai, maps, gps, mobile, release, docs.
6. Obtain at least one other member's review. Schema/API changes also require the affected owners.
7. Fix conflicts in the task branch, rerun affected checks, and merge only after acceptance and review.
8. Update the task checkbox/status with its PR link and evidence. Clean up the branch after merge.

Do not force-push shared branches, bypass review or commit secrets/raw generated inputs. A spike PR records measured evidence and any discarded approach; passing a spike alone does not complete its feature.

## 3. Shared foundation — before dependent work

- [ ] **T00 — Contracts and team assignments.** Lead: Member 2; collaborators: all; reviewers: Members 1, 3 and 4. Assign actual names and the corpus reviewer; agree SDD §3 schema/result contracts, intent/current-trip state, evidence bundle, explanation-unit format and stable-ID rules. Record exact reference phone and fallback test phone. Establish shared fixtures and workspace boundaries. **Done:** one reviewed contract PR with no unresolved interface ambiguity; owner-confirmed scope is preserved. **Status:** in progress — names and contracts v1 merged in [#3](https://github.com/The-Avenir/pussanggala/pull/3); corpus reviewer and reference/fallback phones TBD.
- [ ] **T01 — Repository checks and contribution gates.** Lead: Member 4; reviewer: Member 2; depends: T00, T40. Add actual type/lint/test commands, suitable CI, asset allowlist and task/PR workflow guidance. Ensure shipped-content checks exclude raw curation inputs from app assets rather than asserting the existing input dataset is absent. **Done:** a branch PR passes declared checks and a fixture leak is rejected.

T10 can audit the dataset before T00 merges; T30/T40/T42 can investigate native feasibility independently. Schema-bound production outputs wait for T00. No final UI design starts in this phase.

## 4. Member task lists

### Member 1 — Corpus and source-backed pack

- [ ] **T10 — Audit all NCR inputs.** Depends: none. Recompute 3,480 posts / 2,186 with comments / 1,294 without / 3,988 stored texts; hash snapshot; inventory outside-NCR labels, missing question text, truncation and missing reply/date metadata. **Done:** reproducible metadata-only audit report; no raw content copied into app fixtures.
- [ ] **T11 — Extract facts and paraphrased notes.** Depends: T00, T10. Process all 2,186 answered posts; classify irrelevant text; produce canonical candidate records and post/index/hash evidence locators. **Done:** every input has an outcome; no guessing missing walks, fares, hours or reply relationships.
- [ ] **T12 — Second AI evidence pass and review queue.** Depends: T11. Flag unsupported facts, ambiguous connections and incomplete instructions. Present source evidence to the designated member; keep unresolved route-critical records quarantined and conflicts separately represented. **Done:** auditable decisions and queue/report counts; no field-verified badge.
- [ ] **T13 — Canonical NCR places and mapping evidence.** Depends: T00, T11; collaborate: Member 2 and Member 4. Establish aliases/NCR membership; resolve ambiguous geocoding; keep unsupported coordinates unmapped. **Done:** both endpoint eligibility and mapping evidence are explicit; the dataset label/bbox is not the membership test.
- [ ] **T14 — Eligible ride/walk/fare/hour records.** Depends: T12, T13; reviewer: Member 2. Resolve supported board/alight/transfer/access relationships and fare scope; preserve date/conflict/unknown/status information. **Done:** ready graph records have provenance; suspended/retired/unresolved connections cannot route.
- [ ] **T15 — Build pack, manifest and yield report.** Depends: T14, T20. Build SQLite indexes/foreign keys, external checksum, source dates, mutually exclusive post dispositions and usable record/coverage counts. Scan paraphrases/pack for leaked raw wording/usernames. **Done:** loader-compatible pack; counts reconcile; no invented route-count claim.
- [ ] **T16 — Corpus acceptance and handoff.** Depends: T15, T26. Run invalid-record/ambiguity/source-content fixtures; supply source-backed evaluation records and final eligible pack to Members 2–4. **Done:** reproducible pack/report and reviewer sign-off; no physical-verification claim.

### Member 2 — Deterministic routing and RAG evidence

- [x] **T20 — Shared types and validation contracts.** Depends: T00. Define schemas/typed results, manifest/record parsing, stable IDs and failure reasons; pure TS core. **Done:** Members 1/3/4 can consume the same contracts without native/network imports. **Status:** merged in [#4](https://github.com/The-Avenir/pussanggala/pull/4).
- [x] **T21 — Normalize and resolve supported places.** Depends: T20, T13 for real data. Implement aliases/typos/ambiguity/NCR checks and current-trip references. **Done:** clarification and supported-landmark behaviour pass fixtures; no automatic ambiguous choice. **Status:** merged in [#5](https://github.com/The-Avenir/pussanggala/pull/5).
- [x] **T22 — Build graph and supported itinerary search.** Depends: T20, T14. Directed ride/access/walk graph; supported cross-thread joins; status filters; continuity/fare-scope/cycle checks. **Done:** no proximity-created transfer or partial itinerary; source-supported routes work. **Status:** merged in [#6](https://github.com/The-Avenir/pussanggala/pull/6).
- [x] **T23 — Alternatives and qualified comparisons.** Depends: T22. Track unknown fares/times, conflicting reports, transfers and reported duration; show unknown-value options without claiming guaranteed optimum. **Done:** absent fares never become zero; totals/comparison claims have complete applicable evidence. **Status:** merged in [#7](https://github.com/The-Avenir/pussanggala/pull/7).
- [x] **T24 — Cards and bounded retrieval context.** Depends: T20, T23, T15 for real data. Compose canonical facts, warnings, dates, relevant notes, supported card references and rule-generated comparison/hour statements for AI. **Done:** deterministic cards and RAG bundle trace to pack IDs; no raw comments. **Status:** merged in [#8](https://github.com/The-Avenir/pussanggala/pull/8).
- [x] **T25 — Follow-up and restoration core helpers.** Depends: T21, T24; collaborate: Members 3/4. Reroute reverse/changed journeys, resolve reported-hour requests, validate restored record sequences/steps against new packs. **Done:** no reversed old instructions, scheduling or obsolete-route restoration. **Status:** merged in [#12](https://github.com/The-Avenir/pussanggala/pull/12).
- [ ] **T26 — Route/place/retrieval evaluation.** Depends: T21–T25; reviewer: Member 1. At least 30 source-backed route cases plus ambiguity, outside-NCR, disconnected/missing access, suspended/retired and conflict/unknown cases. **Done:** applicable PRD acceptance/negative checks pass; routing/card device timing is handed to T45. **Status:** in progress — synthetic evaluation suite (52 route + 59 negative cases) merged in [#13](https://github.com/The-Avenir/pussanggala/pull/13); ≥30 source-backed cases on the real pack pending T16.

### Member 3 — Required local AI and conversation

Integration repair in progress on branch `feat/m3-integration-repair` (Approach 1): core `ExplanationUnit` inserts, `@pusang-gala/conversation`, unified `@pusang-gala/ai` (guard + recovery), and `@pusang-gala/eval-conversation` harness. **Blockers for Done:** T00 reference/fallback phones TBD; T40 Expo/native scaffold absent; T30 native GGUF/S1 not started (no rules-only replacement of required AI). Workspaces registered under root `npm test`.

- [ ] **T30 — Native model compatibility and safe-output spike.** Depends: T00 for final contracts, T40 for native build; may investigate early. Pin/test runtime and eligible sub-1B GGUF; native path loading, constrained output, cancellation and no-network operation. **Done:** S1 actual-phone evidence; no rules-only replacement of required AI. **Status:** not started — `ModelRuntime` port exists in `@pusang-gala/ai` with `FakeModelRuntime` only; native adapter pending T40/T30.
- [ ] **T31 — Model bake-off and footprint.** Depends: T30; collaborate: Member 2. Evaluate candidates on held-out intent/follow-ups and grounded explanations; measure first safe unit, full warm/cold timing, memory and actual parameter count. Record licence/revision/hash. **Done:** measured model choice; initial full warm-response target ≤10 seconds or explicitly unresolved performance work. **Status:** not started — blocked on T30.
- [ ] **T32 — Current-trip conversation manager.** Depends: T20, T25, T30. Implement bounded in-memory context, new-trip reset, clarification and journey-specific follow-ups; brief unrelated-request redirection. **Done:** no persisted raw chat; endpoint/preference changes retrieve current evidence. **Status:** partial on `feat/m3-integration-repair` — pure TS manager wired to core contracts; production model intent (T30) still pending; `RuleIntentParser` wraps core `parse` for tests only.
- [ ] **T33 — Grounded generation and validated streaming.** Depends: T24, T30, T32. Feed bounded structured context, use canonical factual references and rule reasons; buffer/validate complete units before display. **Done:** no unchecked tokens, invented facts or reversed instructions; cards stay canonical. **Status:** partial on `feat/m3-integration-repair` — `guardStream` + core-aligned units + invention checks; awaits real `ModelRuntime` from T30.
- [ ] **T34 — Capability, cancellation and inference recovery.** Depends: T31, T33; collaborate: Member 4. Handle unsupported device, memory pressure, cancellation/retry and temporary errors while preserving cards/trip. **Done:** explained fallback and stable native cleanup; required reference-phone AI still works. **Status:** partial on `feat/m3-integration-repair` — lifecycle/recovery over fake runtime; reference-phone gate unmeasurable until T00/T31.
- [ ] **T35 — Conversation and grounding evaluation.** Depends: T32–T34; reviewers: Members 2/4. ≥50 labelled intent queries with held-out wording; ≥100 response reviews/adversarial cases; test unknowns, conflicts, unrelated input, stream rejection and source instructions treated as data. **Done:** no unsupported factual claim displayed in the evaluated corpus; latency evidence recorded. Optional fine-tuning only if a measured deficiency justifies a separate scoped PR. **Status:** partial — harness + 65 intent / 105 adversarial cases; stub SUT preliminary report only; real SUT + device latency pending T30–T34 integration.

### Member 4 — App, offline map/GPS, persistence and release

- [ ] **T40 — Expo/native scaffold and pinned build.** Depends: T00 for shared layout; may investigate early; reviewer: Member 3. Select/test compatible Expo/RN/native versions and record actual build commands. Start with a minimal technical harness. **Done:** native Android development and release build evidence; no Expo-Go-only acceptance. **Status:** partial in draft [#21](https://github.com/The-Avenir/pussanggala/pull/21) — pinned workspace/native scaffold; clean install, type/tests, config/prebuild, autolinking, Android bundle and content checks pass; [task evidence](../apps/mobile/t40-build-evidence.md); Android SDK compilation, actual-phone and other-member review gates remain unresolved.- [ ] **T41 — Local assets, pack loader and readiness.** Depends: T20, T40, T15/T31 for final assets. Check schema/hashes, native-readable paths, missing/corrupt assets and installed footprint; explicit APK asset allowlist. **Done:** judged assets available offline; raw dataset excluded; cards retained during recoverable failures. **Status:** partial — schema-v1 local pack loader, integrity/readiness, injectable Expo ports and asset allowlist in draft [#24](https://github.com/The-Avenir/pussanggala/pull/24); 81 T41 + 16 packaging + 21 builder-fixture checks pass. [T41 evidence](evidence/t41-offline-assets.md); final pack/model/map assets, native binding/build, installed footprint and phone/offline gates remain open.
- [ ] **T42 — Offline NCR basemap and honest geometry.** Depends: T40, T13 for journey markers. Test local PMTiles path or documented local fallback; bundle glyphs/sprites/style/attribution; show mapped points and labelled schematic connectors. **Done:** S2 cold offline launch; no guessed exact vehicle path or online resource.
- [ ] **T43 — Foreground GPS and confirmed origin suggestions.** Depends: T42, T21. Accuracy/fix age, mapped nearby candidates, user confirmation, denied/no-fix handling and lifecycle cleanup. **Done:** S3 outdoors/offline evidence; no automatic trip detection/background trace.
- [ ] **T44 — Saved/history/active-trip persistence.** Depends: T20, T25, T41. Persist IDs/preferences/manual step, delete controls, compatibility-aware restoration and replanning. **Done:** process death/pack-change cases pass; no raw chat or GPS-coordinate storage. **Status:** partial — SQLite store and reusable controls in draft [#22](https://github.com/The-Avenir/pussanggala/pull/22); 34 host persistence tests plus existing checks pass ([evidence](evidence/t44-trip-persistence.md)); T41/T45 native wiring, review and real Android/offline/data gates remain open.
- [ ] **T45 — Functional end-to-end integration.** Depends: T16, T26, T35, T41–T44; all members validate. Wire querying, clarification, cards-first streaming, alternatives, map/schematic/GPS, save/history, manual steps and restart. **Done:** all Must-Haves work on unseen supported inputs; S4/S7 evidence and failure paths recorded.
- [ ] **T46 — Final usable UI and visual design.** Depends: T45; collaborators: all. Design after functional validation; Figma remains WIP until reviewed. Provide concise readable cards, uncertainty labels, offline readiness, origin confirmation and recovery actions. **Done:** the completed UI exposes working features; no simulated download/account/arrival-alert flows. **Status:** original nine-screen baseline in [draft PR #18](https://github.com/The-Avenir/pussanggala/pull/18). The owner-requested 10 October [redesign](ux-redesign.md), [wireframes](ux-wireframes.html) and [visual review](ux-review.html) now follow the playful chat direction on `feat/t46-playful-commute-chat`, retaining the earlier redesign as its base. Two Luna workers coordinated through Orca implemented and reviewed the UI; see [review and validation](playful-chat-review.md). The app uses supplied Gaile artwork instead of the SVG cat mark, sunset colors, bundled typography and a “Where to go?” home chat. GitHub PR creation is pending valid authentication. T45/native adapters, persisted onboarding completion and device acceptance remain pending; task is not complete.
- [ ] **T47 — Judged APK and offline rehearsal.** Depends: T45, T46; all members review. Package actual assets/licences, install on named reference/fallback phones, cold-restart in airplane mode, run unseen questions/follow-ups and 20-query map/GPS/AI lifecycle soak, test restore/permissions/corruption. **Done:** release evidence and known limitations attached; required reference-phone AI/map/GPS all work.

## 5. Dependencies and integration order

| Stage | Parallel work | Gate before next stage |
|-------|---------------|------------------------|
| Foundation | T00/T10; early native/model/map investigation | Reviewed shared contracts and native build path |
| Corpus/core/AI/mobile | Members 1–4 work in owned areas with source-supported fixtures | Eligible pack + deterministic core + guarded conversation + native adapters |
| Functional integration | T45 and shared device checks | Required features work offline together; no mock-only flow |
| UI and release | T46 → T47 | Usable final screens, installed APK and actual judging rehearsal |

Task dependencies indicate merge/integration order; early tests may use explicitly synthetic source-supported fixtures. Production data and device gates must use the actual pack/phone. Dependent PRs stay draft until prerequisites merge. All members record blockers and PR links here; do not silently mark a dependency complete.

Deferred tasks are deliberately absent: accounts, sync, user submissions/confirmations, voice, live/scheduled travel, automatic trip detection, maintenance cadence and production Play delivery.

## 6. Conventional PR description template

Use this body for every PR and a title such as `feat(core): preserve unknown fares in route comparisons`. Replace every bracketed prompt; use “Not applicable — reason” when appropriate.

```markdown
## Problem and resulting behaviour

[Concrete trigger/problem, followed by what the change now does.]
[For a bug, include a short before/after example.]

## Task and scope

- Task: TNN — [task name]
- Requirement(s): PRD-FN, PRD-FN
- Invariant(s): INV-N
- Branch: type/tNN-short-slug
- Depends on: [PR links or None]
- Reviewer(s): [another member; affected contract owners where needed]

## Implementation

[Only details needed to review the final change: contracts, data flow,
asset/schema changes, source evidence and important tradeoffs.]

## Validation

- [Exact command/device scenario]: [result]
- Offline check: [airplane-mode/cold-start evidence or justified N/A]
- Device: [model, ABI, Android, RAM when relevant]
- Data/model/assets: [snapshot/pack IDs, revisions/hashes when relevant]
- Performance: [measured timings/memory or justified N/A]

## Compatibility and risks

[Pack/user-schema compatibility, native/device limitations, unresolved
gates and recovery behaviour. Distinguish measured results from targets.]

## Evidence

[Screenshots, logs without sensitive data, reports, and source references.]

## Checklist

[Copy the applicable checklist from TODO.md §7.]
```

Do not replace the body with a conversation transcript or a list of abandoned approaches. Lead with the problem and resulting behaviour, and describe actual validation.

## 7. PR checklist

Copy into the PR body. Mark an irrelevant item “N/A — reason”; leave unfinished applicable checks unchecked.

- [ ] Branch created from current main; no direct work/push on main.
- [ ] Conventional PR title and focused commits; one accountable task lead.
- [ ] Task ID, PRD requirements, invariants, dependency PRs and reviewer listed.
- [ ] Behaviour matches confirmed scope; no deferred features slipped in.
- [ ] Shared API/schema changes reviewed by affected owners; stable-ID/pack compatibility and user migrations covered.
- [ ] Applicable build, lint, type and meaningful tests pass; exact commands/results included.
- [ ] Applicable airplane-mode/cold-start/device checks completed with evidence.
- [ ] Factual outputs use eligible pack records; missing/conflicting/old values stay explicit; no invented connections.
- [ ] No raw Reddit wording/usernames in runtime/training assets; raw input directory excluded from app package.
- [ ] No cloud fallback, uploads, telemetry, secrets or raw chat/GPS persistence added.
- [ ] AI changes validate units before streaming and preserve cards during errors; required reference-phone AI is not replaced by templates.
- [ ] Map/GPS changes preserve local dependencies, attribution, honest geometry, origin confirmation and foreground cleanup.
- [ ] Performance/footprint results are measured where relevant; unresolved gates and risks stated honestly.
- [ ] Docs/TODO/INDEX reconciled where behaviour or task status changes.
- [ ] Another member reviewed and approved; dependent PRs merged; conflicts resolved and affected checks rerun.

