---
spine_type: IDEA
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

# Idea Brief: Pusang Gala

---

## 1. One-line summary

Pusang Gala is an offline, conversational commute guide with a cat mascot (*pusa*). A Filipino commuter asks "Paano pumunta sa…?" in Taglish and gets the right jeep, signboard, boarding point, transfer, alighting landmark and fare range. It works with no mobile data.

## 2. The problem

Most route apps don't cover informal transit: jeepneys, UV Express, tricycles and provincial buses. The knowledge needed to ride them is tacit:

- the text on the signboard
- unofficial stops
- landmarks such as "baba sa may Jollibee"
- current fares

That knowledge lives in people's heads and in forum threads like r/HowToGetTherePH (about 297k members, an unverified secondary figure).

The current workaround is to post a question and wait hours for an answer, or to ask strangers on the street. Both fail when the commuter has no data, rations prepaid load, or is in a dead zone, which is exactly when they need directions. Cloud chat assistants and online route planners fail in the same conditions. Evidence for this is in [reference/pusang-gala-connectivity-evidence.md](reference/pusang-gala-connectivity-evidence.md) and [reference/pusang-gala-competitor-analysis.md](reference/pusang-gala-competitor-analysis.md).

## 3. Who it is for

| User | What they need | How they work around it today |
|------|----------------|-------------------------------|
| First-time rider on a corridor (student, new worker, visitor) | Which vehicle and signboard to take, where to board and alight, the fare | Posts on r/HowToGetTherePH, asks strangers, guesses |
| Commuter without reliable data | Directions that work offline | Screenshots old answers, or memorizes the route beforehand |
| Regular commuter facing a change (new destination, disruption) | Alternatives on routes they already know, plus local tips | Asks friends or family; trial and error |

## 4. Out of scope

These are explicit non-goals. None of them may appear in the PRD, the SDD or the code without a change record.

Confirmed by the owner on 2026-10-09.

- Coverage outside Metro Manila and Rizal in this phase. Within that area, routes are answered only where a corridor has been verified; the first is Cubao ↔ Antipolo/Masinag. Everywhere else the app says it has no data yet.
- Live traffic, vehicle tracking, live ETAs or queue lengths.
- Background or screen-off location tracking, GPS trace recording, and automatic "get off now" alerts.
- Live location sharing with other people.
- Turn-by-turn walking navigation to arbitrary addresses.
- Free-form AI travel advice that isn't tied to a verified route.
- Automatic ingestion of forum or Reddit content into the shipped product. Community data is curation input only.
- Using Google Maps data (tiles, places, routes) as a data source.
- Mandatory accounts, and any server the core experience depends on. Accounts are optional and come later (see PRD); the core never needs sign-in.
- Showing unreviewed community submissions to other users.
- Speech input (speech-to-text). Spoken output is deferred, not excluded (see PRD).
- iOS in this phase.

### 4.1 Invariants (must-never rules)

The owner chose INV-1 to INV-4 on 2026-10-09 and added INV-5 to INV-7 the same day. Each one traces to the place it is enforced and to a negative test that tries to break it (`INDEX` §3.1).

| ID | The product must never | Why | Status |
|----|------------------------|-----|--------|
| INV-1 | Invent a route. Every ride leg, walk link, stop, signboard and fare shown to the user must exist in the installed verified pack. When none exists, the product says it has no data instead of guessing. | A wrong route strands a real person; trust is the product | Active |
| INV-2 | Require a network connection for the core experience (asking, resolving places, routing, step cards, persona text, the offline map, GPS position) once setup is complete, or silently fall back to a cloud service. | The target user has no data exactly when they need help | Active |
| INV-3 | Send the user's location, queries or trip details off the device unless the user explicitly opts in. | Privacy; Data Privacy Act exposure; the offline promise | Active |
| INV-4 | Ship or commit Reddit comment text or Reddit usernames. Only extracted facts plus a source link may be kept. | Reddit's terms and copyright in the wording; DPA risk from identifiable users | Active |
| INV-5 | Present a stale fare, an unverified leg, or an old GPS fix as current. Every fact shows its age or status, and stale data is labelled. | Fares change (the 2026-09-28 increase, a possible rollback); old fixes mislead | Active |
| INV-6 | Silently pick a place when a match is ambiguous. The product always asks the user to choose. | A wrong "SM" sends a person to the wrong city | Active |
| INV-7 | Put route facts (legs, stops, signboards, fares) into model weights. Fine-tuning data contains no real route facts; facts live only in the pack. | Stale facts baked into weights can't be updated or traced; protects INV-1 | Active |

Status vocabulary: `Active`, `Retired`.

## 5. Success looks like

- A first-time rider in airplane mode asks a Taglish question about the pilot corridor and gets a correct, field-verified answer: signboard, boarding point, alighting landmark and fare range.
- When the product doesn't know, it says so or asks a clarifying question. It never picks a wrong place or invents a leg.
- Testers describe the cat persona as friendly and "human-sounding", and it never obscures or contradicts the route facts.
- People who would otherwise post on r/HowToGetTherePH would use it instead.

## 6. Constraints

| Kind | Constraint | Source |
|------|-----------|--------|
| Time | No fixed deadline. Ship as fast as possible, with quality gates instead of time-boxes, to avoid rushed or hallucinated work | Owner, 2026-10-09 |
| Platform | Android first. **Reach as many phones as possible.** Reference phone: 4 GB RAM, 64 GB storage, a budget MediaTek Helio-class chip (exact model unknown). Everything runs on-device | Owner, 2026-10-09 |
| Platform | On-device language model, **strictly fewer than 1B parameters** (hard limit). Model choice is delegated to the agent | Owner, 2026-10-09 |
| Coverage | **Metro Manila + Rizal** map coverage. Route data grows one verified corridor at a time, starting with Cubao ↔ Antipolo/Masinag, which someone must physically verify | Owner, 2026-10-09 |
| Data | Reddit (r/HowToGetTherePH) is curation input only. Google Maps is not a data source (Google Maps Platform terms §3.2.3 restrict scraping and caching) | Owner, 2026-10-09; https://cloud.google.com/maps-platform/terms |
| Team | Implementation is delegated to AI coding agents. Any stack is acceptable if agents know it and it is verified to work end to end | Owner, 2026-10-09 |
| Cost | Free and open source preferred; the team may use any available tech. A commercial launch is possible after the hackathon. **License rule (relaxed 2026-10-09):** any license the team can comply with at startup scale is acceptable, including revenue-threshold licenses (e.g. LFM Open License, free under $10M/yr) and use-policy licenses (Gemma). Only licenses that forbid commercial use outright (CC-BY-NC, research-only) are avoided for anything shipped | Owner, 2026-10-09 |

## 7. Open questions

Each question is mirrored in `LOG` §2.

- `TBD(owner)` Q14: Who approves community submissions before they reach the pack (team review, or a confirmation threshold plus spot checks)? This blocks the moderation part of community contributions.
