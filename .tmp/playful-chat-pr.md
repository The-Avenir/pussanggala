## Problem and resulting behaviour

Home prioritized manual endpoint fields and used a custom SVG cat brand mark. It now asks “Where to go?” with a prominent supplied Gaile mascot, suggested commute questions and a sticky conversation composer. Sending from home retains the exact query once in the chat; Enter landmarks reveals the existing manual route flow.

The owner's playful iOS / Duolingo-like reference is translated using existing sunset colors, Nunito/DM Sans fonts, mascot poses, rounded conversation surfaces and tactile gold actions across the existing screens. This remains the React Native Android UI preview.

## Task and scope

- Task: T46 — playful commute chat UI preview
- Requirements: PRD-F1, PRD-F4, PRD-F5, PRD-F8, PRD-F9, PRD-F12 presentation
- Invariants: existing NCR scope, ID-only trip state, explicit fixtures, grounded facts and unavailable native services preserved
- Branch: feat/t46-playful-commute-chat
- Depends on: local redesign commits bacaf9c and 58427dd, built on draft PR #18; coordinate base before publishing
- Review: independent Luna UX/source review through Orca; another project member's merge approval remains pending

## Implementation

The SVG CatMark is removed from live app source; Gaile idle artwork carries compact identity. Local fonts load without blocking launch. Plan and Ask share the multiline composer and submit path. Web Enter sends, Shift+Enter inserts a newline, and manual-disclosure state lives in the shell to survive navigation. Screens retain route comparisons, continuous directions, manual progress, map fallback, saved/history and privacy controls. No core/native adapter or dependency manifest changes are included.

Two Luna workers completed implementation and independent UX/browser acceptance through Orca. Their findings, follow-up and coordinator integration evidence are documented in docs/playful-chat-review.md. Existing local manifest/theme/mascot/config/reference edits are excluded.

## Validation

- Mobile TypeScript check: passed.
- Existing UI asset hash/dimension guard: 37 assets passed.
- Android/iOS Hermes and web export: passed; these are compilation checks, not installed device evidence.
- Browser: 96 captures at 320/390/430px, 200% text, >=44px targets, live-token AA contrast, exact query retention, Enter/Shift+Enter, disclosure preservation, original travel/privacy flows, no runtime errors or external requests.
- Source-content scan: 110 files passed, no raw dataset leak.
- Offline check: warm browser with networking disabled after local font/art loading; native cold-offline acceptance pending.
- Device/performance: N/A for this browser preview; native phone/outdoor/lifecycle acceptance pending.

## Compatibility and risks

Native AI, routing pack loading, map/GPS and persistence remain unconnected. The preview repeats onboarding each fresh session until completion is persisted. Examples require explicit selection; real input does not silently receive synthetic route data. No new cloud, download, discovery, game, account or background-tracking feature is added.

## Evidence

docs/ux-overview.png, docs/ux-review.html, docs/ux-screens/validation.json, docs/ux-redesign.md, docs/ux-wireframes.html, docs/playful-chat-review.md.

## Checklist

- [ ] Branch created from current main — this intentionally stacks on the existing UI redesign; base coordination pending.
- [x] Conventional title and focused task branch.
- [x] Scope, requirements, dependencies and review status listed.
- [x] Confirmed release scope preserved.
- [x] No shared schema/API changes.
- [x] Applicable type, compile, asset and browser checks passed.
- [ ] Native airplane-mode/cold-start/device acceptance pending.
- [x] Missing facts and example provenance remain explicit.
- [x] Raw dataset remains excluded from runtime assets.
- [x] No cloud fallback, telemetry, secrets or raw chat/GPS persistence added.
- [x] N/A — native AI contract unchanged.
- [x] N/A — native map/GPS contract unchanged.
- [x] Native performance and footprint gates remain stated as pending.
- [x] Documentation and task status reconciled.
- [ ] Another project member approval and dependency merges pending.
