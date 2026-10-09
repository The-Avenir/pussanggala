# Pusang Gala: Competitor Analysis and Niche Selection

**Companion to `pusang-gala-proposal.md` · Draft v0.1 · October 2026**

---

## 1. Key Findings

1. **Routing jeepneys inside a city is already crowded.** Sakay.ph covers Metro Manila. Lugar.ph covers 8 other cities with 259 jeepney lines. Cebu alone has at least 7 commute tools, and Davao has at least 4. Making "another city jeepney planner" the core product would be a weak position.
2. **Trips between cities and provinces are not covered.** No tool we found plans a door-to-door commute such as *"Paano pumunta sa Taal Volcano galing Fairview?"*. That trip means a jeep to a bus terminal, then a provincial bus, a drop-off at an unofficial stop, and a tricycle. This is the main content of r/HowToGetTherePH: its most common flairs after NCR are **Central Luzon (Region III)** and **South Luzon (Region IV-A/IV-B/V)**.
3. **No competitor answers conversational questions with sources.** Existing tools ask for an origin and destination on a map. None take a Taglish question, combine community knowledge, and show where each step came from.
4. **The case for working offline is weaker than we assumed.** Mobile data has dropped to about **₱7/GB** (Ookla via [Philstar, Aug 2026](https://www.philstar.com/business/2026/08/21/2550650/mobile-data-costs-down-drastically-p7gb)). Offline still matters for provincial dead zones, travel between islands and low-end phones, but it should be a supporting feature, not the main pitch.

**Recommendation:** position Pusang Gala as **the commute guide for trips between provinces and cities in Luzon**. The first niche is **Metro Manila ↔ CALABARZON (Region IV-A)**, starting with students, workers and weekend travelers who are making a trip for the first time. This changes the proposal's MVP corridor (see §6).

---

## 2. Market Context

| Indicator | Figure | Source |
|---|---|---|
| Share of urban trips made by public transport | ~80%; jeepneys serve ~40% of these | [UP CIDS policy brief](https://cids.up.edu.ph/wp-content/uploads/2023/03/Putting-Transport-Workers-and-Commuters-First-The-Route-to-Just-Transition-in-Public-Transport-Modernization.pdf) |
| Daily jeepney riders, Metro Manila | ~9 million | [Wikipedia: Jeepney](https://en.wikipedia.org/wiki/Jeepney) |
| Daily trips, Metro Cebu | ~3.5 million | [Para.Go](https://parago.top/) |
| Average transfers per Metro Manila trip | 2–3 | [Sansa Sakay](https://www.sansasakay.com/) |
| Mobile connections | 142M (122% of population), early 2025 | [DataReportal 2025](https://datareportal.com/reports/digital-2025-philippines) |
| Internet penetration | ~84% (2023) | [LSE blog / World Bank](https://blogs.lse.ac.uk/inequalities/2025/09/23/mobile-internet-and-wealth-inequality-in-the-philippines/) |
| Mobile data cost | ₱7.07/GB, down from ₱21.5 in 2023 | [Philstar](https://www.philstar.com/business/2026/08/21/2550650/mobile-data-costs-down-drastically-p7gb) |
| Demand signal | r/HowToGetTherePH: ~297k members | [GummySearch](https://gummysearch.com/r/HowToGetTherePH/) |

**Demand is proven and keeps coming back.** The subreddit's size shows that people still ask other people because the apps don't answer their questions.

---

## 3. Competitor Landscape

### 3.1 Direct competitors: commute route planners

| Competitor | Coverage | Approach | Strengths | Weaknesses / gaps |
|---|---|---|---|---|
| [Sakay.ph](https://en.wikipedia.org/wiki/Sakay.ph) | Metro Manila + surrounding areas | Multi-modal routing (jeep, bus, P2P, rail, ferry); ad and data-analytics revenue | Market leader since 2013; strong brand; fares and ETAs; [route explorer](https://explore.sakay.ph/) | Metro Manila only ([user reviews](https://apps.apple.com/au/app/sakay-ph-commute-directions/id937998546)); no provincial door-to-door trips; no conversational Q&A |
| [Lugar.ph](https://www.lugarph.app/) | 8 cities: Baguio, Naga, Bacolod, Iloilo, Cebu, Tacloban, CDO, Davao (259 lines) | Routing built from LPTRPs, GTFS and OSM; up to 3 rides | Free; widest coverage outside NCR; tells you which signboard to wait for | City-only; routes are estimates; no trips between cities; no Metro Manila |
| [Komyut](https://komyut-app.vercel.app/) | Metro Manila "and beyond" (unclear) | Calls itself "AI-powered"; doesn't disclose its data sources | AI positioning; fastest/cheapest/simplest options | Unclear data; demo results look illustrative; small project |
| [PinoyCommute](https://www.pinoycommute.com/) | Metro Manila | Route and information guide | Covers all modes, including tricycles and UV | NCR only; a guide, not a planner |
| [Moovit](https://moovit.com/about-us/) | Global (112+ countries) | Operator data + crowd data | Global scale, real-time where available | Weak informal-transit data in PH; generic |
| Google Maps | National | Official transit feeds + Gemini "Ask Maps" ([Geoawesome](https://geoawesome.com/best-offline-map-apps-for-2026-what-still-works-without-internet/)) | Everyone already has it; walking and driving | Weak on jeepneys and tricycles; AI requires the cloud |

### 3.2 City-specific tools (fragmented, mostly student or hobby projects)

| City | Tools found |
|---|---|
| Cebu | [JTransit](https://jtransit.github.io/) (60+ routes, fare and time breakdown), [Lakbai](https://www.lakbai.tech/), [RUTA](https://ruta-ai.vercel.app/) (route-code decoder), [Cebu Jeepney Finder](https://cebujeepney.vercel.app/), [Tultul](https://github.com/rokkunbruv/hacktose-intolerant), [MyJeep](https://sugbo.ph/2023/myjeep-website/) (8k+ users), [Para.Go](https://parago.top/) (IoT + cashless) |
| Davao | [Davao Commuters](https://apps.apple.com/ph/app/davao-commuters/id6661032832), [Commute Davao](https://play.google.com/store/apps/details?hl=en&id=zalboi.commute_davao), [Discover Davao](https://discover-davao-67f69.web.app/), live DIBS bus trackers ([dcbus.site](https://dcbus.site/), [davaofreebus.site](https://davaofreebus.site/)) |

**Takeaway:** routing inside a city is close to being a commodity. Local developers build these tools quickly, often as hackathon or school projects. Competing city by city would be a long, expensive fight.

### 3.3 Indirect competitors and substitutes

| Substitute | What it covers | Gap |
|---|---|---|
| [r/HowToGetTherePH](https://gummysearch.com/r/HowToGetTherePH/), Facebook commuter groups | Any trip, with rich local detail | Answers take hours; hard to search; quality varies; no freshness signal |
| Bus booking and schedule sites ([bustickets.ph](https://bustickets.ph/pitx-shedule/), [Rome2Rio](https://www.rome2rio.com/s/Manila/Baguio)) | Terminal-to-terminal provincial buses | Nothing before or after the bus: how to reach the terminal, where to get off, the tricycle to the final destination |
| [PHFare](https://phfare.com/) | Fare lookup across 1,111+ routes | Fares only, no trip planning |
| Guide sites ([ph-commute.com](http://www.ph-commute.com/), [Commute Tour PH](https://ph.commutetour.com/)), travel blogs | Static guides | Out of date; fixed origins |
| [Sansa Sakay](https://www.sansasakay.com/) | Crowd-reported jeep/UV status in NCR | Status, not planning; could be a partner |

---

## 4. Positioning Map

```
                      CONVERSATIONAL / Q&A
                               ▲
                               │
          r/HowToGetTherePH ●  │            ★ Pusang Gala (target)
          FB commuter groups   │
                               │      ● Komyut (claims AI)
  WITHIN ONE CITY ─────────────┼─────────────────── BETWEEN CITIES / PROVINCES
                               │
   ● Sakay.ph (NCR)            │      ● Rome2Rio
   ● Lugar.ph (8 cities)       │      ● bustickets.ph
   ● Cebu/Davao tools          │        (terminal-to-terminal only)
   ● Google Maps               │
                               ▼
                      MAP / FORM-BASED PLANNER
```

The upper-right quadrant (conversational trips between provinces) has **human forums and nothing else**. That's the gap Pusang Gala should fill.

---

## 5. Niche Evaluation

Each candidate is scored 1–5. A higher score is better for Pusang Gala.

| Candidate niche | Demand | Competition gap | Data availability | Offline value | Feasible for a small team | **Total** |
|---|---|---|---|---|---|---|
| A. Metro Manila city commuting | 5 | 1 (Sakay.ph) | 4 | 2 | 3 | **15** |
| B. Metro Cebu city commuting | 4 | 1 (7+ tools) | 4 (GTFS exists) | 2 | 4 | **15** |
| C. Davao / other single cities | 3 | 2 | 3 | 2 | 4 | **14** |
| **D. Metro Manila ↔ CALABARZON (IV-A) door-to-door** | 5 | 5 | 3 | 4 | 4 | **21** |
| E. Metro Manila ↔ Central Luzon (III) door-to-door | 4 | 5 | 3 | 4 | 4 | **20** |
| F. Tourist trips to provincial spots (Batangas beaches, Tagaytay, Baguio, Zambales) | 4 | 4 | 3 | 5 | 3 | **19** |
| G. Island-hopping / ferry trips (Visayas) | 3 | 4 | 2 | 5 | 2 | **16** |

How the scores were set:
- **Demand** comes from the subreddit's flair ranking and the size of the population each niche serves.
- **Competition gap** comes from §3.
- **Data availability** reflects OSM, LTFRB and bus operator schedules, plus how much has to be crowdsourced.
- **Offline value** is higher where the route crosses provincial dead zones.

---

## 6. Recommended Niche

### Primary: Metro Manila ↔ CALABARZON door-to-door trips

**Who it's for**
| Segment | Example question | Why they need it |
|---|---|---|
| College students living outside NCR | "Galing Dasmariñas, pano pumunta sa UST?" | Trips they make every week with many legs; tight budget |
| Workers commuting across regions | "Calamba to BGC, pinakamura?" | Long daily trips; they want the cheapest or fastest |
| First-time and weekend travelers | "Paano pumunta sa Taal / Tagaytay / Nasugbu galing Cubao?" | Don't know the area; most at risk of getting lost |
| Balikbayans and OFW families | "Galing NAIA, pano pumunta sa Lipa?" | Out of practice with local routes; arrive with luggage |

**Why this niche**
- It is the largest demand outside NCR in the subreddit's own flair data.
- Sakay.ph, Lugar.ph and Google Maps all leave the cross-region trip unsolved. Bus sites only handle the terminal-to-terminal part.
- It is close to the team, which makes testing practical.
- The routes are corridors, not networks. A few dozen bus lines (Buendia/PITX/Cubao → Batangas, Lucena, Tagaytay, Sta. Cruz, etc.) plus last-mile jeep and tricycle legs make the dataset far smaller than a full city network.
- Offline helps on long bus legs through areas with weak signal.

**Expansion path:** CALABARZON → Central Luzon (E) → tourist destinations nationwide (F) → partnering with city planners such as Lugar.ph or Sakay.ph to cover legs inside cities, instead of rebuilding them.

### Change to the proposal's MVP

| | Current proposal | Recommended |
|---|---|---|
| MVP corridor | Metro Manila ↔ Rizal (Cubao, Antipolo, Marikina) | **Metro Manila terminals ↔ Cavite and Batangas** (e.g., PITX/Buendia → Dasmariñas, Tagaytay, Lipa, Batangas City) |
| Reason | — | Sakay.ph already covers much of Rizal as a "surrounding area" of Metro Manila. Cavite and Batangas trips are mostly unserved. |

---

## 7. Differentiation Strategy

| Differentiator | Why competitors can't easily copy it |
|---|---|
| **Door-to-door trips across regions** (jeep → terminal → bus → drop-off → tricycle) | Needs a mix of community knowledge, not just GTFS feeds. City apps would need a new data model. |
| **Answers Taglish questions** | Map-based planners would need to rebuild their interface; Google needs the cloud |
| **Shows sources and freshness** ("3 commuters confirmed, Aug 2026") | Builds trust that apps with estimated routes can't offer |
| **Unofficial stop knowledge** ("sabihin sa konduktor: baba sa Olivarez") | Exists only in community answers |
| **Works offline along the corridor** | A useful extra on long bus trips |
| **Partners rather than rebuilds** | Link to Sakay.ph or Lugar.ph for city legs; link to bustickets.ph for booking |

**Positioning statement:** *For Filipinos making a trip between provinces for the first time, Pusang Gala is the commute guide that answers like a local kababayan, from your doorstep to your destination, including the jeep, the bus and the tricycle, with every step backed by commuters who've made the trip.*

---

## 8. Threats

| Threat | Likelihood | Response |
|---|---|---|
| Sakay.ph expands outside Metro Manila | Medium | Move fast on the cross-region niche; consider partnering with or selling data to Sakay |
| Google Maps improves PH transit with Gemini | Medium | Compete on informal-transit depth and community trust, not general mapping |
| Lugar.ph adds trips between cities | Low–Medium | Work with them early; their city data plus our corridor data is stronger together |
| Developer clones (hackathon projects) | High | Our advantage is the curated, frequently confirmed corridor dataset and the contributor community, not the code |
| Reddit data restrictions | High | Build the contributor community from day one (see proposal §5) |

---

## 9. Next Steps

1. **Validate the demand:** within the subreddit's rules, manually tag 200 recent r/HowToGetTherePH questions by origin region, destination region and number of legs. This confirms or rejects the CALABARZON choice with real numbers.
2. **Interview 15–20 people** from the four segments in §6.
3. **List the corridor's data:** provincial bus operators, terminals, and LPTRPs for Cavite and Batangas LGUs.
4. **Contact Lugar.ph and Sansa Sakay** about data sharing or cross-linking.
5. **Update `pusang-gala-proposal.md`** with the new MVP corridor and positioning.

*Scores, segment sizes and threat likelihoods are desk-research estimates as of October 2026. Competitor features come from their public pages and may be out of date.*
