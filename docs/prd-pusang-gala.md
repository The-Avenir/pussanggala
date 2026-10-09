---
spine_type: PRD
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

# Product Requirements: Pusang Gala

**IDEA:** [idea-pusang-gala.md](idea-pusang-gala.md)

**Design:** [sdd-pusang-gala.md](sdd-pusang-gala.md)

**Work allocation:** [TODO.md](TODO.md)

## 1. Scope statement

Release 1.0 is the working, judged hackathon Android app confirmed in G01–G27. It implements **offline retrieval + rule-based routing → required grounded local-AI conversation**, deterministic cards, schematic, offline maps, foreground GPS, saved routes and active-trip recovery. Both endpoints are in NCR and must be supported by usable corpus records.

The source is the supplied Reddit dataset; records are community-reported, not labelled verified. Accounts, sync, submissions, confirmations, voice output and maintenance planning are deferred. The previous map/GPS-to-1.1 split is superseded. UI design follows functional integration; the current Figma is WIP.

## 2. Users

| User | Goal | Priority |
|------|------|----------|
| First-time NCR commuter | Find and understand a supported journey | Primary |
| Commuter without data | Use all required functions offline | Primary |
| Returning commuter | Save routes and recover an active trip | Primary |
| Corpus reviewer | Resolve ambiguous source extraction before publication | Internal |

## 3. Features

`Must-Have` means required in the judged app. Deferred entries preserve existing feature IDs for traceability; they are not scheduled for 1.1.

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| PRD-F1 | Taglish/English intent understanding | Must-Have | Parse endpoints, preferences and follow-up intent locally, with rules and the local model. Manual place selection remains available. |
| PRD-F2 | Supported-place resolution | Must-Have | Resolve corpus places/aliases with typo tolerance and clarification. Both endpoints must belong to NCR. Arbitrary addresses require selection of a supported landmark; no invented final walk. |
| PRD-F3 | Source-backed offline routing | Must-Have | Join supported ride legs and explicit transfer/walk links, including across threads. Exclude suspended/retired and unresolved connections. Support fare, transfer-count and reported-time comparisons without claiming guaranteed optimality. |
| PRD-F4 | Deterministic cards with provenance | Must-Have | Show mode, reported signboard where available, boarding/alighting landmarks, supported walking instructions, fare information or unknown state, source dates/links, conflicts and age warnings. |
| PRD-F5 | Grounded local-AI explanation and cat voice | Must-Have | Required model explains canonical cards and rule-approved comparisons in short Taglish/English responses. Cards appear first; validated explanation chunks stream afterwards. It cannot invent facts. |
| PRD-F6 | Offline in-app map | Must-Have | Local NCR basemap, mapped journey points and attribution. Connections are clearly schematic unless source-backed path geometry exists. Missing point coordinates are explicitly identified. |
| PRD-F7 | Foreground GPS and origin suggestions | Must-Have | Position, accuracy and fix age; suggest supported nearby origins for confirmation. Steps advance manually. Stop subscriptions on background/end-trip. |
| PRD-F8 | Offline assets and readiness | Must-Have | Judged APK includes model, pack and map dependencies. Locate/copy as needed, validate checksums/schema, show ready/missing/failed states; no app download path. |
| PRD-F9 | Honest recovery/failure states | Must-Have | Distinct handling of outside-NCR, unsupported/ambiguous place, no connected itinerary, conflicts, stale reports, missing information/assets, inference failure and unavailable GPS. |
| PRD-F10 | Corpus extraction and pack tooling | Must-Have | Process all 2,186 answered NCR posts; extract facts/paraphrases, perform a second AI evidence pass, review ambiguous/incomplete connections, canonicalize places, validate and build a versioned pack with inclusion/rejection counts. |
| PRD-F11 | Source-backed notes and warnings | Must-Have | Paraphrased journey-related notes for retrieval and cards, with evidence links. Comment counts/upvotes are not correctness scores or commuter-confirmation counts. |
| PRD-F12 | Schematic view | Must-Have | Supported stop/transfer sequence, labelled schematic; remains usable if the map is unavailable. |
| PRD-F13 | Offline voice output | Could-Have | Deferred; engine/voice selected only in a later scope. |
| PRD-F14 | External Google Maps handoff | Could-Have | Deferred; not a dependency of this release. |
| PRD-F15 | Saved routes and local history | Must-Have | Persist stable place/route IDs and timestamps; revalidate against pack changes. Allow deletion. No raw queries or GPS traces. |
| PRD-F16 | Account and cloud sync | Could-Have | Deferred; no Firebase/account modules in the judged app. |
| PRD-F17 | User route confirmations | Could-Have | Deferred; no public confidence badge derived from comment counts. |
| PRD-F18 | User corrections/submissions | Could-Have | Deferred; separate from internal corpus review. |
| PRD-F19 | Journey-focused conversation | Must-Have | Current-trip follow-ups: alternatives, reverse journey, endpoint/preference changes, boarding, fares and transfers. New-trip action clears context. Briefly redirect unrelated requests. |
| PRD-F20 | Reported operating-hours answers | Must-Have | Report source-backed hours with dates/uncertainty; say unknown when absent. No future departure scheduler or arrival prediction. |
| PRD-F21 | Active-trip restoration | Must-Have | Restore selected route and manual step after restart using stable IDs and pack compatibility checks. Persist no raw conversation or GPS trace. |

Priority vocabulary: `Must-Have`, `Should-Have`, `Could-Have`, `Dropped`.

### 3.1 Acceptance criteria

**PRD-F1 — Intent understanding**
- Evaluate at least 50 labelled Taglish/English queries with held-out wording, including follow-ups. Exact required-slot accuracy for unambiguous queries is at least 90% (M1).
- Model output references input spans or current-trip structured slots; it cannot supply invented place IDs, fares or route legs. Clarify missing/swapped/uncertain endpoints.
- Compare rules-only and hybrid results (M2); rules-only measurements are a baseline, not a substitute for required AI conversation.

**PRD-F2 — Place resolution**
- Every designated ambiguous input asks the user to choose; 2–4 candidates show an area/landmark. Unsupported/outside-NCR endpoints fail honestly.
- A one-character typo in a known alias of at least five characters includes the intended place among the top three candidates.
- NCR membership uses canonical geography evidence, not merely the dataset label or a rectangular map extent.
- Unsupported arbitrary addresses do not silently resolve to an assumed walk; the user selects a supported landmark.

**PRD-F3 — Routing**
- At least 30 expected-route fixtures match source-supported results or an equally supported itinerary approved by the reviewer. Include cross-thread joins, disconnected stops, reverse-direction requests, suspended/retired services and absent transfer links.
- Nearby coordinates, similar names and shared source keywords cannot create a connection. Every boarding and transfer traces to an eligible record; incomplete itineraries are withheld.
- Missing fare/time components stay unknown. Show qualified comparisons such as “lowest reported fare among options with fare information”; other options remain visible.
- Routing plus card rendering after endpoint resolution has p95 under 500 ms on the reference phone (M4).
- Do not repeatedly charge a boarding fare for a single continuous ride; only source-supported fare scope can be compared or totaled.

**PRD-F4 — Cards**
- Every factual card field traces to a pack record and source. Date labels describe source-post dates; no field-verified/current badge appears.
- Conflicting reports retain their separate values and dates. A missing fare is visibly unknown, never zero.
- Older reports remain usable with an age warning. The initial manifest warning threshold is 180 days, carried forward as a configurable engineering default rather than a field-validity guarantee.
- Suspended/retired services never appear in a routable itinerary.

**PRD-F5 — Required AI explanation**
- The delivered reference-phone app produces grounded local-AI explanations offline. A template-only/rules-only reference demo fails this requirement.
- Cards render before generation completes. Only validated explanation units reach the screen; raw unchecked tokens are not displayed.
- Generated claims cannot add or reverse boarding, alighting or transfer instructions, fabricate facts, hide uncertainty or contradict cards. A vocabulary allowlist alone is insufficient.
- Target complete warm explanation within 10 seconds (M5); record cold-load, time-to-first-safe-chunk, intent and generation timing separately.
- Cancel/retry without losing cards. A temporary inference failure shows a recovery action and leaves cards usable; unsupported-device fallback is clearly explained.

**PRD-F6 — Map**
- After force-stop, radio disable and cold relaunch, the NCR basemap renders from local tiles with labels, icons and attribution.
- Mapped boarding/transfer/destination points use source-backed coordinates. Points lacking coordinates remain in cards/schematic and are marked unmapped.
- Schematic connectors are dashed and labelled; the UI never implies that they follow vehicle roads. Exact paths require source-backed geometry.
- Missing/corrupt map assets show a recovery state and retain cards/schematic; the reference release still needs a working map.

**PRD-F7 — GPS**
- Outdoors, network-off foreground fixes update the marker with accuracy and fix age. Old fixes are labelled last known.
- Nearby-origin suggestions use mapped supported places and require confirmation; low-quality fixes do not automatically select an origin.
- Denied permission, disabled location and no fix preserve manual input. End-trip/background pauses subscriptions; return resumes them when appropriate.
- Advancing a step is manual; no background tracking, recorded GPS trace or automatic boarding/alighting detection.

**PRD-F8 — Assets**
- Each model/pack/map asset shows size, checksum/schema validation and ready/missing/failed state.
- Asset errors do not crash the app or trigger network fallback. All judged-app assets are present after installation.
- The packaged app excludes the raw repository dataset and unreviewed extraction intermediates.

**PRD-F9 — Failure states**
- Every reason has a distinct message and recovery action. Test outside-NCR, ambiguity, unsupported place, disconnected itinerary, stale/conflicting reports, unknown fare/hours, missing assets, inference failure and location errors.

**PRD-F10 — Corpus/pack**
- Audit JSON rather than trusting CSV top answers: 3,480 NCR posts, 2,186 with stored comments, 1,294 without, 3,988 stored comment texts in the supplied snapshot. Treat comments as candidate evidence, not automatically correct answers.
- Process all 2,186 answered posts. Classify acknowledgements, questions and unrelated content; extract facts and paraphrases; retain evidence references and second-pass review decisions.
- The reviewer resolves ambiguous connections/incomplete instructions. Unresolved items stay out of routing; this does not label the result field-verified.
- Reject missing record references, unsupported transfer/first-last walking links, unknown endpoint geography, suspended/retired routing entries, missing provenance, raw wording/usernames and incompatible schemas.
- Report processed/included/filtered/review-pending/rejected posts and produced records, usable places/connections and supported coverage. Do not equate post count with itinerary count.
- Manifest records snapshot checksum, schema/version, NCR boundary reference, build date, source-date range, warning threshold and output checksum.

**PRD-F11 — Notes**
- Every note is paraphrased, relevant to a supported record, source-linked and included in the retrieval evidence bundle. No acknowledgement or raw comment is shipped.
- Upvotes/comment counts cannot imply correctness, independence, present-day operation or “N commuters confirmed”.

**PRD-F12 — Schematic**
- Every complete itinerary shows its ordered board/transfer/alight sequence, labelled not to scale. It works when map assets are unavailable.

**PRD-F15 — Saved/history**
- Restart preserves saved routes. Pack replacement revalidates record existence, eligibility and connectivity; incompatible routes require replanning rather than rendering obsolete facts.
- Store stable IDs, structured preferences and timestamps only; no raw query/conversation or GPS coordinates. Delete one item or all history.

**PRD-F19 — Conversation**
- Test alternatives, reverse journey, destination/preference changes, boarding, fares, transfers and unrelated requests with held-out phrasing.
- Context holds only current-trip structured state plus a bounded in-memory exchange window. New-trip clears it. Reverse journeys are rerouted using directed records, not by reversing old instructions.
- Follow-ups retrieve fresh context for the changed journey and preserve clarification and uncertainty.

**PRD-F20 — Hours**
- Known reported hours include source dates and uncertainty. Missing hours say unknown. No source-post date or user request implies that a service is operating now.
- Hour questions do not create a future timetable, guaranteed availability or arrival prediction.

**PRD-F21 — Restoration**
- Force-stop/relaunch restores valid selected record IDs, endpoints, preferences and current manual step after checking pack/schema compatibility.
- Missing, changed or suspended records stop restoration and offer replanning. Raw chat is cleared; GPS resumes only under foreground lifecycle rules.

Deferred PRD-F13, F14 and F16–F18 have no release acceptance gate and must not be implemented as part of this scope.

## 4. Explicit exclusions

The exclusions in IDEA §4.1 apply. The app has no accounts, uploads, telemetry/ads, cloud-AI fallback, live data, scheduled departures, arrival predictions, arbitrary-address walking router, automatic trip detection or iOS target. Initial corpus review is required; ongoing maintenance planning is deferred. Functional screens precede final visual design.

### 4.1 Must-never rules

IDEA §4.2 is the canonical INV-1–INV-7 wording. SDD §5.1 assigns enforcement; INDEX §3.1 assigns planned negative checks. No shipped-source eligibility flag may be described as field verification.

## 5. Metrics and release evidence

| ID | Metric | Target/evidence |
|----|--------|-----------------|
| PUSANG-GALA-M1 | Required-slot accuracy | ≥90% on ≥50 labelled queries with held-out wording |
| PUSANG-GALA-M2 | Hybrid versus rules baseline | Report accuracy difference, false accepts and follow-up results; investigate no improvement without dropping required conversation |
| PUSANG-GALA-M3 | Unsupported/contradictory AI factual claims displayed | 0 in guard adversarial tests and review of at least 100 generated responses |
| PUSANG-GALA-M4 | Routing + cards after resolution | p95 <500 ms on reference phone |
| PUSANG-GALA-M5 | Complete warm AI explanation | Initial target ≤10 seconds; separately record cold load, intent, first safe chunk and full response |
| PUSANG-GALA-M6 | Concurrent map/GPS/model memory | Provisional peak PSS ≤1 GB on 4 GB reference phone; measure and reconcile the budget before claiming device support |
| PUSANG-GALA-M7 | Unsupported connections/ineligible services displayed | 0 in source-based route fixtures; no field-verification claim |
| PUSANG-GALA-M8 | Judged-app functional completion | All required flows work on unseen supported queries offline; no canned-only demonstration |
| PUSANG-GALA-M9 | Installed footprint | Measure APK, copied assets and data; previous ≤650 MB target is provisional and must account for duplication |
| PUSANG-GALA-M10 | Device compatibility | Working AI on named reference phone; clearly explained fallback on a separately tested unsupported/low-memory phone |
| PUSANG-GALA-M11 | Corpus yield and coverage | Process all 2,186 answered NCR posts; publish inclusion/rejection/review counts and usable coverage, with no fixed route-count target |

Release evidence also includes offline cold restart, permission-denied/no-fix cases, stream cancellation, corrupt assets, changed-pack restoration and a 20-query map/GPS/AI lifecycle run. No gate is currently claimed passed.

## 6. Candidates and deferred research

Semantic/vector retrieval is an engineering candidate if local lexical retrieval fails measured queries; RAG is required regardless of indexing method. An extra embedding model must fit the measured device budget. Play distribution, OTA updates, Firebase and voice selection are later work, not first-release dependencies.

## 7. Execution prerequisites

LOG §2 and TODO §3 track named member assignments, corpus reviewer, exact test phone, dependency/model pins and the local-map feasibility spike. Scope confirmation does not constitute a device benchmark.
