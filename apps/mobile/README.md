# apps/mobile — Expo app (placeholder)

**Owner:** Member 4 (mobile, maps, GPS, release). `src/ai/` and
`src/conversation/` are owned by Member 3.

**Tasks:** T40 (Expo scaffold/pinned build), T41 (assets/pack loader), T42
(offline basemap), T43 (foreground GPS), T44 (persistence), T45 (integration),
T46 (UI), T47 (judged APK).

The Expo application is created in T40 — no app manifest exists yet. Guardrails
(BUILD §5): the supplied `howtogetthereph_dataset/` raw input must never appear
in app assets; the APK uses an explicit asset allowlist (pack/model/map/style/
glyph/sprite/licence files, with hashes); no runtime networking, analytics or
crash-upload SDKs; no raw chat or GPS-coordinate persistence.
