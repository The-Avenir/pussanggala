# Reference UI adaptation — 2026-10-10

The native app follows the layout and visual hierarchy in `REFERENCE_UI`: a Gaile header and subtitle, compact peach greeting, avatar beside each assistant bubble, visible landmark planner, orange actions, transport cards, and highlighted tab backgrounds. Existing functional controls, callbacks, and route information remain available.

Home shows “Kumusta, gala?”, the From/To form, location and Find routes controls, and four illustrated destination tiles. The existing form state starts open and can still be collapsed. Tiles submit ordinary questions through the existing conversation callback; they do not choose a place ID or open an example route. Onboarding uses the reference's skyline composition and large Gaile artwork. Chat retains its pinned composer, streaming reply, Stop, reset, place selection, and follow-ups. Directions and active trips explain the selected step in a Gaile bubble, while retaining the timeline, signboards, manual progress, and navigation. Saved trips and offline resources use the same message and card treatment. Empty states, errors, and confirmation sheets remain accessible.

The layout refresh changed UI components, styles, and the UI check script. No dependencies, fonts, bitmap assets, animations, network requests, or new state were added. Small native SVG sketches decorate destination tiles; they do not depict boarding entrances or maps. Typography and spacing follow the reference while allowing device text scaling. Long buttons and settings values wrap at larger text sizes.

Follow-up preset regression: native inspection found that an unresolved Cubao clarification survived explicit One Ayala and SM North EDSA requests. The tile callbacks and parser emitted the correct destination; the conversation manager accepted only `new_trip` while a clarification was pending, ignoring `change_destination`. The manager now applies explicit endpoint changes, retains a confirmed other endpoint, and preserves a deferred destination when replacing an ambiguous origin. Bare names outside the choices and non-selection follow-ups still require clarification. Six integration cases exercise the actual bundled pack, including the three destination presets, retained origin, and both deferred-destination cases. The three preset tests failed with the exact Cubao candidates before the fix and passed afterward. Mobile checks passed 167 Vitest tests plus four script tests; conversation checks passed 52 tests; both TypeScript checks passed. RAG data, place resolution, inference, scheduling, storage, and location logic remain unchanged.

The follow-up APK was rebuilt and installed with `adb install -r`, preserving app data. Its installed SHA-256 matches `.tmp/artifacts/pusang-gala-preset-fix.apk`: `f46f2ad88cdb5ab46582edded250c88e905d2f701a65283d687a4cb622f30f64`. Native taps replayed Cubao → back → One Ayala → back → SM North EDSA. Cubao still offered the three correct choices; the next two destinations cleared them, updated the journey context, and completed replies acknowledging their respective places and asking “Saan ka manggagaling?” Local model replies took time to settle; this patch does not change inference latency. Evidence: `.tmp/debug/preset-before.png`, `preset-after.png`, `preset-fix-north-settled.json`, and `preset-install-verification.json`. The corrected conversation was left visible on the phone.

Validation:

- Mobile TypeScript check passed.
- Mobile regression tests: 161 Vitest tests and four build/script tests passed.
- Asset validation: 37 local UI assets passed integrity checks.
- Browser UI suite passed 96 screen/layout checks at 320, 390, and 430 pixels, including 200% text and minimum 44-pixel touch targets. Eleven contrast pairs met 4.5:1. No runtime errors or external requests were observed in the warm offline test. Checks now verify the planner initially opens, collapse/expand still works, and destination tiles send their exact question once without substituting example routes.
- Existing browser chat suite passed progressive replies, identity/capabilities, Enter/Shift+Enter, Stop, and reset checks.
- Android release build succeeded with JDK 17, SDK 36, and the existing local signing key. The new native bundle contains the revised greeting, planner, composer, and palette. The manifest retains INTERNET permission for model downloads and excludes network-state, background-location, and microphone permissions.
- USB replacement installation succeeded with `adb install -r`; installed APK SHA-256 matches the new artifact. Native inspection confirmed the Gaile header, “Kumusta, gala?” greeting, From/To fields, and “Message Gaile…” composer. The Cubao destination tile produced the three expected Araneta City, Cubao LRT-2, and Cubao MRT-3 choices. The phone was returned to the new home screen with the planner open.

Local artifacts, intentionally outside version control:

- Baseline and final browser screenshots: `.tmp/ui-reference/before/`, `.tmp/ui-reference/redesign/`.
- Android build log: `.tmp/ui-reference/android-layout-redesign.log`.
- APK: `.tmp/artifacts/pusang-gala-reference-layout.apk`, 180,289,392 bytes; SHA-256 `5fe36f5b727e7acdc97532e5b69e4798b42c3bf8332c74833976d5053a1de63f`.
- Native screenshots: `.tmp/ui-reference/redesign/native-home.png`, `native-welcome.png`, and `native-cubao.png`. Install verification: `.tmp/ui-reference/layout-install-verification.json`.

The browser checks exercise the walkthrough and unavailable-native-data states. They do not establish native GPS, basemap availability, screen-reader acceptance, or a measured performance improvement. Existing model-generation limitations remain; this change does not modify the assistant's reply guard or fallback.
