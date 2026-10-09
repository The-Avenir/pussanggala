## Resulting behaviour

The app provides Gaile-led onboarding, the existing sunset colors and fonts, a “Where to go?” conversation composer, and Plan / Map / Trips navigation. Questions transition into chat without losing their text; manual landmark entry, route comparisons, continuous directions, manual trip progression, saved/history/privacy and honest unavailable states remain available.

This integration combines the UI redesign (#18), native Android scaffold (#21), SQLite trip persistence (#22), native pack adapter (#23), and validated offline asset setup (#24). Original branch histories are preserved through merge commits.

## Compatibility fixes

- Preserve MobileShell and register the app once through index.ts.
- Retain T40 exact native pins, the root workspace lockfile, offline release overlay and foreground-only permissions.
- Combine workspace Metro resolution with existing SVG transformation; retain the web review target.
- Enumerate existing UI assets in the packaging policy while continuing to reject unknown files.
- Keep Node-only persistence tests in their dedicated typecheck and run the loader/store suites in CI.
- Use a non-placeholder mismatch fixture under the stricter checksum policy.

## Validation

- Clean root install and all workspace typechecks passed.
- 640 workspace tests, 81 builder-compatible asset tests and 17 packaging tests passed.
- Expo configuration, clean Android generation and generated offline settings passed.
- Android Hermes and web exports compiled.
- Browser suite passed with 96 captures at 320/390/430 px, 200% text, minimum 44 px targets, AA text contrast, and no runtime errors or external requests.
- All 37 UI asset hash/dimension checks and shipped-content guards passed.

## Remaining acceptance

Native source foundations are implemented, but the live UI still uses explicit examples and in-memory trip state. Real pack/model/map bytes, native startup bindings, persistent onboarding/trips, map/GPS/AI wiring, installed APK and cold-offline/device/performance acceptance remain pending. Production assets/index.ts defines the builder-compatible pack loader; the earlier nativePackAdapter prototype needs manifest reconciliation before production use. T40/T41/T44/T46 remain partial in the task tracker.

[Integration evidence and compatibility decisions](https://github.com/The-Avenir/pussanggala/blob/feat/t46-figma-mobile-screens/docs/pr-integration.md) · [Design audit](https://github.com/The-Avenir/pussanggala/blob/feat/t46-figma-mobile-screens/docs/ux-redesign.md) · [UI review](https://github.com/The-Avenir/pussanggala/blob/feat/t46-figma-mobile-screens/docs/playful-chat-review.md)
