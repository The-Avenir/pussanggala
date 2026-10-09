---
spine_type: LOG
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

# Session Log: Pusang Gala

---

## 1. Decisions

| Date | Decision | Rationale | Docs touched |
|------|----------|-----------|--------------|
| 2026-10-09 | Accounts in 1.1: optional Google sign-in via Firebase Auth plus Firestore (@react-native-firebase 26.4.0). Sync covers saved routes, history, confirmations and corrections/new routes, and is opt-in. The core never imports Firebase. Submissions go to a review queue and reach users only through a pack. | Owner wants accounts to bind routes and enable community data later. The free tier covers the pilot. Keeping it optional preserves INV-1, INV-2 and INV-3 and phones without Play services. | idea, prd, sdd, build |
| 2026-10-09 | Coverage: the map spans Metro Manila + Rizal (55 MB); routes are answered only on verified corridors, starting with Cubao–Antipolo. A CORRIDOR entity drives the no-coverage message. | Owner: "focus on Metro Manila". Antipolo is in Rizal | idea, prd, sdd |
| 2026-10-09 | Release split: 1.0 = ask, route, cards, persona, schematic, local saved routes and history (offline, no account). 1.1 = map, GPS, accounts, sync, confirmations, submissions. | Owner chose "Map+GPS to v1.1" and "accounts with v1.1" | prd, sdd, index |
| 2026-10-09 | Owner added INV-5, INV-6 and INV-7. Q8 resolved as always ask | Owner answer | idea, prd, sdd, build, index |
| 2026-10-09 | **Supersedes the model row below.** The model is no longer pre-picked: a measured S5 bake-off on the Helio reference phone at Q4_0 decides. Candidates: Qwen3-0.6B, LFM2-700M, LFM2-350M, Gemma 3 270M and Qwen2.5-0.5B, plus a LoRA fine-tune (S7). Prior default if S5 can't run: Qwen3-0.6B Q4_0. | The owner relaxed the licence rule and asked for the best tech, not the most conservative. There are no published Filipino scores for any sub-1B model, so measuring is the only honest pick. | sdd, build |
| 2026-10-09 | Licence rule relaxed: any licence the team can comply with at startup scale (revenue-threshold such as LFM's under $10M, or use-policy such as Gemma). Only outright non-commercial licences are avoided in shipped assets. | Owner: "don't put too much constraints" | idea, build, sdd |
| 2026-10-09 | Device tiers (Full / Lite / Core), detected at first launch. Core is rules-only and covers 32-bit and low-RAM phones with no lost core feature. Reference phone: 4 GB, Helio-class MediaTek. Q4_0 quant, CPU-only, 4 threads. | Owner: "cater to as much as possible", and the chip is probably a MediaTek Helio. llama.rn is arm64-only, and Helio has no supported GPU or NPU path. | sdd, prd, idea |
| 2026-10-09 | Model, decided by the agent on owner delegation: Qwen3-0.6B Q4_K_M (396.7 MB, Apache-2.0) as primary; Qwen2.5-0.5B-Instruct Q4_K_M as the spike S5 challenger, chosen if it ties. Rejected Qwen3.5-0.8B (vision tower, memory) and Gemma 3 270M (gated licence; needs a fine-tune). | The 4 GB target phone and a strict <1B limit. Both candidates are Apache-2.0, which suits the commercial launch. The model stays an optional layer, and rules-only remains the fallback. | sdd, build |
| 2026-10-09 | "Do we even need the model?" Yes, as an optional layer. "RAG?" Already structured retrieval (SQLite facts); no vector RAG or embedding model in the first release. | Owner asked. A second model doesn't fit 4 GB. The model handles unseen phrasing and the persona line. | sdd |
| 2026-10-09 | Asset delivery: everything ships with the install and there is no team download server. Sideload/hackathon build: one APK with all assets. Play build: app + pack + map in the base module; model in a Play fast-follow asset pack. | Measured: corridor map 14 MB (z15), Metro Manila + Rizal 55 MB, model 397 MB. Play limits: 500 MB base, 1.5 GB per asset pack. Avoids hosting cost and keeps the network surface at zero. | sdd, prd |
| 2026-10-09 | Memory target for the 4 GB phone: peak PSS ≤ 1.0 GB, `n_ctx` 1024, model released on trim or idle | Owner set a 4 GB / 64 GB target phone | sdd, prd |
| 2026-10-09 | Proposed stack: React Native + Expo SDK 57 dev build, llama.rn 0.12.9, Qwen3-0.6B Q4_K_M (with Qwen2.5-0.5B as comparison), MapLibre RN 11.5.0 with Protomaps PMTiles, expo-sqlite, expo-location, and a TypeScript pack builder. Pending owner lock. | The owner asked for the stack to be verified. Every component exists, is open-licensed and fits the Expo dev-build model. Device spikes (SDD §9) are still unproven. | build, sdd |
| 2026-10-09 | Proposed router: custom multi-criteria label search, not RAPTOR (`minotor`) | Jeepneys have no timetables, and the pilot has about 40–80 legs | sdd |
| 2026-10-09 | Dropped Flutter, LiteRT-LM, Qwen2.5-1.5B, and Google Maps offline as the map, all from the reference architecture | Over the parameter limit; Google terms; TypeScript code sharing with the builder | sdd |
| 2026-10-09 | Persona design: deterministic cards plus a template bank, with an optional guarded SLM line. The SLM never writes facts. | INV-1. A model can reverse boarding and alighting using only allowed words | sdd, prd |
| 2026-10-09 | Owner set INV-1 to INV-4 (never invent a route; never require network; never send location or queries off-device; never ship Reddit text or usernames) | Owner answer | idea |
| 2026-10-09 | Pilot corridor: Cubao ↔ Antipolo/Masinag. Slug: `pusang-gala`. Tier 2. No deadline; quality gates instead of time-boxes. | Owner answers | index, idea |
| 2026-10-09 | Reddit (r/HowToGetTherePH) scrape is curation input only. Facts are extracted into our own records, with a permalink as the source. | Owner answer. Reddit Data API Terms cover content "whether using the Data APIs or not"; deletion obligations; Reddit v. Anthropic (2025) survived dismissal | idea, sdd, build |
| 2026-10-09 | Google Maps is not a data source. Scraping or caching it is prohibited. | Google Maps Platform terms §3.2.3. The owner asked "including googlemaps IF possible": it is not. | idea, prd |
| 2026-10-09 | Moved pre-SPINE docs to `docs/reference/`. The root `IDEA.md` became `docs/reference/feasibility-assessment-2026-10-09.md`. Deleted the duplicate root `pusang-gala-system-architecture.md` after confirming it was identical to the docs/ copy. | The validator requires frontmatter on every `docs/*.md`. The reference docs are evidence, not SPINE docs. | index |

## 2. Open questions

| ID | Raised | Question | Blocking | Status |
|----|--------|----------|----------|--------|
| Q1 | 2026-10-09 | Confirm the IDEA §4 out-of-scope list | IDEA lock | Resolved |
| Q2 | 2026-10-09 | Add any of these candidate invariants? (a) never present stale or unverified data as current; (b) never auto-select an ambiguous place; (c) never ship an asset whose license forbids its use; (d) never use Google-derived data | IDEA lock | Resolved |
| Q3 | 2026-10-09 | Is "<1B params" a hard limit? It decides whether Qwen3.5-0.8B (about 0.9B total including its vision tower) is eligible | Spike S5 | Resolved |
| Q4 | 2026-10-09 | Is the stack free/open-only? Is commercial use intended? (This affects Reddit risk, the MMS-TTS NC license and the Gemma license) | IDEA lock | Resolved |
| Q5 | 2026-10-09 | Confirm PRD priorities, especially whether map (F6) and GPS (F7) are Must-Have for the first release | PRD lock | Resolved |
| Q6 | 2026-10-09 | May the restrictive DOTC/Sakay 2015 GTFS be consulted as a cross-check? | PRD-F10 | Open |
| Q7 | 2026-10-09 | Which voice-output engine and voice? MMS-TTS Tagalog is CC-BY-NC, and the Android fil-PH system voice is device-dependent | PRD-F13 | Open |
| Q8 | 2026-10-09 | Ambiguous alias ("SM", "Gateway"): always clarify, or default to the nearest place in the corridor? | SDD lock | Resolved |
| Q9 | 2026-10-09 | Bundle assets in the APK, or download them on first run from a pinned host? | SDD lock | Resolved |
| Q10 | 2026-10-09 | Who field-verifies the corridor, and what counts as "verified" (ridden by the team, or 2+ independent mentions)? | PRD-F10, PUSANG-GALA-M7 | Open |
| Q11 | 2026-10-09 | Which target phone(s)? Model, RAM, chipset | SDD §9 spikes | Resolved (4 GB / 64 GB, MediaTek Helio-class; the exact model is recorded at spike time) |
| Q13 | 2026-10-09 | What is "jev"? The owner mentioned it as an alternative; a search found no matching project or tool | — | Open |
| Q12 | 2026-10-09 | Build commands, scaffold and branch policy (BUILD §3, §4) | BUILD lock | Open: the agent fills it from the real manifest once the scaffold exists; the owner confirms the branch policy |
| Q14 | 2026-10-09 | How are community submissions approved: team review, or a confirmation threshold plus spot checks? | PRD-F18 (1.1) | Open (owner: "decide later") |

## 3. Resolved questions

| ID | Resolved | Question | Answer |
|----|----------|----------|--------|
| Q3 | 2026-10-09 | Is <1B a hard limit? | Yes, strictly under 1B. The owner delegated the model choice to the agent |
| Q4 | 2026-10-09 | Free/open? Commercial? | Free now; commercial launch if the team wins the hackathon. Licence rule later relaxed (see Decisions) |
| Q1 | 2026-10-09 | Out-of-scope list | Keep: no live or background features, no voice input, no iOS. Coverage is Metro Manila + Rizal. Accounts are wanted (optional, 1.1) |
| Q2 | 2026-10-09 | More invariants? | Added INV-5 (no stale data shown as current), INV-6 (no silent guessing), INV-7 (no facts in model weights) |
| Q5 | 2026-10-09 | First-release priorities | Map and GPS move to 1.1 |
| Q8 | 2026-10-09 | Ambiguous alias | Always ask (now INV-6) |
| Q9 | 2026-10-09 | Bundle or download? | Delegated to the agent: bundle everything; the model goes in a Play fast-follow pack for the Play build (SDD §1.1) |
| Q11 | 2026-10-09 | Target phone? | 4 GB RAM, 64 GB storage, probably a MediaTek Helio. The goal is to reach as many phones as possible |
| — | 2026-10-09 | Timeline? | No deadline. Ship fast, but the priority is quality |
| — | 2026-10-09 | Are the reference IDEA.md stack constraints binding? | No. The agent must verify them and propose changes |
| — | 2026-10-09 | Persona scope? | Text first. Offline voice output after everything else ships |
| — | 2026-10-09 | Team skills? | Implementation is delegated to agents. Any stack agents know, as long as it is verified end to end |

## 4. Dead ends

| Date | Approach | Why it failed |
|------|----------|---------------|
| 2026-10-09 | Qwen 1.5B–3B on LiteRT-LM via Flutter (reference architecture) | Over the parameter limit; runtime and model artifact mismatch |
| 2026-10-09 | Google Maps offline areas as the in-app map | No supported API for an embedded offline map. Offline Google has no walking or transit directions, and caching is prohibited |
| 2026-10-09 | GraphHopper or Valhalla on the phone | GraphHopper dropped Android support after 1.0, and OOM risk. Walk links are precomputed or verified instead |
| 2026-10-09 | Pushshift / Arctic Shift Reddit dumps | Pushshift is moderators only. Arctic Shift has no Reddit authorization and contains deleted content |

## 5. Recoveries

| Date | Checkpoint | What went wrong | Resolution | Docs restored |
|------|------------|-----------------|------------|---------------|
| — | | | | |
