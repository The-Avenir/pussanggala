# Figma screen implementation

**Historical baseline:** the current app entry point now follows the [10 October UX redesign](ux-redesign.md). See the [visual review](ux-review.html) for current screens and before/after comparisons. The screen mapping and validation below describe the original nine-screen implementation.

The nine requested Figma designs now render in the Expo app using the Sunset Playful palette, Nunito/DM Sans typography, and exact locally bundled SVG exports. The navigation follows [app-walkthrough.md](app-walkthrough.md). The phone bezel and sample Android status bar in Figma are presentation chrome; the app uses the device status bar and safe areas.

This is a UI implementation over the existing synthetic harness. The installed eligible route pack, native AI, NCR basemap, foreground GPS, and SQLite persistence are not connected yet. The screens disclose those states; this work does not complete T45, T46 acceptance, or a phone/release gate.

## Screen mapping

All nodes are in Figma file `PmvJnBpOLKVXiQcQAajGt7`. Screenshots are 390 × 844 browser renders; native device screenshots remain pending.

| Figma node | App flow | Implementation | Screenshot |
|---|---|---|---|
| [13:454](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=13-454) | 1 · Welcome | `WelcomeScreen.tsx` | [Welcome](ui-screens/390-welcome.png) |
| [14:439](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=14-439) | 3/5 · Ask and response | `AskScreen.tsx` | [Ask](ui-screens/390-ask.png) |
| [14:567](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=14-567) | 6 · Route options | `RouteOptionsScreen` | [Options](ui-screens/390-options.png) |
| [14:625](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=14-625) | 7 · Route details | `RouteStepsScreen` | [Steps](ui-screens/390-steps.png) |
| [14:855](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=14-855) | 8a · Map | `RouteMapScreen` | [Map](ui-screens/390-map.png) |
| [14:933](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=14-933) | 8b · Schematic | `StopDiagram` | [Schematic](ui-screens/390-schematic.png) |
| [14:686](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=14-686) | 9 · Active trip | `ActiveTripScreen` | [Active trip](ui-screens/390-active.png) |
| [14:788](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=14-788) | 13a · Offline data | `OfflineDataScreen` | [Offline data](ui-screens/390-offline.png) |
| [14:993](https://www.figma.com/design/PmvJnBpOLKVXiQcQAajGt7/Untitled?node-id=14-993) | 13 · Settings | `SettingsScreen` | [Settings](ui-screens/390-settings.png) |

`MobileShell.tsx` supplies the four tabs (Ask, Map, Saved, Profile), back navigation, fixed bottom actions, active-trip banner, and confirmation sheets. Saved/history, Profile, Privacy, About, and Trip complete fill the documented transitions between the requested designs.

## Documented corrections applied

- Monumento → One Ayala replaces Cubao → Masinag. Antipolo/Masinag requests display the NCR boundary message.
- Accounts stay deferred. Welcome has Continue without an account; there is no simulated sign-in.
- The offline-download design becomes Offline data. It reports missing pack/model/map files, without a download/corridor flow or an invented storage size.
- Fare/time labels say reported, unknown walk distances/times stay explicit, and no verified/last-checked claim is added.
- Options show three distinct walkthrough itineraries. Carousel + MRT-3 carries both Lowest reported fare and Shortest reported time; no duplicate itinerary is invented for the preference tabs.
- The default map is the stop diagram. Original Figma street-map artwork remains available as a labelled design illustration; its painted path/dot is never claimed as the selected route or GPS fix. The actual basemap adapter remains pending.
- The route summary renders before the basic example explanation. Chat stays in memory. Native guarded streaming is not simulated.
- Steps advance manually. Start, back, next, stop/cancel, completion, saving, renaming, deleting, and clearing data work for the example session. Return requests do not reverse forward legs.

## Assets and dependencies

[The UI asset manifest](../apps/mobile/assets/ui-manifest.json) is an explicit allowlist of 31 exact SVG exports, four font files, and two font licences, with SHA-256 and original dimensions. It supplements the existing T41 data/model/map asset list; UI artwork is not classified as an installed geographic map. SVG root dimensions are preserved by the transformer. `ScaledArtwork` scales an entire wrapper uniformly on narrow phones.

The SVG setup follows the [transformer’s Expo instructions](https://github.com/kristerkari/react-native-svg-transformer); fonts load from local files with [Expo Font](https://docs.expo.dev/versions/latest/sdk/font/). Runtime additions are Expo Font, React Native SVG, safe-area context, and React DOM/React Native Web for preview. Playwright and the SVG transformer are development dependencies. No networking, account, analytics, map, or AI SDK is added.

## Validation

Recorded on Windows using Node 26 and installed Edge for browser checks:

| Check | Result |
|---|---|
| Root `npm run typecheck` | Passed |
| Root `npm test` | 424 tests in 18 files passed |
| Mobile `npm run typecheck` | Passed |
| Mobile `npm run check:ui-assets` | 37 files match their hashes and original SVG dimensions |
| Mobile `npm run test:ui` | Passed at 320, 390, and 430 px |
| `npx expo export --platform all` | Android/iOS Hermes and web exports passed |
| `node tools/eval/allowlist-check.mjs` | Passed; no raw Reddit leak |
| `node --test tools/eval/allowlist-check.test.mjs` | 12 tests passed |
| `node tools/eval/t44-restore-check.mjs` | Existing ID-only restore fixtures passed |

The UI test serves the exported app locally, loads all four bundled fonts, then disables browser networking. It checks navigation, unique preference options, saving/renaming, active progress across tabs, stop cancellation, completion, return/outside-NCR recovery, and data deletion. It checks every rendered SVG’s bounds and aspect ratio, and fails on runtime errors or external requests. This is warm browser interaction evidence, not a cold airplane-mode Android test. Geometry measurements and screenshots are emitted to `apps/mobile/dist/screenshots` and uploaded by the mobile UI CI job.

To reproduce from the repository root:

```sh
npm ci
cd apps/mobile
npm ci
npm run typecheck
npm run check:ui-assets
npx playwright install chromium
npm run test:ui
npx expo export --platform all
```

On this Windows machine the checks use `PLAYWRIGHT_CHROMIUM_EXECUTABLE=C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. `UI_SCREENSHOTS` optionally selects an output directory. `npm run web` launches the interactive preview.

## Remaining integration

T45 must replace `previewJourney.ts` fixtures with deterministic cards from the installed pack, wire the current-trip manager and guarded AI explanation, use the native offline map/GPS adapters, and connect ID-only SQLite storage with compatibility-aware restore. Readiness must come from native file/schema/hash validation rather than the current missing-assets state. Re-check in this preview reports the absent integration, not successful file verification. T46 remains unchecked until those dependencies and device usability are validated.

The store now accepts Cheapest/Fastest in addition to its previous preference values and supports renaming a saved label while preserving IDs and creation time. No persisted schema or migration is introduced because its existing backing is in memory. A real storage adapter will need to keep the canonical shared preference contract aligned.
