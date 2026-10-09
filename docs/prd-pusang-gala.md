---
spine_type: PRD
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

# Product Requirements: Pusang Gala

**IDEA:** [idea-pusang-gala.md](idea-pusang-gala.md)

---

## 1. Scope statement

**Release 1.0** is an offline Android app. The user asks in Taglish and gets deterministic step cards with signboards, landmarks, walk links and fare ranges, plus a cat-persona text voice. It answers only on verified corridors, starting with Cubao ↔ Antipolo/Masinag, and says "no data yet" everywhere else in Metro Manila and Rizal. It needs no network and no account.

**Release 1.1** adds the offline Metro Manila + Rizal map, foreground GPS, optional Google sign-in, sync of the user's own routes, and community confirmations and submissions. Core use stays offline and account-free.

## 2. Users

| User | Goal | Priority |
|------|------|----------|
| First-time rider on a verified corridor | Get from A to B correctly on the first try | Primary |
| Commuter without data | Get directions with radios off | Primary |
| Returning commuter (1.1) | Keep saved routes and history across phones; help others by confirming routes | Secondary |
| Pack curator (team member) | Turn field checks, community knowledge and submissions into a verified pack | Secondary (internal) |

## 3. Features

The owner set these priorities on 2026-10-09: map and GPS move to 1.1, and accounts arrive with 1.1. `Must-Have` means required for **1.0**. Features scheduled for 1.1 are `Should-Have` and marked "(1.1)".

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| PRD-F1 | Taglish question understanding | Must-Have | Typed Taglish or English questions. A rule parser runs first; if slots are still missing, an on-device model extracts origin, destination, preference and time text. On phones that can't run the model (32-bit Android, under about 3 GB RAM, or too slow), the app runs rules-only with pickers and loses no core function. |
| PRD-F2 | Place resolution with clarification | Must-Have | Resolves extracted text against the pack's places and aliases, with typo tolerance. When a match is ambiguous, it **always** asks the user to choose (INV-6). Explicit origin and destination pickers are always available. |
| PRD-F3 | Verified offline routing | Must-Have | Finds a route over the pack's verified ride legs and walk links. Preferences: cheapest, fewest transfers, or estimated fastest. |
| PRD-F4 | Step cards with provenance | Must-Have | Each step shows mode, signboard, where to board, the alighting landmark, walk text, fare range, last-verified date and sources. Stale data is labelled (INV-5). |
| PRD-F5 | Cat persona (text) | Must-Have | A friendly, human-sounding Taglish cat voice ("pusa") wraps each answer. The persona never changes or adds route facts. |
| PRD-F6 | Offline in-app map | Should-Have | (1.1) A Metro Manila + Rizal map (about 55 MB, z≤15) with stops, verified route geometry and attribution, rendered from local tiles. |
| PRD-F7 | Foreground GPS position | Should-Have | (1.1) Shows the user's position during an active trip, with accuracy and fix age. Stale fixes are labelled last known (INV-5). |
| PRD-F8 | Offline setup and readiness | Must-Have | All assets arrive with the install (APK, or Google Play for the model pack). On first launch the app verifies them and shows readiness per asset. The core app downloads nothing. |
| PRD-F9 | Honest failure states | Must-Have | Clear messages for no coverage ("wala pa kaming data dito"), an ambiguous place, stale data, AI unavailable, map unavailable and GPS unavailable. Manual input always works. |
| PRD-F10 | Corridor pack build tooling | Must-Have | An off-device pipeline that turns curated facts into a validated, versioned pack. Sources: Reddit-derived facts, field surveys, LTFRB fares, OSM and, from 1.1, approved community submissions. |
| PRD-F11 | Community tips ("public opinion") | Should-Have | Paraphrased, team-authored tips and warnings attached to legs and stops, with a "N community mentions" signal and source links. |
| PRD-F12 | Schematic route view | Must-Have | A stop-sequence diagram for every route. In 1.0 it is the only route visual. In 1.1 it is the fallback when the map is unavailable. |
| PRD-F13 | Offline voice output | Could-Have | The persona text is spoken on-device. Owner: this comes after text and everything else are done. |
| PRD-F14 | Google Maps coordinate handoff | Could-Have | Opens a stored boarding or alighting coordinate in the Google Maps app; the user prepares Google's offline area themselves. |
| PRD-F15 | Saved routes and history (local) | Must-Have | Saves origin→destination pairs and chosen routes, and keeps a history of routes looked up or taken (route IDs and dates only, never GPS traces). Stored on-device; no account needed. |
| PRD-F16 | Optional account and sync | Should-Have | (1.1) Google sign-in via Firebase Auth. After sign-in, the user **opts in** to sync PRD-F15 data to the cloud and restore it on a new phone. Includes account deletion in the app and on the web. Never required. |
| PRD-F17 | Route confirmations | Should-Have | (1.1) After a trip: "Gumana ba 'tong ruta?" yes/no. Stored locally; uploaded only when signed in and opted in. Aggregated counts ship in the next pack as "N commuters confirmed". |
| PRD-F18 | Corrections and new-route submissions | Should-Have | (1.1) A signed-in user can submit a correction (fare, stop, signboard) or a new route. Submissions go to a review queue and are **never shown to other users until approved** and published in a pack. Approval method: Q14. |

Priority vocabulary: `Must-Have`, `Should-Have`, `Could-Have`, `Dropped`.

### 3.1 Acceptance criteria

**PRD-F1 — Taglish question understanding**
- Given the labelled query set (at least 50 queries, held-out split included), when the queries are run offline, then exact required-slot accuracy on unambiguous queries is at least 90% (PUSANG-GALA-M1).
- Given a query that the rule parser cannot handle, when the model runs, then it returns schema-valid JSON or times out into the manual pickers. Model output never contains fares, legs or place IDs.
- Hybrid accuracy (rules plus model) beats rules-only accuracy on the held-out set (PUSANG-GALA-M2).

**PRD-F2 — Place resolution with clarification**
- Given every query in the set designated ambiguous or unsupported, when it is resolved, then the app asks a clarifying question or reports no coverage. A clarifying question offers 2–4 choices, each with a landmark or area. The app never silently picks a place.
- Given a one-character typo in a known alias of 5 or more characters, when it is resolved, then the intended place is among the top 3 candidates.

**PRD-F3 — Verified offline routing**
- Given at least 30 expected-route fixtures, when they are routed, then each result matches the expected route or an equally valid one that a reviewer approves.
- Given endpoints that the pack does not connect, or that lie outside verified corridors, when they are routed, then the result is "no route in our data yet". No partial or guessed route is shown.
- Once endpoints are resolved, routing plus card rendering has p95 under 500 ms on the reference phone (PUSANG-GALA-M4).

**PRD-F4 — Step cards with provenance**
- Every rendered card traces to a pack record ID. Every fare shows a range and the date of its fare rule. Every leg shows a last-verified date.
- A leg or fare older than the staleness threshold shows a visible "maaaring luma na" label. The threshold defaults to 180 days and is set in the pack manifest.

**PRD-F5 — Cat persona (text)**
- Given any route answer, when the persona text is produced, then all route facts appear only in deterministic card text. Persona text that contains a number, peso amount, place name, signboard or mode word not present in the cards is rejected and replaced by a template line (PUSANG-GALA-M3).
- When the model is unavailable, persona lines come from a curated template bank and the answer is still complete.

**PRD-F6 — Offline in-app map (1.1)**
- Given the assets are ready, when the app is force-stopped, Wi-Fi and mobile data are turned off and the app is relaunched, then the map renders labels, icons and attribution anywhere within the Metro Manila + Rizal bounds, up to z15.

**PRD-F7 — Foreground GPS position (1.1)**
- Given location services on and network off, when a trip is active outdoors, then the marker updates and shows accuracy and fix age. A fix older than the staleness threshold is labelled last known.
- When location permission is denied, manual origin selection still works.
- Location subscriptions stop when the trip ends or the app is backgrounded, and resume on return.

**PRD-F8 — Offline setup and readiness**
- Each asset (model, route pack, map) shows its size, checksum result and state: ready, failed or missing.
- A missing or corrupt asset is never marked ready. The app degrades to the next device tier (SDD §1.0) instead of crashing.

**PRD-F9 — Honest failure states**
- Each failure state in the feature description has a distinct message and a recovery action. None of them crashes the app.

**PRD-F10 — Corridor pack build tooling**
- The build fails on any of: a leg with an unknown stop, a missing source, coordinates outside the pack bounds, an unverified status, Reddit text, a Reddit username, or an unapproved community submission.
- The build writes a manifest with schema version, coverage (bounds plus the list of verified corridors), creation and verification dates, staleness threshold and a checksum.

**PRD-F11 — Community tips**
- Every tip is a team-authored paraphrase and links to at least one source record. Tips attach only to legs and stops that already exist in the pack.

**PRD-F12 — Schematic route view**
- Every route shows a stop-sequence diagram. In 1.1, with map assets removed, the trip still shows the diagram, labelled "schematic".

**PRD-F13 — Offline voice output**
- `TBD(owner)`: define acceptance after F1–F12 ship. The voice engine needs a licence check first (LOG Q7).

**PRD-F14 — Google Maps coordinate handoff**
- A failed launch keeps the trip. The UI never claims that Google Maps coverage has been verified.

**PRD-F15 — Saved routes and history (local)**
- A saved route survives an app restart and a pack update. If its records no longer exist in a new pack, it shows "nagbago ang ruta, i-check ulit" and is never rendered from stale data.
- History stores route record IDs and timestamps only. A test asserts that no coordinates are stored.
- The user can delete any single item, or all history, on-device.

**PRD-F16 — Optional account and sync (1.1)**
- Every 1.0 feature works for a user who never signs in, including on phones with no Google Play services.
- Nothing is uploaded until the user signs in **and** turns sync on. Turning sync off stops uploads immediately.
- Signing in on a second phone restores saved routes and history.
- Account deletion is available in the app and on a public web page, and removes the user's cloud data (Google Play account-deletion policy).
- On a phone without Google Play services, sign-in is hidden and the app works normally.

**PRD-F17 — Route confirmations (1.1)**
- A confirmation recorded offline is uploaded later only if the user is signed in and opted in.
- At most one confirmation per user per route per day counts toward the aggregate.
- "N commuters confirmed" counts come only from the pack, never from a live query.

**PRD-F18 — Corrections and new-route submissions (1.1)**
- No other user can see a submission in the app until it has been approved and shipped in a pack.
- The only personal data a submission carries is the account UID. The form warns the user not to paste content from Reddit or other sites.
- `TBD(owner)`: the approval workflow (Q14).

## 4. Explicit exclusions

| Excluded | Why | Revisit when |
|----------|-----|--------------|
| Areas outside Metro Manila and Rizal | Focus | Metro Manila corridors are verified |
| Live traffic, vehicle tracking, live ETAs | Requires network and data the product does not have | Never offline; possibly an optional online mode |
| Background tracking, GPS trace recording, arrival alerts | Permission, lifecycle and accuracy risk | Foreground GPS is stable on test phones |
| Live location sharing | Requires network; conflicts with INV-3 | Owner CR only |
| Turn-by-turn walking to arbitrary addresses | Needs an on-device street router | Stored walk links prove insufficient |
| Free-form AI travel advice | Conflicts with INV-1 | Never |
| Shipping Reddit content, or auto-ingesting it | INV-4; Reddit terms | Written agreement with Reddit |
| Google Maps data as a source | Google Maps Platform terms §3.2.3 | Never |
| Mandatory sign-in; a server in the core path | Conflicts with INV-2 | Never |
| Showing unreviewed submissions to other users | Conflicts with INV-1 | Never |
| Speech input | Offline Tagalog STT is heavy (Vosk tl-ph is 329 MB) and accuracy is unproven | Voice output ships |
| iOS | Android-first | Android pilot succeeds |

### 4.1 Must-never rules

| INV-# | The system shall never | Constrains |
|-------|------------------------|------------|
| INV-1 | Display a ride leg, walk link, stop, signboard or fare that is not a record in the installed verified pack, or show a guessed route when none exists | PRD-F1, PRD-F2, PRD-F3, PRD-F4, PRD-F5, PRD-F11, PRD-F15, PRD-F18 |
| INV-2 | Make or require a network request anywhere in the query, routing, card, persona, map-render or GPS path, or fall back to a cloud service. Network is allowed only in the opt-in account module (PRD-F16 to PRD-F18) | PRD-F1, PRD-F3, PRD-F5, PRD-F6, PRD-F7, PRD-F8, PRD-F13, PRD-F16 |
| INV-3 | Transmit location, query text or trip details off the device without sign-in **and** opt-in. Raw query text and GPS coordinates are never transmitted, even with opt-in | PRD-F1, PRD-F7, PRD-F15, PRD-F16, PRD-F17, PRD-F18 |
| INV-4 | Include Reddit comment text or Reddit usernames in the app, the pack, a model training set or the git repo | PRD-F5, PRD-F10, PRD-F11, PRD-F18 |
| INV-5 | Present a stale fare, an unverified leg or an old GPS fix as current | PRD-F4, PRD-F7, PRD-F15 |
| INV-6 | Silently choose among ambiguous place matches | PRD-F1, PRD-F2 |
| INV-7 | Train or fine-tune a model on real route facts | PRD-F1, PRD-F5 |

## 5. Metrics

| ID | Metric | Target | How measured |
|----|--------|--------|--------------|
| PUSANG-GALA-M1 | Exact required-slot accuracy, unambiguous queries | ≥ 90% | Labelled query set, offline on the reference phone |
| PUSANG-GALA-M2 | Hybrid minus rules-only accuracy on held-out queries | > 0, reported with the false-accept rate | Same set, both modes |
| PUSANG-GALA-M3 | Persona outputs that alter or add a fact and reach the screen | 0 | Persona guard tests plus a manual review of 100 outputs |
| PUSANG-GALA-M4 | Routing plus cards p95 after resolution | < 500 ms | On-device timing over the route fixtures |
| PUSANG-GALA-M5 | Warm model extraction latency | < 5 s on the Helio reference phone, with a bounded timeout fallback | On-device timing; cold load measured separately |
| PUSANG-GALA-M6 | Peak app memory (PSS) with map, GPS and inference together | ≤ 1.0 GB on the 4 GB reference phone (provisional; spike S4 confirms) | `adb shell dumpsys meminfo` across 20 queries |
| PUSANG-GALA-M7 | Displayed legs that fail field verification | 0 known | Team rides or walks the corridor; dates recorded |
| PUSANG-GALA-M8 | Testers who would use it instead of posting on Reddit | ≥ 7 of 10 | Pilot survey |
| PUSANG-GALA-M9 | Install size on the device | ≤ 650 MB including the model and the Metro Manila + Rizal map | Android Settings → App info after first launch |
| PUSANG-GALA-M10 | Phones the core experience runs on | Rules-only core on Android 7+ with 2 GB RAM, including 32-bit; AI tier on arm64 with 3 GB+ RAM | Test matrix: reference Helio phone plus at least one 2–3 GB phone |
| PUSANG-GALA-M11 | Verified corridors in the pack | 1 at 1.0; growth tracked per release | Pack manifest |

## 6. Candidates (not decided)

Nothing in this section may be implemented.

| Candidate | Raised by | Notes |
|-----------|-----------|-------|
| Coverage outside Metro Manila (e.g. Cebu, which Sakay.ph doesn't cover) | Reference competitor analysis | After Metro Manila corridors |
| Semantic note retrieval (sqlite-vec plus a small embedding model) | Reference architecture | Only if alias matching proves insufficient |
| Cat sound effects (recorded "meow" audio) | Agent | Owned audio assets; cheap persona boost |
| Over-the-air pack updates for signed-in users | Agent | A new network path; needs review against INV-2 |
| Admin web page for reviewing submissions | Agent | Depends on Q14 |

## 7. Open questions

- `TBD(owner)` Q7: Which engine and voice for voice output? Meta MMS-TTS Tagalog is CC-BY-NC, and the Android system fil-PH voice is device-dependent.
- `TBD(owner)` Q14: How are community submissions approved: team review, or a confirmation threshold plus spot checks?
