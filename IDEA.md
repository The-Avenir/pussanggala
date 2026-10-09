# Daanan — Offline Commute Assistant

Feasibility assessment and proposed MVP · 9 October 2026

Based on [Daanan_Hackathon_Proposal_Validation.md](Daanan_Hackathon_Proposal_Validation.md) and [daanan-system-architecture.md](daanan-system-architecture.md). This standalone document follows the requested React Native + Expo and strictly less-than-1-billion-parameter model constraints. SPINE is skipped at the owner's instruction.

## 1. Decision

**Proceed with an Android-first, one-corridor prototype using MapLibre and Expo Location.** React Native + Expo provides the app shell, MapLibre renders the downloaded corridor map, and Expo Location supplies foreground GPS updates. A sub-1B language model is a plausible local intent parser, subject to testing on Taglish queries and the actual phone. Daanan computes its own transit paths and walking links. Google Maps is an optional later handoff.

| Component | Verdict | Recommended decision |
|---|---|---|
| React Native + Expo | Feasible with native compilation | Use TypeScript and a custom development build; deliver a standalone APK for the demo. |
| Local route database and search | Feasible | Bundle a curated SQLite corridor pack; resolve aliases locally. |
| Offline transit routing | Feasible for a bounded dataset | Compute paths through verified ride and walking links. |
| Sub-1B local AI | Conditional go | Evaluate Qwen3-0.6B in 4-bit GGUF through `llama.rn`; restrict it to extracting user intent. |
| Google Maps external offline viewer | Conditional go | Pass coordinates; require user preparation and device testing. |
| Embedded downloadable Google offline map | No-go for this design | The consumer app's downloaded areas are not an app-owned offline map package. |
| Offline Google walking/transit navigation | No-go | Daanan supplies stored walking instructions and its own transit paths. |
| In-app offline street map | Conditional go for the MVP | MapLibre Native with licensed corridor resources and verified offline rendering. |
| Foreground offline GPS | Feasible, subject to device testing | Expo Location updates the commuter's position during an active foreground trip. |
| Background/screen-off tracking | Later milestone | Additional permissions, native configuration, and lifecycle testing required. |
| Full nationwide RAG, ingestion, and routing system during the hackathon | Not credible | Limit coverage, dependencies, and the AI task. |

These are engineering judgments based on the sources below, not results of a working prototype. This repository contains proposal documents, with no application or device benchmark supplied. The referenced participant briefing and several upstream proposal documents are absent; their deadlines, scoring percentages, and eligibility claims remain unverified.

## 2. Product idea and minimum useful experience

**Daanan helps commuters identify the right signboard, boarding point, transfer, and alighting landmark even when mobile data is unavailable.** Start with one verified corridor, such as Cubao–Masinag, selected according to the team's ability to validate the data.

A commuter asks a Taglish question, confirms ambiguous locations, and receives step cards with signboards, landmarks, walking instructions, estimated fare ranges, and data freshness. The core experience works after the model, route database, and offline map resources are installed, without an account or network connection. During an active foreground trip, the map displays the commuter's position when a usable location fix is available.

The first release should include:

- One corridor with approximately 40–80 directed ride legs, curated aliases, and linked local tips. These are scope targets, not existing data.
- Typed Taglish queries and explicit origin/destination selectors.
- Cheapest, estimated-fastest, or fewest-transfer preferences, clearly limited to known routes.
- Deterministic route cards and an embedded offline map with stops and verified route geometry.
- Foreground GPS updates, accuracy and last-update indicators, and start/stop trip controls.
- A schematic stop diagram as the fallback when map resources are unavailable.
- A local model that handles phrasing the basic parser misses.
- Map preparation showing corridor coverage, download progress, storage requirements, and readiness.
- Clear outcomes for missing coverage, ambiguous landmarks, stale data, and unavailable AI.

Defer background/screen-off tracking, remote location sharing, persistent journey recording, automatic alighting alerts, arbitrary-address walking navigation, speech recognition, automatic forum ingestion, nationwide coverage, and free-form AI travel advice. A small, trustworthy dataset is more valuable than broad speculative coverage.

## 3. Assessment of the existing documents

The validation report correctly prioritizes local operation, memory limits, curated seed data, and avoiding heavyweight map preprocessing on the phone. The architecture improves on it by separating deterministic route planning from language processing. Keep that separation when moving from Dart to TypeScript.

Several assumptions need correction:

| Existing claim or approach | Assessment and required change |
|---|---|
| Qwen 1.5B–3B as the main model | Outside the requested parameter limit. Quantization reduces storage and compute requirements; it does not turn a 1.5B model into a sub-1B model. |
| Large general benchmarks imply reliable Taglish parsing | They do not establish performance on Daanan's queries. Use a labeled local evaluation set. |
| An 8K context window disqualifies a model | The proposed extraction task should fit in 1K–2K tokens. Long context is unnecessary for the MVP. |
| GPU acceleration must always be disabled | Use CPU as the reproducible baseline. Any speed advantage depends on phone, backend, and build; the original report's anecdotes do not prove a universal result. |
| Flutter/LiteRT-LM and GGUF runtimes are interchangeable | Match the exact model artifact to the chosen runtime. The Expo proposal uses `llama.rn` and GGUF, eliminating the Flutter dependency. |
| Template answers are “always correct” | Templates prevent generation errors, but can still display incorrect or stale source data. Validate the dataset and expose uncertainty. |
| FTS5 trigram search is fuzzy matching | Trigrams support substring matching. Add separate typo scoring and explicit short-alias handling; full-text trigram queries under three characters do not match. [SQLite FTS5](https://sqlite.org/fts5.html) |
| Fixed similarity thresholds are reliable | Values such as 0.80 and a 0.05 margin are initial hypotheses, not calibrated confidence. Prefer clarification over weak matches. |
| A word/number allowlist makes LLM route rewriting safe | A model can reverse boarding and alighting while using only allowed words. Keep authoritative steps deterministic; omit rewriting from the MVP. |
| Google Maps download status can drive an automatic reminder | The reviewed public handoff documentation provides no download-status contract. Label preparation as user-confirmed, not device-verified. |
| A driving path approximates a valid tricycle route | It does not establish a tricycle service area, permitted road, or actual route. Remove this substitution. |
| Non-commercial, manually copied forum content is automatically acceptable | The report does not establish permission. Seed the demo with team-authored observations, consented contributions, or appropriately licensed data. |

The graph design also needs a correctness refinement: transfers, cumulative walking, and service time depend on path history. A cheapest-distance label indexed only by stop can discard a feasible alternative. Carry the relevant route, ride count, walking budget, and time state during search, retaining non-dominated feasible labels. Start with one valid best route; add alternatives after correctness is established. This is analysis of the proposed algorithm, not a measured performance claim.

## 4. React Native + Expo implementation

Expo development builds support custom native libraries. Use one during development and pin a mutually compatible Expo SDK, React Native, and native dependency set. Native library or configuration changes require a rebuilt binary. Expo Go is insufficient for the proposed inference runtime. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)

| Layer | Proposed choice | Responsibility |
|---|---|---|
| UI | React Native + Expo + TypeScript | Query entry, clarification, route cards, pack readiness. |
| Local inference | `llama.rn` | Load a local GGUF, run bounded extraction, cancel and release inference. |
| Data | `expo-sqlite` | Places, aliases, stops, legs, walking links, fares, sources, and notes. |
| Route computation | Pure TypeScript module | Constrained search and deterministic validation. |
| Files | Expo asset/file APIs | Install and verify local model and pack files. |
| Offline map | `@maplibre/maplibre-react-native` | Downloaded corridor resources, stops, route geometry, and position marker. |
| Foreground positioning | `expo-location` | Permission handling, position subscription, accuracy, and timestamps. |
| Fallback overview | SVG or ordinary React Native UI | Stop sequence when street map resources are unavailable. |
| Optional later map handoff | `expo-intent-launcher` on Android | Explicit Google Maps activity launch with coordinate URI. |
| Optional later retrieval | `sqlite-vec` plus a separate tested embedding model | Alias or note retrieval where it demonstrably helps. |

`expo-sqlite` documents bundled database import, FTS support, and an optional `withSQLiteVecExtension` build setting. The vector extension must also be loaded on the database connection before querying vector tables. Do not assume installing JavaScript alone enables it. [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

For the MVP, ordinary tables, aliases, and linked notes avoid a second model and native extension setup. Precomputed vectors alone cannot support semantic search for new text: the phone still needs a compatible query encoder. If added later, pin encoder revision, tokenizer, pooling, normalization, dimensions, and preprocessing with the pack.

Develop Android locally on Windows with the Android native toolchain or use an EAS build. Rehearse using a release/internal-distribution APK with an embedded JavaScript bundle, local assets, and no Metro connection. Building may need internet; commute queries after preparation must not.

## 5. Local AI below 1B parameters

### Candidate selection

| Candidate | Role | Assessment |
|---|---|---|
| **Qwen3-0.6B, Q4_K_M GGUF** | First candidate | Meets the parameter limit; multilingual and supports non-thinking operation. Benchmark extraction accuracy and latency. |
| **Qwen2.5-0.5B-Instruct, Q4_K_M GGUF** | Comparison/fallback | Meets the limit and supports structured instruction following. Use if it wins the task-specific test or avoids integration trouble. |
| Models labeled 1B, 1.5B, or larger | Excluded | Do not meet the strict `<1B` request. |

Qwen's cards identify Qwen3-0.6B as a 0.6B model with 100+ language/dialect coverage and a non-thinking option, and Qwen2.5-0.5B-Instruct as a 0.49B model with multilingual support. Both list Apache-2.0 licensing. These claims do not establish colloquial Taglish accuracy. Preserve model license notices and pin the actual downloaded artifact. [Qwen3 model card](https://huggingface.co/Qwen/Qwen3-0.6B), [Qwen2.5 model card](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)

`llama.rn` supplies React Native bindings for `llama.cpp`, Expo configuration, and structured-output facilities. Starting with v0.10, it requires React Native's New Architecture. Verify the selected release's requirements and bundled model support in the first device spike. A working desktop GGUF does not by itself prove that the pinned mobile binary supports it. [llama.rn](https://github.com/mybigday/llama.rn)

**Artifact selection remains an explicit setup step.** Qwen3 Q4_K_M is a proposed quantization target, not a verified download in Qwen's official repository: the inspected official files list Q8_0, while ggml-org provides a Q4_0 conversion. Use a trusted, revision-pinned conversion or reproducibly convert and quantize the original weights, then evaluate that exact artifact. Qwen2.5's official GGUF repository provides Q4_K_M. [Qwen3 official files](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/tree/main), [ggml-org Qwen3 files](https://huggingface.co/ggml-org/Qwen3-0.6B-GGUF/tree/main), [Qwen2.5 official files](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/main)

### Narrow, meaningful AI task

Use the model to extract `origin_text`, `destination_text`, `preference`, and optional departure-time text from an unfamiliar query. Missing values must be null. The output contains no fares, route legs, coordinates, or invented place IDs.

The app then resolves extracted spans against the local gazetteer. If a place is unknown or ambiguous, ask the user to choose. A valid JSON object is only syntactic success; swapped endpoints or invented spans are failures.

Initial configuration targets:

- One loaded model/context and one inference request at a time.
- 1,024–2,048 context tokens, with input limits that leave room for the response.
- Up to roughly 96 output tokens for extraction; reject truncation.
- Qwen3 non-thinking chat-template configuration, verified through the pinned binding. A prompt asking for brevity is insufficient.
- Schema/grammar-constrained output where supported, followed by semantic validation.
- CPU baseline; test supported acceleration separately before enabling it.
- A bounded timeout with native cancellation and a manual-selector fallback.

The local AI demo should include genuinely unseen phrasing that the rule parser cannot handle. Show that the model resolves the intent offline. A rules-only answer or cosmetic rephrasing does not demonstrate that contribution.

### Resource expectations

For a nominal 0.6B model, 4-bit weights alone imply about 300 MB by arithmetic. Actual GGUF storage is larger because quantization metadata, mixed-precision tensors, tokenizer data, and other metadata add overhead. File size is not peak process RAM.

Use **0.8–1.5 GB peak app memory as a provisional planning envelope**, including the model, KV cache, work buffers, native runtime, database, and UI. This is an estimate to test, not a benchmark or device-support guarantee. Prefer a 6 GB Android demo phone; 4 GB support is a separate validation target. Do not keep a second generative or embedding model loaded during the first prototype.

That initial envelope is for the model-and-cards prototype. MapLibre adds tile, geometry, and GPU texture allocations. Remeasure peak memory with map panning, GPS updates, and inference running together; do not treat the initial estimate as a map-inclusive guarantee.

Store model files on disk and pass their paths to native inference; avoid loading the entire artifact through JavaScript/base64. Record hash, revision, quantization, license, and byte size in a model manifest. Provision while online and verify readiness before travel; missing or corrupt assets must lead to a clear setup/manual-input state.

## 6. Offline maps and GPS

### Selected stack: MapLibre + Expo Location

MapLibre is the primary embedded map for the MVP. Its Expo integration requires a native build, and its OfflineManager supports regional downloads and pack status. Map rendering is separate from Daanan's transit and walking-link routing. [MapLibre Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/), [OfflineManager](https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/)

GPS receivers calculate position from satellite signals without requiring internet or a map service. Buildings and indoor locations can degrade reception. Keep device location services enabled during airplane-mode tests; map readiness and GPS availability are separate states. [GPS overview](https://www.gps.gov/gps), [GPS accuracy](https://www.gps.gov/gps-accuracy)

Use Expo Location's foreground permission and `watchPositionAsync` to supply coordinates to a MapLibre marker. Subscribe during an active foreground trip, stop when tracking ends or the app leaves the foreground, and resume appropriately. Avoid duplicate location subscriptions in the map and Expo layers. [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)

The MVP should:

- Request permission when tracking starts; keep manual origin selection available if denied.
- Show fix accuracy and age. Label stale coordinates as the last known position.
- Follow the marker until the user pans, with a recenter button.
- Tune update frequency and distance on the demo phone to balance movement responsiveness and battery usage.
- Preserve route cards and landmarks when location services are disabled or a fix is unavailable.
- Display only verified road/walking geometry as route paths. Label straight-line connections as schematic.

Foreground tracking is included. Persistent journey recording is deferred; if added, save timestamped coordinates and accuracy to a separate user database with explicit recording and deletion controls. Local position tracking works offline; live sharing with another person requires a communication connection.

### Map preparation and offline readiness

Select one bounded corridor and a limited zoom range. Download permitted resources while online, then verify labels, icons, and tiles after a cold launch with networking disabled. Include required styles, glyphs, sprites, and attribution. Record coverage, zoom limits, provider/style revision, and observed storage size alongside the route-pack manifest.

Show progress, failure, retry, and available-storage states. An interrupted download is not ready. Outside downloaded coverage, retain route cards and the sketch with an explicit coverage message. A specific map provider and permitted download/distribution method must be selected before the map integration gate passes.

### Background tracking and arrival reminders: later

Screen-off/background tracking needs TaskManager-based location updates, background permissions, and Android foreground-service configuration. Foreground `watchPositionAsync` alone is insufficient. OS and vendor restrictions can interrupt tracking; a terminated Android app does not automatically restart for location events. Test these behaviors separately before promising continuous recording. [Expo Location background requirements](https://docs.expo.dev/versions/latest/sdk/location/)

Later alighting reminders can compare reliable positions against the selected stop locally. Require accuracy filtering, repeated-fix confirmation, progress/direction checks, and duplicate suppression. Proximity alone does not establish that the commuter is on the right service or at an accessible stop. Automatic arrival claims are outside the MVP.

### Alternatives considered

| Alternative | Role and tradeoff |
|---|---|
| Mapbox | Embedded offline regions with a React Native wrapper; evaluate commercial terms and download limits. [Offline maps](https://docs.mapbox.com/android/maps/guides/offline/), [React Native setup](https://rnmapbox.github.io/docs/install) |
| Organic Maps | Separate offline map/navigation app supporting walking, cycling, and driving; not a drop-in Expo SDK. [Official features](https://organicmaps.app/) |
| OsmAnd | Separate offline navigation app with trip recording and GPX support; useful for field validation or standalone tracking. [Trip recording](https://osmand.net/docs/user/plugins/trip-recording/) |
| Google Maps | Optional external coordinate viewer, outside the required map/GPS MVP. |

### Google Maps: optional handoff and limitations

Google's consumer Maps app supports downloaded areas. Offline walking, cycling, and transit directions are unavailable; offline driving requires the entire route to lie within downloaded coverage. Areas expire and require updating. [Google Maps offline help](https://support.google.com/maps/answer/6291838?hl=en)

| Requirement | Feasibility | Daanan behavior |
|---|---|---|
| Open a known boarding/alighting coordinate | Documented intent; offline display must be tested | Pass stored coordinates and a label to Google Maps. |
| Show downloaded map coverage in Google's app | Conditional on its local data | Treat as a convenience, independent of route success. |
| Open directly into the offline-area downloader | No supported public handoff found in the reviewed docs | Open Maps and provide manual setup instructions. |
| Verify coverage downloaded/expired in Google Maps | No supported public status API found in the reviewed docs | Show “Preparation not verified” or a dated user confirmation. |
| Offline walking or jeepney directions from Google | Unavailable | Display Daanan's stored steps. |
| Read Google's offline tiles from Daanan | No supported integration identified | Use an in-app sketch, or a separately provisioned MapLibre map. |
| Use offline driving navigation as tricycle guidance | Reject | Show only independently verified tricycle stops and legs. |

Use Android `ACTION_VIEW` with package `com.google.android.apps.maps` and `geo:0,0?q={latitude},{longitude}({encodedLabel})`. Coordinate-based requests avoid relying on online name resolution. Google's intent documentation defines this handoff, but does not guarantee every intent's offline behavior. [Google Maps Android intents](https://developer.android.com/guide/components/google-maps-intents)

Expo's IntentLauncher accepts action, URI data, and target package parameters. Catch launch failures, retain the selected trip, and restore it when the user returns. If performing package discovery, configure Android package visibility appropriately. A successful launch establishes neither map coverage nor navigation success. [Expo IntentLauncher](https://docs.expo.dev/versions/latest/sdk/intent-launcher/)

**Do not confuse online embedding with offline tile distribution.** Embedding Google Maps through its supported SDK is possible subject to its terms. Creating Daanan-owned offline Google tile packs is not the proposed supported path: Google's terms restrict scraping and caching except for stated exceptions. Wrapping the SDK in React Native does not add an offline download entitlement. [Google Maps Platform terms, §3.2.3](https://cloud.google.com/maps-platform/terms)

If the optional handoff is implemented, manually prepare Google's corridor area and test the coordinate launch with Wi-Fi and mobile data off. Test missing Maps and unusable coverage too. Daanan's own map, route cards, and GPS experience must not depend on this handoff.

### Map resource requirements

MapLibre is an explicit MVP workstream. Preserve the text/sketch fallback, but treat a failed native offline map or GPS integration as an incomplete full MVP rather than silently claiming equivalent map support.

Use self-hosted tiles or a provider that explicitly permits offline downloads; include styles, glyphs, sprites, and attribution as required. The public `tile.openstreetmap.org` service forbids offline bulk downloads. OSM data availability does not imply unrestricted tile-server use. [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/)

Do not assume a PMTiles example for a web map works unchanged in MapLibre Native. Validate the chosen native package format and installation path separately.

## 7. Proposed runtime architecture

```text
Question or selected endpoints
        |
Local normalization and simple parser
        | missing/uncertain slots
        +----> Local SLM extraction ----> schema and span validation
        |                                      |
        +--------------------------------------+
        |
Alias lookup / typo candidates / user clarification
        |
Constrained route search over local verified legs
        |
Continuity, service time, fare, and provenance checks
        |
Linked notes + deterministic step cards
        |
MapLibre offline map + stops + verified route geometry
        ^
Expo Location foreground fixes (position, accuracy, time)

Missing map resources -> route sketch and text fallback
Missing GPS fix      -> manual origin and last-known-position state
```

The database owns the facts; the language model interprets the question. Retrieved notes attach to an already valid route. Semantic retrieval must never create a transport connection.

Preserve the original `place`, `place_alias`, `stop`, `place_stop`, `route`, `leg`, `walk_link`, `note`, and `fare_rule` concepts. Add explicit source records, record-to-source links, and a pack manifest containing coverage, schema version, creation date, verification date, and checksum. Keep user settings and selected-trip state separate from the replaceable region pack.

Add verified route geometry and map-pack metadata. Track map readiness separately from route-database readiness. Future recorded GPS tracks belong in the user database, so replacing a corridor pack cannot erase them.

Walking links need verified pedestrian access, direction, landmarks, and provenance. Straight-line proximity alone cannot establish a walkable transfer. Generate or curate these off-device, then inspect gates, crossings, and barriers. The MVP can use manually verified links without deploying a desktop routing service during the sprint.

Routing details to preserve:

- Use directed legs and nonnegative costs; distinguish a transfer from continuing on the same service.
- Evaluate operating hours at estimated boarding time, including prior travel and waiting, rather than only the initial query time.
- Apply fare rules at the ride/service level so graph segmentation does not charge a base fare repeatedly.
- Treat estimated times as estimates; offline packs cannot establish live traffic or current queues.
- Replace the broad “never reverse in a corridor” heuristic with explicit cycle prevention and validated transfer rules; legitimate trips may require backtracking.
- Persist enough trip state to recover after an external map launch or process restart.

## 8. Scope and execution plan

The primary integration risk should be tested early. Do not leave all native AI work until the final hours.

| Order | Deliverable | Gate / fallback |
|---|---|---|
| 1 | Native Expo app loads one sub-1B GGUF on the target phone and extracts slots offline | Try the alternate candidate or compatible pinned runtime. If neither works, local-SLM feasibility is unproven. |
| 2 | MapLibre licensed corridor download and Expo foreground GPS on the target phone | Cold-launch offline and verify outdoor position updates. A failure leaves the map/GPS MVP incomplete. |
| 3 | Curated corridor pack, verified geometry, and expected-route fixtures | Remove unverified legs; coverage may shrink. |
| 4 | Manual endpoints → valid route → cards and sketch | Required useful core. |
| 5 | Rule parser plus bounded SLM fallback and clarification | Compare rules-only versus hybrid accuracy. |
| 6 | Integrated offline map, trip controls, location states, and download readiness | Test map, inference, and routing together. |
| 7 | Standalone APK, cold-start offline rehearsal, repeated queries, and app lifecycle testing | Required before presenting offline claims. |
| Later | Background tracking, recording, arrival reminders, external map handoffs, embeddings, ranked alternatives, pack updates, contributions | Add only after measuring the core. |

A focused team familiar with Expo native builds can plausibly complete this bounded prototype in a short hackathon. Starting without Android tooling, a permitted map source, validated data, or successful model and map spikes makes the schedule substantially riskier. Confirm the actual event rules before deciding what can be prepared in advance.

## 9. Acceptance criteria and evidence still needed

The following are proposed release gates, not achieved results:

| Area | Test and proposed pass criterion |
|---|---|
| Offline independence | Force-stop, disable Wi-Fi and mobile data, relaunch the standalone APK, and complete local AI extraction, routing, map rendering, and foreground outdoor location updates with installed assets. |
| Parser quality | At least 50 labeled Taglish queries, including slang, reversed order, typos, ambiguity, and unsupported places; reserve held-out examples. Aim for ≥90% exact required-slot accuracy on unambiguous cases. |
| Added AI value | Report rules-only and hybrid accuracy, clarification rate, and falsely accepted locations separately. Demonstrate a useful improvement on held-out phrasing. |
| Ambiguity handling | Every designated ambiguous/unsupported test asks for clarification or reports no coverage, rather than silently choosing a wrong place. |
| Route validity | Every displayed ride/walk link exists in the pack and passes continuity, provenance, constraints, and fare checks. Validate at least 30 expected route cases. |
| Responsiveness | Aim for p95 under 500 ms for routing/cards after endpoints resolve, and warm SLM extraction under 5 seconds. Measure cold load separately; impose a bounded fallback timeout. |
| Memory and lifecycle | At least 20 queries with map panning, GPS, cancellation, and background/resume without crashes or sustained memory growth; report peak memory and battery usage. Verify foreground subscriptions stop and resume correctly. |
| Offline map completeness | Cold-start within downloaded bounds/zoom levels; verify labels, icons, attribution, interrupted downloads, missing resources, and outside-coverage fallback. |
| Foreground GPS | Test an outdoor walk offline, permission denial, disabled location services, poor/approximate accuracy, and lost fixes. Never present stale coordinates as current or block manual routing. |
| Asset integrity | Missing/corrupt model or pack produces recovery instructions and manual input where possible, without a crash. |
| Real-world usefulness | Walk/ride the demo route or obtain independent local verification; verify landmarks and fare ranges and record when checked. |

Record phone model, chipset, Android version, RAM, Expo/React Native versions, runtime version, model hash, quantization, context settings, map source/style revision, bounds/zoom range, map size, GPS sampling settings, and cold/warm measurements. Without those results, avoid claims such as “works on every mid-range phone” or a promised tokens-per-second rate.

## 10. Recommended commitment

Build **React Native + Expo, Android first, MapLibre offline corridor maps, Expo Location foreground GPS, SQLite transit data, deterministic route cards, and Qwen3-0.6B as a tested intent-extraction candidate**. Keep Qwen2.5-0.5B-Instruct as the comparison model. Route cards and the sketch remain available without map resources; manual selection remains available without GPS. Google Maps handoff, background tracking, persistent journey recording, and alighting alerts are later additions.

The product's defensible value is verified informal-transit knowledge accessible offline. The sub-1B model makes that knowledge easier to ask for. Expansion should follow demonstrated route accuracy, successful unfamiliar queries, manageable device resources, and a repeatable process for keeping each corridor current.
