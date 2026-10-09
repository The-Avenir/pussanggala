---
doc_type: UX walkthrough
project: Pusang Gala
status: Draft
created: 2026-10-09
inputs: IDEA/PRD/SDD/BUILD/LOG/TODO v0.5, Figma "Pusang Gala / Sunset Playful Mockups" (9 screens, WIP)
---

# App Walkthrough: Pusang Gala

This is the screen-by-screen basis for UI/UX work. It defines each functional page: its purpose, entry and exit points, the data shown, the states to design, and the rules it must respect. Visual style, layout and copy polish belong to the design team (TODO T46). This document sets what each screen must do and what it must never claim.

Sources: [PRD](prd-pusang-gala.md) (features F1–F21), [SDD](sdd-pusang-gala.md) (data model and pipeline), [IDEA §4.2](idea-pusang-gala.md) (INV-1–INV-7), and the WIP Figma canvas. Where this document and the Figma disagree, this document follows the confirmed scope (see §6).

## 1. Ground rules every screen inherits

| Rule | What it means on screen | Source |
|------|-------------------------|--------|
| Offline first | After install, asking, routing, cards, AI, map, GPS and restore work in airplane mode. No spinner may wait on the network. | INV-2, F8 |
| Facts come from the pack, not the AI | Route steps, fares, signboards and times render as deterministic **cards**. The AI text explains the cards and can never add a step. | INV-1, F4, F5 |
| Unknown is shown as unknown | A missing fare reads "Fare not reported", never ₱0. A missing time reads "Time not reported". | INV-5 |
| Community-reported, not verified | Use "reported" and "as of [post date]". Never "verified", "last checked", "live" or "current". | INV-5, F4 |
| Ask, don't guess | Ambiguous places and GPS-suggested origins always need a user tap to confirm. | INV-6 |
| Nothing private is stored | Chat text and GPS coordinates stay in memory. Saved routes store IDs only. | INV-3 |
| NCR only | Both endpoints must be inside NCR (Metro Manila's 16 cities + Pateros). | F2 |

## 2. Screen map and navigation

```text
[0 Launch / readiness]
        │
[1 Welcome + Sign in with Google]──(Continue without account)──┐
        │                                                       │
        ▼                                                       ▼
┌──────────────────────── Main shell (bottom navigation) ───────────────────────┐
│  Ask (3)            Map (8)            Saved (11)            Profile (12)       │
└────────────────────────────────────────────────────────────────────────────────┘
  3 Conversation ──► 4 Clarify (place / origin) ──► 3
  3 ──► 5 Response (cards + streamed explanation)
  5 ──► 6 Route options (Cheapest · Fastest · Fewest transfers)
  5/6 ──► 7 Route details (step-by-step) ──► 8 Map / Schematic
  7 ──► 9 Commute progress (active trip) ──► 10 Trip complete
  12 Profile ──► 13 Settings ──► 13a Offline data · 13b Privacy · 13c About & attribution
  Any screen ──► 14 Error / recovery states
```

Bottom navigation has four tabs: **Ask**, **Map**, **Saved**, **Profile**. While a trip is active, a persistent **active-trip banner** ("On the way to One Ayala · Step 2 of 4") sits above the tab bar on every tab and opens screen 9.

## 3. Worked example used throughout

All example values below come from a single journey. In the app, every value would come from the installed pack (source-reported, dated). These figures were checked against current public fare information so the mock-ups look realistic; the pack still overrides them.

**Journey:** LRT-1 Monumento (Caloocan) → One Ayala (Makati). Both endpoints are in NCR, and the supplied dataset contains this question and its reverse with multi-option answers.

**Example queries:** "Paano pumunta sa One Ayala galing Monumento?" · "Pinakamura papuntang Ayala galing Monumento, ayoko ng maraming lipat." · Follow-ups: "Pauwi naman?" · "May mas mura ba kesa Carousel diretso?"

| Option | Legs (in order) | Fare (₱) | Time | Rides / transfers | Badges |
|--------|-----------------|----------|------|-------------------|--------|
| A. Carousel + MRT-3 | 🚶 LRT-1 Monumento to the Carousel Monumento stop → 🚌 EDSA Carousel southbound (signboard: PITX) from Monumento to North Avenue → 🚶 walk to MRT-3 North Avenue station (about 5–10 min) → 🚆 MRT-3 southbound from North Avenue to Ayala (10 stations; One Ayala connects to the station) | Carousel ≈19–20 + MRT-3 24 (12 with the 50% rider discount) = **≈31–44** | ≈45–65 min | 2 rides / 1 transfer | Lowest reported fare · Shortest reported time |
| B. Carousel direct | 🚶 to the Carousel Monumento stop → 🚌 EDSA Carousel southbound from Monumento to the One Ayala stop | **≈59** | ≈50–80 min | 1 ride / 0 transfers | Fewest transfers |
| C. LRT-1 + MRT-3 | 🚆 LRT-1 southbound from Monumento to EDSA → 🚶 walk the EDSA–Taft link (about 10–15 min) → 🚆 MRT-3 northbound from Taft Avenue to Ayala (2 stations) | LRT-1 ≈36 (beep) / ≈40 (single journey) + MRT-3 13 (6.50 discounted) = **≈43–53** | ≈55–75 min | 2 rides / 1 transfer | none |

How this exercises the UI:
- **Cheapest and Fastest overlap** (both are option A). Option A therefore shows two badges and B shows "Fewest transfers". This is the §6 rule "do not invent fake alternatives".
- **Overlapping time ranges** (A: 45–65, B: 50–80). The Fastest badge must read "Shortest reported time" with the footnote "Times are reported ranges and overlap", never "fastest guaranteed".
- **Fare conflict demo:** the MRT-3 leg can carry two dated reports, ₱24 before the March 2026 discount and ₱12 after it. The card shows both with dates and does not average them.
- **Reverse trip** ("Pauwi naman?") is a separate directed search: MRT-3 northbound from Ayala to North Avenue then the Carousel northbound to Monumento, or the direct Carousel northbound from One Ayala. It is not option A reversed.

Fact check (public sources as of 9 Oct 2026; for mock-up realism only):
- MRT-3 fare is ₱13 for 1–2 stations and ₱24 for 8–10 stations ([MRT-3](https://en.wikipedia.org/wiki/MRT_Line_3_(Metro_Manila))). A 50% fare discount for all MRT-3 and LRT-2 riders started 23 Mar 2026 ([GMA](https://www.gmanetwork.com/news/topstories/nation/981000/longer-queues-observed-as-50-discount-on-mrt-3-lrt-2-rides-start/story/)); it does not cover LRT-1.
- LRT-1 fare is ₱16.25 boarding plus ₱1.47/km since 2 Apr 2025 ([GMA](https://www.gmanetwork.com/news/money/companies/936567/lrt1-fare-hike-to-take-effect-on-april-2/story/)). Station kilometre posts are from [LRT-1](https://en.wikipedia.org/wiki/LRT_Line_1_(Metro_Manila)).
- EDSA Carousel fare is ₱18 for the first 5 km plus ₱2.98/km ([MSN/LTFRB](https://www.msn.com/en-ph/money/general/ltfrb-approved-fare-hike-for-edsa-busway-at-p18/ar-AA2daJjc)). Monumento, North Avenue and One Ayala are on the southbound stop list ([EDSA Carousel](https://en.wikipedia.org/wiki/EDSA_Carousel)).
- Jeepney minimum fares rose to ₱14 (traditional) and ₱17 (modern) on 28 Sep 2026 ([Philstar](https://www.philstar.com/headlines/2026/09/27/2559277/jeepney-fares-p14-starting-sept-28-buses-taxis-tnvs-also-hike-rates)). No jeepney leg is used in this example.
- **Not verified:** the station-pair fares for Carousel (≈19–20, ≈59) and LRT-1 (≈36/40) are computed from the published formulas because the official matrices are images. Whether the MRT-3 discount still applies today, and all travel times, are also unverified; the times come from community answers and are not official. The pack's dated reports replace every figure here.

## 4. Screens

### 0. Launch and readiness check

**Purpose:** confirm that the bundled model, route pack and map files are present and intact before the user relies on them (F8).

**Shows:** the mascot splash, then a short checklist when something is not ready:

| Asset | States |
|-------|--------|
| Route pack | Verifying → Ready / Failed (checksum or schema mismatch) |
| AI model | Verifying → Ready / Failed / Not supported on this phone |
| Offline map | Verifying → Ready / Failed |

**Behaviour:**
- Every asset ready: the splash closes automatically (target under 2 s; it is a local file check).
- An asset failed: show which one and what still works. A failed map still allows cards and the schematic. A failed model still allows cards with the template explanation (see 14). A failed pack blocks routing and shows a reinstall instruction.
- There is **no download button**. All assets ship inside the APK (F8). The Figma "Offline downloads / corridor / ~80 MB / Coming soon" screen is replaced by this readiness check and by Settings → Offline data (13a).

**Exit:** first launch → 1 Welcome. Later launches → 3 Conversation, or 9 Commute progress if an active trip is restored.

### 1. Welcome and Sign in with Google

**Purpose:** introduce the cat buddy and offer sign-in.

**Shows:** mascot, the name "Pusang Gala", the tagline "Kahit saan ang lakbay, handang pumatnubay.", a primary **Sign in with Google** button, and a secondary **Continue without an account** link.

> **Scope flag (needs owner decision before build).** Accounts are deferred in the confirmed scope (PRD-F16, LOG G07: "no Firebase/account modules in the judged app"), and Google sign-in requires internet. To add it without breaking INV-2 and the judging scenario, this walkthrough designs it as:
> - **Optional and never a gate.** "Continue without an account" leads to the same full app. Judges in airplane mode must be able to use everything.
> - **Online only at the moment of sign-in.** Offline, the button shows "Sign-in needs internet. You can continue and sign in later from Profile."
> - **Identity only.** It stores display name, email and avatar on the device for the Profile screen. It does not sync trips, upload queries or send location (INV-3). Sync stays deferred.
> - Record the decision in LOG §1 and update PRD-F16 before implementation. If the owner keeps accounts deferred, ship this screen with only the Continue button.

**States:** default · signing in (system Google account picker) · signed in (avatar + "Welcome, [first name]") · offline · sign-in cancelled or failed (inline message, Continue still available).

**Exit:** → 3 Conversation. On first entry, show a single one-line hint card: "Ask in Taglish or English. Example: *Paano pumunta sa One Ayala galing Monumento?*"

### 2. Location permission (just-in-time, not a screen in the flow)

Do not ask for location at first launch. Ask the first time the user taps **Use my location** (3) or opens **Map** (8). A short primer sheet appears before the Android system dialog: "Pusang Gala uses your location only while the app is open, to suggest a nearby starting point and show you on the map. It stays on your phone." Options: **Allow** → system dialog; **Not now** → manual input continues (F7, INV-3).

### 3. Conversation (Ask tab — home)

**Purpose:** the main way in. The user asks a short commute question and has a journey-focused conversation (F1, F19).

**Layout:** this follows the pattern of mobile AI assistants. The newest message is at the bottom and the composer is pinned above the keyboard.

- **App bar:** mascot avatar + "Pusang Gala", an offline-ready chip ("Offline · ready"), and a **New trip** action (clears the conversation and the current-trip state).
- **Empty state:** greeting ("Saan tayo pupunta?"), three tappable suggestion chips built from real pack places (e.g. "Monumento → One Ayala", "Quiapo → Divisoria", "Pauwi from work"), and a line "Your questions stay on this phone."
- **Message list:** user bubbles on the right. Assistant turns on the left are made of (a) deterministic cards and (b) streamed explanation text (see 5).
- **Composer:** text field "Ask Pusang Gala anything…", a **Use my location** button (fills the origin, see 4b) and Send. There is no microphone: speech input is excluded.
- **Context chips** above the composer once a trip is in context: `From: LRT-1 Monumento ✎` `To: One Ayala ✎` `Preference: Any ▾`. Tapping one edits that slot without retyping. This is the manual place-selection fallback required by F1.

**Supported follow-ups** (F19), each producing a fresh rule-based result:

| User says | Result |
|-----------|--------|
| "Pauwi naman?" / "Reverse" | New directed route One Ayala → Monumento. It is never the old steps reversed. |
| "May mas mura ba?" | Re-ranks to lowest reported fare and states the comparison set |
| "Ilang sakay?" / "Fewest transfers" | Re-ranks by number of rides |
| "Sa Glorietta na lang" | Changes the destination, re-resolves and reroutes |
| "Saan ako bababa?" | Answers from the alighting card of the selected route |
| "Anong oras last trip?" | Reported hours with date, or "Not reported" (F20) |
| Unrelated ("Sino nanalo sa laro?") | One-line redirect: "Pang-commute lang ako, pero tara, saan ka pupunta?" |

**States:** empty · typing · understanding (short "Iniisip ko…" indicator, under 1 s target) · clarification needed (→ 4) · answer (→ 5) · outside NCR / unsupported / no route (→ 14).

### 4. Clarification sheets

These are bottom sheets that open over the conversation. The conversation keeps its context. Each sheet requires a tap and never auto-selects (INV-6).

**4a. Which place?** Shown for an ambiguous alias or a low-confidence match. It lists 2–4 candidates, each with an area/landmark subtitle (e.g. "SM City North EDSA · Quezon City" vs "SM City Manila · Ermita, Manila"), plus **None of these** → free search of supported places. Typo matches show "Did you mean…?".

**4b. Start from here?** Shown after **Use my location**. It lists the nearest *supported* places (with mapped coordinates), each with a distance and the fix quality: "Within ~40 m · fix 12 s ago". If the accuracy is poor or the fix is old, it shows "Location is rough (±300 m). Pick your starting point." and lists no automatic default. **Confirm** sets the origin chip. Permission denied → message plus manual entry.

**4c. Nearest supported landmark.** Shown when the user types an arbitrary address ("Blk 5 Lot 3 Mabini St"). "I don't have routes from that exact address. Pick a nearby landmark I know:" followed by supported places. The app does not invent the walk from the address (F2).

### 5. Response display (assistant answer)

**Purpose:** answer "how do I get there" with source-backed facts first, then the cat's explanation (F4, F5). This is the most important screen.

**Order of appearance:**
1. **Route summary card** appears as soon as routing finishes (target under 500 ms after the places are resolved).
2. **Explanation text** streams underneath in short validated chunks (initial target: complete within 10 s). It never shows raw tokens.

**Route summary card contents:**

| Field | Example | Rule |
|-------|---------|------|
| From → To | LRT-1 Monumento, Caloocan → One Ayala, Makati | Canonical place names |
| Preference tag | "Lowest reported fare among 3 options" | Qualified claim, never "cheapest guaranteed" |
| Leg strip | 🚶 → 🚌 EDSA Carousel → 🚶 → 🚆 MRT-3 | Mode icons in order, one per ride/walk |
| Rides / transfers | 2 rides · 1 transfer | Count of boardings minus one = transfers |
| Total fare | "₱31–44 reported" or "₱20 + 1 ride not reported" | A total appears only if every ride has a fare report; otherwise "₱X + 1 ride not reported" |
| Est. time | "about 45–65 min (reported)" or "Time not reported" | Sum only when all parts are known |
| Source line | "Community reports · posted Jun–Sep 2026" | Post dates, not verification |
| Warnings | ⚠ "Some reports are over 180 days old" / "Reports disagree on fare" | Shown when applicable |
| Actions | **Start trip** · **See steps** · **Other options** · **Save** ☆ | |

**Explanation text** (cat voice, short Taglish/English). It may only restate, compare or contextualise what is on the cards, for example: "Ito yung pinakamura at pinakamabilis sa mga reported na option: Carousel ka muna hanggang North Avenue, tapos lipat sa MRT-3 hanggang Ayala. Isang lipat lang. Kung ayaw mo ng lipat, may diretsong Carousel pero mas mahal." Every place, ride and comparison in that text ("North Avenue", "MRT-3", "Ayala", "isang lipat", "mas mahal") must match the cards or a rule-produced comparison.

**Streaming states:** streaming (a small "Pusang Gala is explaining…" with a **Stop** button) · complete · stopped by user ("Stopped. Cards above are complete.") · inference failed ("I couldn't finish the explanation. **Retry**") with the cards untouched · AI unavailable on this phone (a template summary built from the cards, labelled "Basic summary").

**Quick-reply chips** under the answer: `Cheaper?` `Fewer transfers?` `Pauwi?` `Last trip?`. Each is a follow-up shortcut to 3.

### 6. Route options: Cheapest · Fastest · Fewest transfers

**Purpose:** compare the alternative complete itineraries (F3). This keeps the three-way choice from the Figma "Route options" screen, with honest labels.

**Layout:** header "Monumento → One Ayala"; a segmented control **Cheapest | Fastest | Fewest transfers**; a list of option cards ranked by the selected criterion. The best match for the criterion carries a badge.

**Option card:** title (e.g. "Carousel + MRT-3"), leg strip, fare, time, rides/transfers, warnings, and **View steps**.

**Ranking rules the UI must express:**

| Tab | Ranks by | Badge text | When values are missing |
|-----|----------|-----------|--------------------------|
| Cheapest | Lowest *reported* total fare | "Lowest reported fare" | Options with unknown fare are listed below a divider: "Fare not fully reported" |
| Fastest | Shortest *reported* total time | "Shortest reported time" | Unknown-time options go below "Time not reported" |
| Fewest transfers | Fewest boardings (always known) | "Fewest transfers" | Ties broken by lowest reported fare, then time |

- A footnote always states the comparison set: "Compared among 3 of 4 options with full fare reports."
- If one option wins all three, show it once with all three badges. Do not invent fake alternatives.
- If only one complete itinerary exists, hide the segmented control and show "1 supported route found".
- Footer: "Fares and times are community-reported as of the dates shown. Check signboards and ask the driver/conductor."

**Exit:** tap an option → 7 Route details. The chosen preference also updates the Preference chip in 3.

### 7. Route details (step-by-step)

**Purpose:** what to do at each point of the journey: where to walk, what to board, which signboard to look for, where to get off (F4, F11).

**Header:** "Monumento → One Ayala · Step list", total fare/time, a **Map / Schematic** toggle (→ 8), and ☆ Save.

**Step cards** (one per walk or ride, numbered):

| Step type | Content |
|-----------|---------|
| 🚶 Walk | Reported walk instruction (e.g. "From the North Avenue Carousel stop, walk to MRT-3 North Avenue station"), reported distance/minutes or "distance not reported" |
| 🚆/🚌/🚐/🛺 Ride | Mode, line or **signboard** in a large "LOOK FOR THIS SIGNBOARD" panel (when reported), board at, get off at, fare report(s) with date, reported ride time |
| ↔ Transfer | An explicit walk link between two stops, only when a source supports it |
| 🏁 Arrive | Destination landmark |

**Supporting content per step:**
- **Tips** (paraphrased community notes, never quotes): e.g. "Riders say the Carousel queue at Monumento is long at rush hour; allow extra time."
- **Conflict display:** "Fare reports differ: ₱12 (Jul 2026) · ₱24 (Feb 2026)." Both are shown; they are never averaged.
- **Age warning** on reports older than 180 days.
- **Source** link per card: "Reported in r/HowToGetTherePH · posted 14 Aug 2026 · Open source" (opens the browser only on an explicit tap; it is never required).
- **Reported hours** on a ride step when available: "Reported first/last trip: 4:30 AM–10:30 PM (posted May 2026)".

**Primary action:** **Start trip** → 9.

Remove from the Figma: "follow the verified walk" and "Route notes · last checked in the corridor". Replace them with "reported walk" and "Reported as of [date]".

### 8. Map and Schematic (Map tab)

**Purpose:** see where the journey points are and follow along, fully offline (F6, F12).

**8a. Map view.** Local NCR basemap (MapLibre, bundled tiles) showing:
- Pins for board, transfer and alight points **that have coordinate evidence**, numbered to match step cards.
- Connectors between pins drawn **dashed** with the label "Schematic · not the actual road path". A solid line appears only for a source-backed path.
- The user's position as a blue dot with an accuracy circle, plus a chip "Updated 8 s ago · ±15 m". After 60 s without a fix, it changes to "Last known position · 2 min ago".
- Controls: Recenter, Show whole route, **Schematic** toggle.
- An "Unmapped: Gate 3 waiting shed" list item for points without coordinates. These stay in the step list.
- The map attribution is always visible ("© OpenStreetMap contributors" or as licensed).
- Without an active route, the Map tab shows the basemap with the user's position and supported places nearby (tapping one offers "Start from here" / "Go here", both through the confirmation sheet 4b).

**8b. Schematic view.** A vertical stop sequence: board → (intermediate stops if reported) → transfer → alight, with mode icons and line colours. Label: "Stop order only · not to scale". It works even if map assets failed.

**States:** map ready · map failed (auto-switch to schematic with "Map unavailable on this device. Showing stop diagram.") · location off/denied (no blue dot, "Turn on location" chip).

### 9. Commute progress (active trip)

**Purpose:** a glanceable companion while travelling. Steps advance manually and the trip survives an app restart (F7, F21).

**Layout:**
- **Top:** "On the way to One Ayala" · "Step 2 of 4" progress bar.
- **Current step card:** large and readable on a moving vehicle. Example: "Ride EDSA Carousel southbound (PITX) · Get off at **North Avenue**", with the signboard panel and the reported fare for this ride.
- **Next up:** a compact preview of the following step.
- **Mini map / schematic:** current step highlighted, user dot when location is on.
- **Location status line:** "Location on · app open · ±15 m · 6 s ago" or "Location paused".
- **Primary button:** **I'm here — next step** (manual advance). A secondary **Back a step**.
- **Ask about this trip** shortcut → 3 with the trip in context ("Saan ako lilipat sa MRT?").
- **Overflow:** End trip, Save route, View all steps.

**Rules:**
- No automatic "you've arrived" detection, no arrival alerts, no background or screen-off tracking. Location pauses when the app goes to the background and resumes on return (F7).
- Explain this once in the UI: "Keep the app open to see your position. Tap Next when you reach each point."
- The trip is restored after the app is killed or the phone restarts. On relaunch: "Continue your trip to One Ayala? Step 2 of 4" → Continue / End. If the pack changed and a step no longer exists: "This route changed since you started. **Re-plan from here**" (F21).

### 10. Trip complete

**Purpose:** close the trip cleanly.

**Shows:** mascot celebration, "Nakarating ka! Monumento → One Ayala", the steps taken, and actions **Save this route** (if not saved), **Plan return trip** (→ 3 with the reverse request), and **Done** (→ 3, context cleared). The trip is added to History as "taken". Location stops.

### 11. Saved and History (Saved tab)

**Purpose:** reuse routes without typing (F15).

- **Saved routes:** user-labelled cards ("Papasok sa office") showing From → To, preference, last-used date. Tap → revalidates against the installed pack → 7 Route details (or "This route needs re-planning" if records changed). Swipe or overflow to rename or delete.
- **History:** "Looked up" and "Taken" entries with date and From → To. Delete one, or **Clear all history** (with confirmation).
- Empty state: "Save a route with ☆ to find it here."
- Stores IDs, preference and timestamps only. No chat text and no GPS (INV-3).

### 12. Profile (Profile tab)

**Purpose:** the user's identity and personal summary.

- **Signed in:** Google avatar, name, email (local copy), **Sign out**.
- **Not signed in:** mascot avatar "Commuter", **Sign in with Google** (needs internet).
- **Your trips, on this phone:** counts of saved routes and trips taken (computed locally).
- **Shortcuts:** Saved routes, History, Settings (→ 13), Help & tips (how to read cards, what "reported" means).
- **Line at the bottom:** "Your trips and location never leave this phone."

### 13. Settings

| Section | Items |
|---------|-------|
| Trip preferences | Default preference (Any / Cheapest / Fastest / Fewest transfers); walking: show distance in m/min |
| Language & assistant | Reply language (Taglish / English); cat persona on/off (plain mode); text size |
| Location | Permission status with a link to Android settings; "Use location only while the app is open" (fixed, informational) |
| 13a Offline data | Route pack: version, build date, source date range ("Reports posted Apr–Oct 2026"), size, status. AI model: name, size, status, "Supported on this phone: Yes/Limited/No". Map: coverage "NCR", size, status. **Re-check files** button. No download or update button. |
| 13b Privacy & data | What is stored (saved routes, history, settings) and what is not (chat, GPS); **Delete all my data** |
| 13c About & attribution | App version, data source ("Community reports from r/HowToGetTherePH, paraphrased"), map and model licences and attribution, "Information is community-reported and may be outdated." |
| Account | Sign in / Sign out (only if the sign-in scope flag in 1 is approved) |

### 14. Error and recovery states

Each failure has its own message and recovery action (F9). They appear inline in the conversation unless noted.

| Situation | Message (example) | Recovery |
|-----------|-------------------|----------|
| Outside NCR | "Antipolo is outside Metro Manila. I only have NCR routes for now." | Edit destination |
| Unsupported place | "I don't have routes for 'Tita's house' yet." | Pick a supported landmark (4c) |
| Ambiguous place | → sheet 4a | Choose |
| No connected route | "I know both places, but no reported route connects them yet." | Try a nearby landmark; change one endpoint |
| Conflicting reports | Shown on the card, not an error | Shows both values with dates |
| Old reports | ⚠ badge "Reported over 180 days ago" | Still usable |
| Fare/hours unknown | "Fare not reported" / "Hours not reported" | None needed |
| AI failed mid-answer | "Couldn't finish explaining." | Retry; cards stay |
| AI unsupported on phone | "Smart explanations aren't available on this phone. Route cards still work." | Basic summary |
| Map assets failed | "Map unavailable." | Schematic view |
| Location denied/off/no fix | "Location is off. Type or pick your starting point." | Manual entry; open settings |
| Pack missing/corrupt | Full-screen at launch: "Route data is damaged. Please reinstall the app." | Reinstall |
| Restored trip invalid | "This route changed since you started." | Re-plan from here |

## 5. End-to-end happy path (judging script)

1. Open the app in airplane mode → readiness passes → Welcome → **Continue without an account** (or a Google sign-in done earlier while online).
2. Type "Paano pumunta sa One Ayala galing Monumento?" → places resolve → the route summary card appears → the explanation streams in.
3. Tap **Other options** → switch Cheapest / Fastest / Fewest transfers and read the qualified badges.
4. Pick an option → step-by-step → toggle Map ↔ Schematic.
5. **Start trip** → Commute progress → tap **Next step** twice → force-close the app → reopen → **Continue your trip**.
6. Ask "Pauwi naman?" → a new reverse route appears. ☆ Save it.
7. Saved tab shows the route; Profile → Settings → Offline data shows all assets Ready.

## 6. Corrections to the current Figma (WIP)

| Figma element | Problem | Change to |
|---------------|---------|-----------|
| Cubao → Masinag example throughout | Masinag (Antipolo) is in Rizal, outside NCR. The app would refuse this trip. | Use an NCR→NCR example (§3) |
| "Cubao–Masinag · ready offline" chip | Corridor model is superseded | "Offline · ready" (whole NCR pack) |
| 06 Offline downloads, "~80 MB · one corridor", "More corridors · Coming soon" | No in-app downloads; no corridors | Readiness check (0) + Settings → Offline data (13a) |
| "follow the verified walk", "last checked in the corridor" | Implies field verification (INV-5) | "reported walk", "Reported as of [date]" |
| "fare estimate" / "travel estimate" | Values are community reports, not estimates the app computes | "reported fare" / "reported time"; "not reported" when absent |
| Options screen shows only Cheapest and Fastest | Third preference missing | Cheapest · Fastest · Fewest transfers, with comparison footnote |
| Active-trip map with solid route line | Implies the actual road path | Dashed schematic connector + "not to scale" unless the path is source-backed |
| No sign-in, profile, history or error screens | Missing pages | Screens 1, 11, 12, 14 |
| Local tip in quotes ("Kuya, dadaan po ba…") | Reads like a quoted comment; raw wording is not shipped (INV-4) | Paraphrased tip without quotation marks |

Keep from the Figma: the Sunset Playful palette and mascot, the chat layout with the preference chips, the large signboard panel, "Step 1 of 4" with step navigation, the Map view / Schematic toggle, "Stop order only · distances are not to scale", and "Your location stays on your phone."

## 7. Open items for the owner

1. Approve or reject optional Google sign-in (§4.1 scope flag). It changes PRD-F16 and needs a LOG entry.
2. Confirm the worked example route (§3) once the pack exists. Mock-up values must be swapped for real pack records before judging.
3. Settings toggle for the cat persona: confirm it is wanted (it is not in the PRD; the PRD only requires the persona).
