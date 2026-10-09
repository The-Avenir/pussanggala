# Playful commute chat: independent review

Review target: the mobile preview on `feat/t46-playful-commute-chat`, with the supplied reference at `.tmp/playful-chat-reference.png`. This note records the initial code and visual audit before the app-source changes are integrated, followed by observed implementation findings when those changes are available.

## Initial audit

The reference image is a purple learning dashboard: a large greeting and character hero lead into course progress, difficulty controls, course cards, topic cards, and four tabs. Its useful design cues are the clear hero-to-content scale change, friendly rounded controls, and compact secondary choices. Course progress, planets, a rocket, purple colors, and the four-tab structure do not fit a local commute planner. Keep Pusang Gala's cream, sunset orange, golden yellow, and brown palette, and use the supplied Gaile files as the brand artwork.

The current home implementation in `PlanScreen` leads with “Saan tayo?” and Gaile holding a map, then presents the From/To controls, Find routes, and location action before a separate Ask Pusang Gala row. That order makes manual routing the dominant first action. The shell still renders `CatMark` in its root header. The requested revision should lead with “Where to go?”, Gaile, and a usable question composer; “Enter landmarks” should disclose the existing manual controls. Keep examples, offline resources, and the onboarding replay easy to find without competing with the main entry.

Gaile has nine supplied transparent poses. The asset guide assigns wave to welcome and the empty ask state, think to understanding and clarification, pointing to route responses, map to route/map details, walk to trip progress, cheer to completion, binoculars to empty/error states, and idle to compact identity. Use the artwork where it explains a state or identifies the assistant; avoid repeating a large mascot on every screen. Small functional SVG controls remain appropriate, while the cat-shaped SVG used as the brand mark should go away.

The home-to-chat transition must retain the submitted text exactly once and show a clear limitation for unsupported or unavailable real journeys. An example response must require explicit example selection. Keep route facts distinct from assistant explanation, and preserve the existing conversation follow-ups, manual route editing, trip progression, saved routes, history, and privacy controls.

Accessibility acceptance remains practical and measurable: accessible names for the home composer and Send question, keyboard submission, useful disclosure state, 44-pixel touch targets, no horizontal overflow at 320, 390, and 430 pixels, and 200% text enlargement on home and existing dense screens. Contrast checks should read the active palette tokens so results stay tied to the implemented colors. Browser coverage cannot establish native Dynamic Type, VoiceOver, GPS, maps, or cold-offline behavior.

## Implementation findings

Source review of the current implementation shows the requested order: a golden “Where to go?” hero with the map pose, a compact Gaile identity panel, collapsed landmark disclosure, quick links, and the sticky chat composer. The new message path opens the conversation and appends the submitted text once; the out-of-scope branch keeps route data out of the response. The shell now uses supplied idle Gaile artwork in place of `CatMark`, and the conversation uses a compact Gaile identity beside a separated basic-summary answer. Nunito display/headings, DM Sans body text, warm surfaces, and rounded user/assistant bubbles carry the supplied color direction across the journey screens.

The independent review found that local `landmarksOpen` state reset on returning from Offline resources. A follow-up implementation moved it into `MobileShell`; the coordinator's browser run now verifies preservation after resources and onboarding replay. The coordinator also added explicit web expansion announcement and narrow-screen hero wrapping. The independent reviewer did not execute the browser export; the validation below was performed by the coordinator.

The updated browser acceptance in `apps/mobile/scripts/check-ui.mjs` covers the revised home entry, exact one-time query retention through Send question, out-of-scope failure without example route data, manual disclosure state and endpoint controls, original travel/privacy journeys, 320/390/430-pixel captures, and 200% text stress including the composer input. Brand checks target the actual `CatMark` source symbol while leaving functional SVG icons allowed; contrast checks read the active palette tokens.

## Release boundary

This remains the current NCR-only preview: bundled route data and model/map resources are not installed, location is unavailable in this browser flow, and trip progression is manual. Keep unsupported places and missing capabilities explicit. Do not imply operational maps, live model answers, background tracking, downloads, route discovery, or verified community reports. Browser results are interaction evidence for this preview, not native release acceptance.

## Coordinator validation and Orca record

Two Luna agents were launched through Orca with the effective model `gpt-6-luna`; app source and browser/review files had separate owners. All reports were accepted and acknowledged. Orca's release receipts retain the terminals as user-owned or external, with no remaining reclaimable workers.

| Task | Dispatch | Outcome and evidence |
|---|---|---|
| UI implementation | `ctx_3dbf016b44a9` | Succeeded: mascot-led home, sticky chat entry, shared typography and controls; mobile typecheck passed |
| Independent UX/browser review | `ctx_ae92c95db41e` | Succeeded: reference audit, meaningful browser acceptance, disclosure reset identified and routed |
| Implementation follow-up | `ctx_cfcbd2dbda8f` | Succeeded: retained disclosure, Enter/Shift+Enter composer, suggested questions and correct artwork proportions |

Run: `run_fddf6c02f506`. Branch: `feat/t46-playful-commute-chat`. Coordinator completed the final integration and browser validation: 320/390/430-pixel flows, 200% text, at least 44-pixel targets, live-token AA contrast, bundled-font loading before warm-offline captures, exact query retention, manual disclosure preservation, original route/trip/privacy handling, and no browser errors or external resource requests. See [validation](ux-screens/validation.json), [home](ux-screens/390-home.png), [conversation](ux-screens/390-chat.png) and [screen overview](ux-overview.png). Android/iOS export compilation is compatibility evidence; native device acceptance remains pending.
