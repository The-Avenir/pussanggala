## Problem and resulting behaviour

The mobile app previously exposed a technical walkthrough. It now provides a coherent commute interface with Plan, Map and Trips navigation, supplied Gaile mascot artwork, the existing sunset palette, and a “Where to go?” home conversation composer. Submitting a question carries the exact text into chat; users can also expand manual landmark entry.

The interface covers onboarding, conversation, route comparison, continuous directions, manually advanced trips, schematic maps, bundled-resource status, saved routes, history, privacy and settings. Missing native services are disclosed and walkthrough routes require explicit selection.

## Implementation and scope

- T46 UI preview using shared React Native components, Nunito/DM Sans fonts, safe-area layouts and compact contextual views.
- Supplied Gaile poses replace the custom SVG brand mark. Functional icons and schematic drawings remain.
- Chat supports multiline input, web Enter to send and Shift+Enter for a newline. Manual-entry disclosure survives navigation.
- Current release scope remains supported NCR commutes, bundled offline resources and manual trip advancement.
- Includes the original screen implementation and subsequent redesign commits through `25edfa3`, on `feat/t46-figma-mobile-screens` targeting `main`.
- Independent Luna implementation review and browser acceptance were coordinated through Orca. Another project member's approval remains pending.

## Validation

- Mobile TypeScript and 37-file UI asset hash/dimension checks passed.
- Android/iOS Hermes and web exports passed; these are compilation checks, not installed APK evidence.
- Browser checks passed with 96 captures at 320/390/430 px, 200% text, minimum 44 px touch targets and AA text contrast.
- Exact query retention, keyboard submission, disclosure restoration, route/trip flows, saves, history and privacy checks passed; no runtime errors or external requests.
- Source-content guard passed across 110 files.
- Offline browser checks ran after local assets/fonts loaded, with networking disabled. Native cold-start offline, physical-device accessibility and performance acceptance remain pending.

## Integration limits

Native AI, real routing-pack loading, offline geographic maps, foreground GPS and SQLite persistence remain unconnected. Current trip storage is in memory and onboarding repeats each fresh session. Real input does not silently receive synthetic route data. T46 final acceptance depends on T45 integration and T47 device validation; this remains a draft PR.

## Evidence

- [Design audit, journeys and interaction states](https://github.com/The-Avenir/pussanggala/blob/feat/t46-figma-mobile-screens/docs/ux-redesign.md)
- [Independent review and validation](https://github.com/The-Avenir/pussanggala/blob/feat/t46-figma-mobile-screens/docs/playful-chat-review.md)
- [Screen overview](https://github.com/The-Avenir/pussanggala/blob/feat/t46-figma-mobile-screens/docs/ux-overview.png)
- [Browser validation results](https://github.com/The-Avenir/pussanggala/blob/feat/t46-figma-mobile-screens/docs/ux-screens/validation.json)

## Acceptance

- [x] Scoped commits on a feature branch; no direct push to main.
- [x] Existing release scope and explicit example provenance preserved.
- [x] Applicable type, asset, export and browser checks passed.
- [x] Raw dataset, credentials and unrelated local changes excluded.
- [ ] Native pack/model/map/GPS/persistence integration.
- [ ] Installed APK cold-offline and device/performance acceptance.
- [ ] Another project member's review and approval.
