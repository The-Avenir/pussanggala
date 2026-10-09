# Daanan: Connectivity Evidence

**Supporting statistics for offline-first design · Companion to `daanan-proposal.md` and `daanan-competitor-analysis.md` · October 2026**

---

## 1. Bottom Line

No published study we found directly measures *"Filipinos losing mobile data while commuting."* The case has to be built from indirect evidence. That evidence is reasonably strong on three points:

1. **Coverage gaps are real, especially in the provinces.** About 1 in 6 barangays is officially classified as geographically isolated, and 8% of surveyed barangays had no cellular signal at all.
2. **Access depends on budget.** Nearly all mobile users are prepaid, cost is the most common reason people are offline, and connectivity varies widely by region.
3. **Many phones are on older networks.** About 7 in 10 users have not moved to 4G voice (VoLTE) ahead of the December 2026 3G shutdown.

**Counter-evidence to be honest about:** mobile data prices have fallen by about two-thirds since 2023. "Data is too expensive" is a weaker argument than it used to be. Daanan's offline case should rest on **coverage gaps, prepaid load running out, and older phones**, not on price per GB alone.

---

## 2. Coverage Gaps

| Statistic | Figure | Source |
|---|---|---|
| Barangays classified as Geographically Isolated and Disadvantaged Areas (GIDAs) | **7,063 barangays, ~25 million residents** | [Globe newsroom: GIDA blueprint](https://www.globe.com.ph/about-us/newsroom/corporate/gida-blueprint-proposal) |
| Total barangays nationwide (Apr 2026) | 42,010, so GIDAs are **~17%** of all barangays | [Wikipedia: Barangay](https://en.wikipedia.org/wiki/Barangay) |
| Surveyed barangays with cellular signal (2019 NICTHS) | 92% of 2,528, so **~8% had no signal**; 3G still common in rural areas | [UNDP Philippines](https://www.undp.org/philippines/blog/free-wi-fi-enabling-inclusive-and-accessible-internet-all) |
| Mobile dead zones ("not-spots") identified | **4,846 – 12,626** unconnected map cells (2024) | [M2Catalyst Philippines Mobile Quality Report 2024](https://irp.cdn-website.com/c4709c5a/files/uploaded/Philippines_Quality_Global_Mobile_Insights_Report_M2Catalyst.pdf) |
| Users spending under 1% of their time with no signal (best operator, 2023) | 88.3% (Globe), so **~1 in 9 users have no signal more often than that**; worse on Smart and DITO | [Opensignal, Aug 2023](https://insights.opensignal.com/2023/08/10/increased-spending-shakes-up-the-mobile-market-in-the-philippines) |

**Why it matters for Daanan:** routes between provinces (Metro Manila → Batangas, Quezon, Laguna) pass through the rural and mountain areas where these gaps are concentrated. The commuter is most likely to lose signal at the exact moment they need to know where to get off.

---

## 3. Budget-Limited Access

| Statistic | Figure | Source |
|---|---|---|
| Share of mobile subscribers who are **prepaid** | **97.1%** (153.1M of 157.7M, Q1 2022) | [Senate of the Philippines, bill on prepaid load expiry](https://issuances-library.senate.gov.ph/sites/default/files/2023-05/3853834992!.pdf) |
| Individuals aged 10+ who use the internet | 67.3%, so **~1 in 3 do not** | [PSA–DICT 2024 NICTHS](https://psa.gov.ph/system/files/lsredsd/1_Press%20Release_NICTHS_rev1_19July2025_MLB-signed.pdf) via [InsiderPH](https://insiderph.com/internet-access-in-ph-expands-but-cost-still-a-barrier-psa-dict-survey) |
| Non-users who cite **cost** as a main barrier | **41.7%** | Same |
| Households with internet at home | 48.8%, so **51.2% have none** | Same |
| Households without internet that blame high fees | **58.3%** | Same |
| Internet users whose main device is a cellphone | **98.8%** | Same |
| Average monthly mobile budget (ITU basket) | US$8.90, **up 29%** from the previous year (2025) | [WorldData / ITU](https://www.worlddata.info/asia/philippines/telecommunication.php) |
| Daily minimum wage, 2026 | ₱755 (NCR) down to **₱455** (MIMAROPA, Region V) | [NWPC, Jul 2026](https://nwpc.dole.gov.ph/wp-content/uploads/2026/07/current-statistics-on-wages-as-of-July-9_2026.pdf) |

**Why it matters for Daanan:** prepaid users buy data in short promos (daily, 3-day, 7-day). When a promo expires or the load runs out partway through a trip, a cloud-only app stops working. The phone is almost always the only device people have.

### Regional gap: household internet access (2024)

| Region | Households with internet |
|---|---|
| NCR | 68.7% |
| Central Luzon (III) | 61.3% |
| **CALABARZON (IV-A)**, Daanan's target niche | **53.2%** |
| National | 48.8% |
| BARMM | 27.7% |
| Zamboanga Peninsula (IX) | 21.2% |

Sources: [InsiderPH / 2024 NICTHS](https://insiderph.com/internet-access-in-ph-expands-but-cost-still-a-barrier-psa-dict-survey); [PSA Region IV-A press release](https://rsso04a.psa.gov.ph/sites/default/files/attachment-dir/2025-0400-PR46%20%20NICTHS.pdf)

**Nearly half of CALABARZON households have no home internet**, so commuters there can't count on Wi-Fi to plan before leaving home.

---

## 4. Older Phones and the 3G Shutdown

| Statistic | Figure | Source |
|---|---|---|
| Mobile connections using VoLTE (4G voice), 2025 | **30.9%**, against a 57.7% global average and over 90% in Malaysia and Singapore | [Ookla, 2026](https://www.ookla.com/articles/controlled-network-testing-manila-2026) |
| Users not yet on VoLTE | **~69–70%** | [Philstar, Jun 2026](https://www.philstar.com/business/2026/06/02/2532103/philippines-mobile-users-still-heavy-3g); [TechPilipinas](https://techpilipinas.com/70-mobile-users-philippines-3g-shutdown-deadline-nears/) |
| Users on basic 2G/3G phones (DICT estimate) | **~15%** | [DCD](https://www.datacenterdynamics.com/en/news/philippines-prepares-for-2g-and-3g-switch-off/) |
| 3G network shutdown date | **December 31, 2026** | [Technobaboy](https://www.technobaboy.com/2026/04/01/philippines-to-shut-down-3g-networks-by-end-of-2026/) |

**Note:** the 70% figure is about *voice* technology (VoLTE adoption), not data. DICT's 15% figure counts people using basic 2G/3G phones. Use the 15% figure when talking about users who may lose data access after the shutdown, and cite the 70% only as a sign of how slowly users are moving to newer networks.

**Why it matters for Daanan:** around the 3G shutdown, a portion of users on low-end phones may have unreliable data. An app that works offline keeps working during the transition.

---

## 5. Counter-Evidence (include this in any pitch)

| Statistic | Figure | Source |
|---|---|---|
| Mobile data price per GB | **₱7.07 (2026)**, down from ₱21.5 in 2023 | [Philstar / Ookla, Aug 2026](https://www.philstar.com/business/2026/08/21/2550650/mobile-data-costs-down-drastically-p7gb) |
| Internet users among people aged 10+ | 67.3% in 2024 | [2024 NICTHS](https://insiderph.com/internet-access-in-ph-expands-but-cost-still-a-barrier-psa-dict-survey) |
| Mobile connections | 142M, **122% of population** | [DataReportal 2025](https://datareportal.com/reports/digital-2025-philippines) |

Connectivity is improving quickly. Judges or investors may ask why offline matters if data costs ₱7/GB. The answer: **cheap per GB doesn't help when there's no signal, the promo has expired, or the phone is on an old network.** Offline is a reliability feature, not a cost-saving one.

---

## 6. Related Commuting Evidence

| Statistic | Figure | Source |
|---|---|---|
| Average one-way trip time, Metro Manila commuters | ~73 minutes (range 5–250 min) | Narboneta & Teknomo (2016), cited in [ResearchGate study](https://www.researchgate.net/publication/317646479_A_Study_of_Metro_Manila's_Public_Transportation_Sector_Implementing_a_Multimodal_Public_Transportation_Route_Planner) |
| Transfers per Metro Manila trip | 2–3 | [Sansa Sakay](https://www.sansasakay.com/) |
| Existing apps' data quality | "Sakay.ph and Moovit suffer from outdated or incomplete data" | [Lakbayan paper, Atlantis Press](https://www.atlantis-press.com/article/126023796.pdf) |

Long trips with several legs mean more chances to lose signal or run out of load before reaching the destination.

---

## 7. Evidence Gap and How to Close It

There is no direct data on **connectivity during commutes in the Philippines**. To make the claim properly, collect your own data:

1. **Commuter survey (n ≥ 200)** in the target CALABARZON segments. Ask:
   - "In the last month, did you lose signal or run out of data while commuting?"
   - "Where?"
   - "What did you do?"
   - "Prepaid or postpaid? How much do you load per week?"
2. **Field signal log:** ride 5–10 corridor routes (e.g., PITX → Tagaytay, Buendia → Batangas City) with a free logger app such as Network Cell Info or the Opensignal app. Record the percentage of trip time with no signal or 2G/3G only. This gives you a **corridor dead-zone map** no competitor has.
3. **Subreddit signal:** within the subreddit's rules, count r/HowToGetTherePH posts that mention "walang signal", "no data", "nawalan ng load" or similar.

Primary data from steps 1 and 2 would be the strongest evidence in a pitch, and it doubles as product data.

---

*All figures as reported by the cited sources; some datasets are from 2019–2023 and should be refreshed where newer releases exist. The M2Catalyst figure is quoted from the report's text summary; the full report's charts could not be extracted for verification.*
