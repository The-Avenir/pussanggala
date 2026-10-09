---
spine_type: IDEA
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

# Idea Brief: Pusang Gala

**Scope confirmed by the owner on 2026-10-09 after grilling rounds G01–G27.** This replaces the earlier Cubao–Masinag corridor MVP and optional-AI release split. Implementation and device feasibility remain unproven.

## 1. One-line summary

Pusang Gala is an offline Android commute app for NCR. A commuter asks a short Taglish or English question and receives source-backed route cards, a map and a grounded local-AI conversation with a friendly cat persona.

## 2. The problem

Commuting instructions often depend on signboards, boarding landmarks, transfers and informal services that a rider does not know. Forum answers contain useful knowledge, but are difficult to retrieve during a trip without reliable data. They can also be incomplete, contradictory or old.

The supplied Reddit dataset is input evidence, not an established transit graph. The app must distinguish what the sources support from what remains unknown. The reference [connectivity evidence](reference/pusang-gala-connectivity-evidence.md) and [competitor analysis](reference/pusang-gala-competitor-analysis.md) motivate the problem; their market and demand claims are not measured product outcomes.

## 3. Who it is for

| User | Need |
|------|------|
| First-time NCR commuter | Understand where to board, transfer and alight, with reported fares and uncertainty |
| Commuter without reliable data | Ask questions, read cards and use maps and foreground GPS offline |
| Returning user | Reuse saved routes and restore an interrupted active journey |
| Team corpus reviewer | Resolve ambiguous extracted connections and incomplete instructions before publication |

## 4. Confirmed release boundary

The judged hackathon deliverable is a working app with these integral parts:

- On-device retrieval of structured route facts and paraphrased notes, deterministic rule-based routing, and required local-AI conversation.
- Short journey-focused exchanges: change endpoints or preferences, ask for alternatives or return journeys, clarify boarding, fares and transfers.
- Deterministic cards shown before the streamed grounded explanation; a schematic for every supported itinerary.
- Offline NCR map, mapped journey points, foreground GPS, nearby-origin suggestions requiring confirmation, and manual step progression.
- Saved routes, local history and active-trip recovery through stable record IDs and pack compatibility checks.
- Honest handling of ambiguity, unsupported journeys, old information, conflicts, unknown fares and unknown operating hours.

Both endpoints must be inside NCR. Supported places come from the corpus and aliases; arbitrary addresses require selection of a supported nearby landmark. The app does not invent the remaining walk. Geographic scope does not promise every NCR journey is represented.

Process all **2,186 NCR posts with stored comments** in `howtogetthereph_dataset/ncr_routes.json`. Automated extraction and a second AI pass produce facts, paraphrases and evidence for review. A designated team member resolves remaining ambiguities. Only usable records pass into the pack, and the build reports coverage and rejection counts. There is no predetermined route-count target and no field-verification requirement or verified badge.

Different threads may contribute to an itinerary only where records support boarding, alighting and transfer connections. Source review establishes eligibility for routing; it does not prove that a service currently operates.

## 4.1 Deferred and excluded work

- Accounts, cloud sync, user submissions, confirmations and voice output are deferred; no release number or date is promised for them.
- Maintenance ownership and cadence are deferred at the owner's request.
- Visual design follows functional validation. Figma is WIP and does not define the final UI.
- Departure scheduling, arrival predictions, live traffic and live vehicle tracking are excluded from this release. Reported operating hours may answer time-related questions with dates and uncertainty.
- Background/screen-off tracking, GPS traces, automatic boarding/alighting detection, automatic step advancement and arrival alerts are deferred.
- Arbitrary-address walking navigation, automatic transfer creation from proximity, free-form unrelated chat, Google Maps data as a source, iOS and speech input are excluded.
- Raw Reddit wording and usernames are excluded from the app, runtime retrieval pack and training assets. The supplied dataset remains an off-device build input.
- The core requires no account, network or cloud-AI fallback.

## 4.2 Invariants (must-never rules)

| ID | The product must never | Status |
|----|------------------------|--------|
| INV-1 | Invent a route or add a fact absent from the installed source-backed pack. All boardings, alightings and transfers require supported records; an incomplete itinerary is withheld. | Active |
| INV-2 | Require network for asking, retrieval, routing, conversation, cards, map rendering, GPS or restoration after asset setup; silently use cloud AI. | Active |
| INV-3 | Persist raw conversation text or GPS traces, or transmit user location, queries or trips. This release has no upload path. | Active |
| INV-4 | Bundle raw Reddit wording or usernames in the app, runtime pack or training set. The user-supplied repository dataset is curation input only and is excluded from packaged assets. | Active |
| INV-5 | Present source-backed reports as field-verified/current, conceal age or conflict, turn a missing fare into zero, show an old GPS fix as current, or route through suspended/retired services. | Active |
| INV-6 | Silently select an ambiguous place or GPS-derived origin. Ask the user to choose or confirm. | Active |
| INV-7 | Train or fine-tune the runtime model on real route facts. Route knowledge belongs in the replaceable retrieval pack. | Active |

Source dates are labelled as post dates, not verification dates. Older information remains usable with warnings. Fare/time comparisons state their evidence limits; options with unknown values remain visible.

## 5. Success looks like

Judges can enter unseen questions about supported NCR journeys in airplane mode, ask follow-ups, see actual route cards and a streamed local-AI explanation, use the map/GPS, save a route, and recover a journey after restart. Ambiguous places prompt clarification; unsupported or incomplete journeys receive an honest explanation.

A temporary inference failure leaves route cards usable. A rules-only demo on the reference phone does **not** satisfy the release requirement.

## 6. Constraints

| Kind | Constraint |
|------|-----------|
| Delivery | Judged hackathon app; no fixed deadline was supplied. Build against quality gates rather than an invented six-week schedule. |
| Platform | React Native + Expo Android development build and standalone APK. Exact dependency compatibility must be tested and pinned. |
| Reference device | Previously specified 4 GB RAM / 64 GB storage, MediaTek Helio-class; record exact model, ABI and Android version when benchmarking. |
| AI | Strictly fewer than 1B parameters. Model choice is delegated to measured evaluation; working AI is required on the reference phone. |
| Compatibility | Unsupported phones receive a clearly explained fallback and the other usable features. Do not advertise an untested Android/RAM minimum. |
| Response | Cards first, then streamed explanation. Initial complete warm-response target: 10 seconds, subject to device measurement. |
| Assets | Bundle the corpus, model, map/style/glyphs/sprites for the judged APK. No team download server is required. |
| Licensing | Free/open assets preferred; licences the team can comply with at startup scale are eligible. Avoid assets that prohibit commercial use outright. Record model, source and map attribution before redistribution. |
| Team workflow | Four members, with ownership and dependencies in [TODO.md](TODO.md). Every task uses a branch and PR; no direct work on `main`. |

## 7. Execution prerequisites

Scope decisions are resolved. Exact device details, dependency versions, measured model performance, map format support and the designated reviewer name are execution prerequisites tracked in [LOG](log-pusang-gala.md) and [TODO](TODO.md). They do not reintroduce deferred product features.
