# Pusang Gala: travel-first redesign

Design review, 10 October 2026. Based on `Reference.png`, the nine screenshots in `docs/ui-screens`, the current mobile implementation, PRD/SDD, and commits `ccaffbe`, `35c7db0`, and `cbd8eda`. Existing local edits to the manifest, theme, mascot component, and TypeScript config are preserved. This is a redesign of the working UI preview; it is not evidence of native map, model, GPS, pack, or SQLite integration.

## 1. Critical audit, before design

| Experience | Visual issue | Usability / architecture issue | Preserve | Change |
|---|---|---|---|---|
| Welcome / home | Large mascot and feature tiles displace the task | Returning commuters must pass marketing content to plan; account language introduces an irrelevant choice | Cat identity, friendly Taglish | Small mascot in optional introduction; planning is the default entry |
| Ask | Multiple pastel accents, repeated headings and outlined containers compete | One question and one answer replace conversation; no usable endpoint editing; advice and route facts share a surface | Cards before explanation; Taglish input | Dedicated conversation with editable journey context; route facts separated from assistant prose |
| Options | Large fare on every card; repeated badges and full-width controls | Differences are hard to compare; “fastest” overstates overlapping reported time ranges | Fare / time / transfer comparisons | Compact selectable rows; one selected-route action; qualified sort labels |
| Directions | Bus illustration repeats without helping boarding | A step picker hides the rest of the journey; planning and physical progress are confused | Signboard, boarding / alighting cues | Continuous numbered timeline; expand details in place; one Start action |
| Active trip | Totals, chip, hero container and diagram compete with the current instruction | Previous / next slide navigation requires reconstructing the journey; stop control can be mistaken for navigation | Manual advancement, next step, trip context | Action first, landmark second; persistent next-step preview; end-trip confirmation |
| Map | Original decorative roads, route line and dot look operational | Map/schematic are buried behind detail navigation; location may be confused with assumed origin | Map / schematic fallback | Stable Map destination; explicit missing basemap; stop diagram with view controls and no fake location |
| Offline resources | Decorative bus, feature list and repeated cards add scanning cost | “Download” in the reference conflicts with the bundled APK; readiness and connectivity are conflated | Per-resource readiness | Plain resource rows, capabilities, local recheck; no download promise |
| Saved / history | Each entry repeats several outlined buttons | Secondary editing overwhelms reopening; saved and taken trips need a shared destination | Save, rename, delete, history | Trips with Saved / History sections; inline rename; destructive confirmation |
| Profile / settings | Repeated mascot, counters and cards | Profile consumes a tab without an account; duplicate AI/offline entries | Local privacy and resource management | Settings in toolbar; grouped plain rows; remove Profile from primary navigation |

Reference accuracy problems are functional, not aesthetic: Masinag is outside the release's NCR scope; community reports cannot be labelled verified; future arrival predictions and automatic progress are unavailable; a picture of a map is not a basemap. The redesign corrects these in wording and interaction.

## 2. Navigation and journeys

Use **Plan · Map · Trips**, with Settings in the toolbar. Plan contains both manual endpoint entry and a prominent “Ask Pusang Gala” entry to a full conversation. This is not a decorative assistant widget. The conversation also opens from directions and an active trip, keeping the selected route and manual step in context.

Why three tabs: an Explore tab would promise destination discovery the installed pack does not currently support; a separate Chat tab and Plan tab would duplicate the start of the same commute; Profile has no account task. These choices are a task analysis, not a claim of completed user testing. If discovery becomes approved scope, replace Plan with Explore only after place coverage and discovery content exist.

Keep an independent navigation stack per tab. Switching tabs preserves the current planning, map and saved-route context. An active-trip strip offers Resume from every non-active screen. Opening settings, sources or conversation does not reset the selected route or advance the trip.

Primary journeys:

1. Plan → edit From/To or ask in Taglish → compare → continuous directions → Start → manually advance → finish → save / new directed return search.
2. Ask → route facts first → explanation or explicitly unavailable summary → comparison / directions / map without reentry.
3. Map → stop diagram if basemap missing → inspect a numbered step → directions → Start.
4. Trips → Saved / History → revalidated route → directions; manage a name or delete with confirmation.
5. Settings → Offline resources → see which capabilities are unavailable → recheck local files. No in-app download exists in the approved release.

The initial prototype uses an explicit Example mode. Leaving example mode clears its selected planning route. Synthetic routes are never returned as real search results. Native AI is never simulated with timed typing dots.

## 3. Low-fidelity validation

Open [wireframes](ux-wireframes.html). These were created before the new visual system and cover all eight requested experiences plus onboarding and Trips. They validate order, proximity and transitions without relying on brand color or artwork.

Desk-check outcomes: comparison has a single Continue action; directions expose the complete sequence; map fallback never strands the user; opening chat during an active trip does not abandon progress; deleting information requires explicit confirmation. A usability test with first-time commuters remains necessary.

## 4. Scope and terminology

The current implementation keeps NCR-only, bundled assets, source-reported values, foreground-only GPS and manual step progression. Nearby attractions, arbitrary-address routes, cloud AI, accounts, arrival predictions, in-app downloads and background tracking are not added. A future design may cover them only after explicit scope approval.

“Route information” means deterministic facts with provenance, not field verification. “Assistant explanation” identifies generated interpretation. The preview labels its route values Example and its explanation Basic summary, with AI unavailable. Missing times, fares, source dates, coordinates and asset sizes remain unknown. No source dates or links are manufactured for fixture records.

## 5. Visual system, interaction states and validation

The [visual review](ux-review.html) shows the high-fidelity screens, the shared visual system, and error/recovery references. The [eight-screen overview](ux-overview.png) is a shareable image. These are actual captures of the redesigned React Native preview, rather than independent pictures with inconsistent components. Source: `apps/mobile/src/ui/travel.tsx`.

### Screen hierarchy

| Screen | Primary goal | Most important information | Primary action | Secondary disclosure |
|---|---|---|---|---|
| Plan / home | Start a commute | Starting landmark and intended destination | Find routes | Location, conversation, resource status, optional introduction |
| Conversation | Understand a journey and ask follow-ups | Journey context, deterministic route facts, then explanation | Send a question | Comparison, map, directions; new-conversation confirmation |
| Route options | Choose a tradeoff | Time, fare, transfers in a consistent reading order | See directions for the selected route | Sort by reported fare/time/transfers; limitations below the list |
| Directions | Understand the whole commute | Numbered continuous sequence, boarding/alighting landmarks and signboard | Start trip | Expand a step in place; sources, map, saving and conversation |
| Active trip | Know what to do now | Current physical action, signboard, next landmark | Mark the current step complete | Previous step, next preview, all steps, conversation and end-trip confirmation |
| Map | Understand route points spatially | Selected journey; actual basemap availability; stop sequence when unavailable | Inspect a point or open directions | Diagram zoom, location status and resource recovery |
| Stop diagram | Understand sequence without a detailed map | Numbered board/transfer/alight points with mode labels | Inspect a step | Same route selection and directions as Map; no separate competing navigation destination |
| Offline resources | Know which capabilities are usable | Route/model/map readiness and functional consequence | Recheck local files | Actual version/hash/source dates/size when native files exist; unknown otherwise |
| Settings | Change preferences or manage resources | Journey preferences, location, storage and privacy | None; select a relevant row | Expand default sort; navigate to resources, privacy or attribution |
| Trips | Reuse a known route | Active journey access, saved routes, looked-up/taken history | Open a route / resume | Saved/History switch; manage to rename or delete; destructive confirmation |

### Coherent visual system

| Token | Value / use |
|---|---|
| Typography | Device system font: System on iOS, sans-serif on Android, system-ui on web; no font-loading launch gate |
| Type hierarchy | 34/40 display, 28/34 title, 20/27 heading, 17/25 body, 16/23 action, 15/22 secondary, 13/19 caption |
| Primary text | `#222B29` on white; measured contrast 14.53:1 |
| Secondary text | `#5C6662` on white; 5.95:1; captions never contain the only boarding instruction |
| Brand accent | `#AD3D22`; 6.06:1 with white text; selection, primary actions and discreet cat mark |
| Surfaces | White content, `#F5F5F0` quiet utility surface, `#F8EAE3` selected example / active-trip strip |
| Meaningful color | `#345D73` transit links, neutral dashed walking links, `#80531D` warnings on `#FBF2DD`, `#A83229` destructive actions |
| Spacing | 4-point base; 8/12/16/20/24/32; page margin 20; aligned text and control edges |
| Shape | 8-point signboards, 10-point segmented controls, 12-point inputs/actions, 20-point sheet top corners; lists use separators, not repeated containers |
| Touch targets | At least 44 × 44 logical units; common controls 48–50 high; numbered timeline glyphs belong to a much larger tappable row |
| Brand | Small vector cat in the Plan toolbar; existing Gaile art only in optional introduction and completion; no generated decoration |

Text remains scalable with React Native's default font scaling. No `numberOfLines` truncation or maximum scaling cap hides essential content. Row heights grow, metrics wrap, numbering grows with text, and sheets scroll when space is limited. The composer can shrink at narrow widths without sending its action offscreen. These are implementation provisions, not a claim that native Dynamic Type or TalkBack has been device-certified.

### Interactive behavior

- Each tab keeps its own navigation stack. Returning to Plan restores the selected comparison/directions view. An active trip has a persistent Resume strip; opening chat/settings does not advance or abandon it.
- Selecting an itinerary changes the planning selection only. Sorting rearranges options without silently selecting a different route. Starting another route asks to replace the active trip.
- The current step expands inside the complete direction timeline. A diagram point opens that same step. The stop diagram is not presented as geographically accurate or a substitute GPS position.
- Conversation is a bounded in-memory sequence, not a single overwritten answer. New replies scroll into view. Boarding questions in active-trip context use the current step. “New” asks before clearing conversation/planning; active trips and saved routes stay intact.
- Actual queries retain endpoints when data is unavailable. Synthetic results require explicit example mode. Clearing planning state removes the Start action and prevents stale tab stacks from silently reopening a default fixture.
- Completed-trip saving uses the completed itinerary, not a later planning selection. A return request creates a new directed search; it never reverses forward steps. History distinguishes Looked up from Taken.
- Manage discloses rename/delete in Trips. Delete route, delete history, clear history, end trip and delete all data require confirmations. Keyboard focus is contained within sheets; Escape and native Back dismiss them. Native screen-reader focus still needs device validation.

### Necessary states

“Preview” below means the state is exercised in the app/browser tests. “Native contract” defines behavior to connect when T45's adapters are available; it is not simulated by timed success or fake GPS.

| State | Presentation and recovery | Status |
|---|---|---|
| Empty planning / conversation / saved / history | Brief task-specific guidance; real manual input or labelled example; no invented destinations | Preview |
| Missing endpoint | Focused landmark sheet; commit explicitly; retain the other endpoint | Preview |
| Outside NCR / same endpoint | Explain the specific problem; edit the affected endpoint; no arbitrary nearest-stop assumption | Preview |
| Missing route pack | Keep endpoints; explain why routing is unavailable; resource check / reinstall if genuinely missing in the release | Preview message; native file/reinstall contract |
| Ambiguous alias / typo | Sheet with 2–4 canonical candidates and area labels, plus None of these; never auto-select | Native resolver contract |
| Unsupported address / place | Ask for a supported landmark; don't fabricate a first/last walking segment | Native resolver contract |
| No connected itinerary | Distinguish from unknown place; edit endpoint or choose a supported landmark; changing a preference cannot invent a connection | Native router contract |
| Routing / understanding | Text status “Finding supported routes”; cancel available; keep endpoints; no ornamental typing animation | Native task contract |
| AI loading / streamed answer | Route cards appear first; “Preparing local assistant” / “Explaining this route”; Stop affects only inference; only validated units display | Native runtime contract |
| AI failed / cancelled | Keep all route cards; inline “Explanation interrupted”; Retry / continue with cards; retain journey context | Native runtime contract |
| AI unsupported / unavailable | Label Basic summary; never imply generated advice; explain device/resource limitation | Unavailable preview; capability contract |
| Unknown fare/time/hours | Explicit Not reported; no zero, invented total or departure prediction | Hours preview; native card contract |
| Stale / conflicting reports | Source dates near affected value; retain separate reports; 180-day default from manifest; source detail expands in context | Native pack/card contract |
| Missing / corrupt basemap | Explicit unavailable view; selected route keeps stop diagram; no fake road line, dot or attribution | Missing preview; corruption contract |
| Healthy basemap | Interactive local MapLibre viewport; show whole route/recenter; attribution visible; dashed schematic links unless evidenced geometry exists | Native map contract |
| Permission denied / location disabled | Manual input stays available; permission/settings action only when appropriate; never claim a fix | Unavailable preview; native permission contract |
| No fix / inaccurate / stale fix | State No position / accuracy / age; Last known wording for stale fix; origin suggestions require confirmation | Native location contract |
| Background / interrupted navigation | Pause GPS in background; keep manual step; Resume when foregrounded; never show “on track” without evidence | Native lifecycle contract |
| Restart / changed pack | Offer Continue with recorded step after compatibility validation; if invalid, Re-plan with endpoints retained; never silently reuse obsolete records | Native SQLite/restore contract |
| Asset verification | Per-resource Missing / Verifying / Ready / Failed; actual bytes/checksum/schema/version; local recheck only | Missing/recheck preview; native verifier contract |
| Poor or absent connectivity | Core behavior unchanged when bundled resources are ready; no repeated offline alarm; external source opens only on explicit request | Warm browser networking disabled; native cold launch pending |
| Completion / cancellation | Completion only after the final manual confirmation; end-trip confirmation does not mark Taken | Preview |

### Usability evaluation still required

Test with first-time NCR commuters, including older readers and people using TalkBack/larger system text. Ask them to plan, select a tradeoff, identify the boarding signboard and alighting landmark, ask about the current trip, recover from a missing map, resume an interrupted journey and delete a saved route. Observe wrong taps, route misinterpretations, unnecessary backtracking and whether “reported” is understood. A browser walkthrough proves transitions, not task comprehension or outdoor usability.

### Validation record

- Mobile and root TypeScript checks passed; root core tests: 424 passed in 18 files.
- Existing UI asset verification: 37 allowlisted files match hashes/dimensions. The redesigned bundle uses system text and only two existing mascot poses.
- Source-content scan passed; 12 existing source-content regression tests passed.
- Browser flows cover 320/390/430 px, keyboard sheets, independent tab stacks, real-query versus example separation, route comparison, continuous directions, saved/history management, manual progression, trip-context questions, completion and unavailable resources. Final measured results are in [validation.json](ux-screens/validation.json).
- Contrast checks use actual token pairs; text enlargement stress checks cover Plan, conversation, directions, active trip and Settings at 200%. This is CSS text stress evidence, not a substitute for native Dynamic Type/TalkBack testing.
- Android/iOS Hermes and web export compilation were checked. iOS export is a compatibility check, not a new release target. Actual Android APK / device / cold-offline acceptance remains pending.

Reproduce: `npm run typecheck` and `npm test` at root; `npm run typecheck`, `npm run check:ui-assets` and `npm run test:ui` in `apps/mobile`. On this Windows host set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the installed Edge executable. `UI_SCREENSHOTS` selects the capture destination. Run `npm run web` in `apps/mobile` for the live interactive preview.

## Apple guidance used

- [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): persistent top-level destinations support orientation. Plan / Map / Trips are content destinations; settings and conversation follow task context.
- [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets): use focused, dismissible context for endpoint editing and short decisions; preserve the underlying journey.
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): system text, adaptable layouts, adequate contrast, large targets and labels supplementing color support commuters outdoors and people using assistive technology.
- [Apple design Q&A](https://developer.apple.com/news/?id=s8sl4tpa): progressive disclosure reduces overcrowded rows; retain tabs through navigation.
- [Generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai): identify AI use, support refinement/retry, communicate availability, and preserve a useful experience when generation is unavailable. Route facts and explanation are separate, with cards surviving inference failure.
- [Machine learning](https://developer.apple.com/design/human-interface-guidelines/machine-learning): actionable corrections, attribution and understood limitations protect trust; no invented confidence percentage or field-verification label.

These are design principles adapted to the existing Android React Native app. This work does not change the platform to iOS or claim native UIKit/SwiftUI components.
