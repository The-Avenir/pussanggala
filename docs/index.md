---
spine_type: INDEX
spine_version: 0.3.0
project: Pusang Gala
slug: pusang-gala
doc_version: 0.4
status: Draft
owner: Salvador Vincent Javier
created: 2026-10-09
updated: 2026-10-09
reconciled: 2026-10-09
---

# Documentation Index: Pusang Gala

**Owner:** Salvador Vincent Javier

**Scope:** Confirmed on 2026-10-09 after G01–G27

**Implementation:** Not started; no device/release gate claimed passed

## 1. Current document suite

| Document | File | Version | Status | Updated/reconciled |
|----------|------|---------|--------|--------------------|
| IDEA — scope and invariants | [idea-pusang-gala.md](idea-pusang-gala.md) | 0.5 | Draft; scope confirmed | 2026-10-09 |
| PRD — features and acceptance | [prd-pusang-gala.md](prd-pusang-gala.md) | 0.5 | Draft | 2026-10-09 |
| SDD — architecture/contracts | [sdd-pusang-gala.md](sdd-pusang-gala.md) | 0.5 | Draft | 2026-10-09 |
| BUILD — stack/workflow/checks | [build-pusang-gala.md](build-pusang-gala.md) | 0.5 | Draft | 2026-10-09 |
| LOG — decisions and evidence | [log-pusang-gala.md](log-pusang-gala.md) | 0.5 | Draft | 2026-10-09 |
| TODO — four-member tasks and PR templates | [TODO.md](TODO.md) | 0.1 | Planning companion | 2026-10-09 |

QA acceptance is in PRD §3.1/§5 and SDD §9. There is no server/OPS dependency in the current offline APK scope. TODO is a planning companion, not a new SPINE document type. The owner's SKIP SPINE instruction remains in effect.

The current docs supersede conflicting scope in [reference/](reference/) and the previous log at commit `3732824`. Reference proposal/architecture/validation/HTML/PDF remain historical evidence; they are not instructions to build Flutter, a 1.5B model, a six-week corridor prototype or optional first-release AI.

[The supplied dataset](../howtogetthereph_dataset/README.md) is raw off-device evidence. Use the actual JSON audit counts in SDD §1.2 and LOG §4 when its summary differs. It is not bundled into the app.

## 2. Reconciliation record

| Date | Change | Documents |
|------|--------|-----------|
| 2026-10-09 | Owner-confirmed NCR working-app scope; required local AI/map/GPS; structured Reddit corpus/review; supported joins; honest warnings/geometry; streamed answers; restore; four-member branch/PR plan | IDEA, PRD, SDD, BUILD, LOG, TODO, INDEX |

No app implementation, schema migration or benchmark is implied by this documentation update.

## 3. Feature traceability

| PRD-F# | Required feature | SDD component | TODO ownership |
|--------|------------------|---------------|----------------|
| F1 | Intent understanding | Normalizer/intent adapter | Member 2 T21, Member 3 T30/T32/T35 |
| F2 | Supported NCR place resolution | Resolver/canonical geography | Member 1 T13, Member 2 T21 |
| F3 | Source-backed offline routing | Graph/search/validation | Member 2 T22/T23/T26 |
| F4 | Cards and provenance | Card composer/evidence | Member 2 T24, Member 1 T14/T15 |
| F5 | Required grounded AI explanation | Model/context/stream guard | Member 3 T30–T35 |
| F6 | Offline map | Local renderer/coordinates/shapes | Member 4 T42 |
| F7 | Foreground GPS | Location/confirmation/lifecycle | Member 4 T43 |
| F8 | Offline assets/readiness | Asset and pack loader | Member 4 T41 |
| F9 | Failure/recovery states | Typed results/app recovery | Member 2 T20, Member 4 T45 |
| F10 | Corpus and pack tooling | Extract/review/builder | Member 1 T10–T16 |
| F11 | Paraphrased notes/warnings | Note retrieval/evidence | Member 1 T11/T14, Member 2 T24 |
| F12 | Schematic | Ordered sequence rendering | Member 4 T42/T45 |
| F15 | Saved routes/history | User store/revalidation | Member 4 T44 |
| F19 | Journey conversation | Session/follow-up manager | Member 3 T32/T35 |
| F20 | Reported-hours questions | Hours/context/rule statements | Member 2 T25, Member 3 T32 |
| F21 | Active-trip recovery | Store/pack compatibility | Member 4 T44, Member 2 T25 |

F13/F14/F16–F18 remain deferred with preserved IDs. No account, voice or user-submission work is included in the current task list.

### 3.1 Invariant traceability

Canonical wording: IDEA §4.2. Enforcement: SDD §5.1. Checks are planned.

| INV | Rule | Negative evidence/task |
|-----|------|------------------------|
| INV-1 | Source-backed facts and complete supported connections | Fabricated/missing leg or walk, reversed instructions; T14/T22/T26/T33/T35 |
| INV-2 | Offline runtime/no cloud fallback | Network-blocked cold-start and required flows; T41/T42/T45/T47 |
| INV-3 | No raw chat/GPS persistence or uploads | Schema/asset/dependency checks, GPS cleanup; T32/T43/T44 |
| INV-4 | No raw Reddit content in shipped/training assets | Leaked wording/user mentions and accidental raw-dataset bundle; T15/T41 |
| INV-5 | Honest source age/conflicts/unknowns/status/fix age | Unknown-as-zero, fake verified date, suspended service and old fix; T23/T24/T43 |
| INV-6 | Clarify ambiguity and confirm GPS origins | Ambiguous alias or automatic origin selection; T21/T43 |
| INV-7 | No real route facts in runtime model training | Optional fine-tune corpus check; T35 if measured need leads to a scoped training PR |

## 4. Health and execution state

- [x] Owner confirmed scope; G01–G27 are reflected in current docs.
- [x] Required features have SDD and four-member TODO ownership.
- [x] All tasks require branches/PRs; TODO contains a Conventional PR body and checklist.
- [ ] Actual member names, designated corpus reviewer and exact phones recorded.
- [ ] Shared schema/API contracts settled in T00.
- [ ] Extracted corpus/pack and actual dependency/model pins implemented.
- [ ] Native map/GPS/AI compatibility and memory/latency measured.
- [ ] Full offline release acceptance completed.

## 5. Notes

Versions are design-document versions, not app releases. Draft indicates unimplemented/unmeasured design details, not unresolved product scope. Do not reintroduce a SPINE lock or checkpoint approval requirement against the owner's session instruction.

Working implementation uses [TODO §2](TODO.md) for branches/PRs and [BUILD §6](build-pusang-gala.md) for done criteria. Historical references remain unchanged.
