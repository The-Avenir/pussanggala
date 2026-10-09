# Mascot assets: Gaile

This directory holds the production artwork for Gaile, the Pusang Gala mascot. The source images are 1254x1254 RGBA PNGs with real transparency (alpha range 0–255) and transparent padding around the character.

`Gaile App Icon.png` is the launcher icon source (1666x1666 RGBA rounded-square artwork, ~99% of canvas with transparent corners). `assets/icon.png`, `assets/adaptive-icon.png` and `assets/favicon.png` are derived from it — see `app.json` (`expo.icon`, `android.adaptiveIcon`, `web.favicon`) and regenerate with `python scripts/update-app-icon.py`. The adaptive foreground scales the artwork down so all opaque pixels stay inside the 72dp safe circle; the `#FFF0DD` `iconBackground` colour fills the rest of the canvas.

`trimmed/` contains one variant per pose for layout work: each image is cropped to the visible artwork (pixels with alpha above a small threshold, discarding a faint halo present in the sources) and resized with a single scale factor shared by all nine poses, so Gaile keeps a consistent size across screens. Canvas sizes therefore vary; only `gaile-walk`, the tallest pose, reaches 512 px tall. The halo pixels are also cleared in these files, so no ghost edges appear over coloured backgrounds. Use the trimmed files in Figma frames and other mock-ups where tight bounding boxes and consistent scale matter; use the full-size files as the canonical source.

## Poses and intended screens

Screen numbers refer to `docs/app-walkthrough.md` §4.

| File | Pose | Intended screens |
|------|------|------------------|
| gaile-compass.png | holding a compass, sparkles | 0 Launch / readiness check |
| gaile-wave.png | waving a paw | 1 Welcome, 3 Ask empty state |
| gaile-think.png | paw to chin | 3 "Iniisip ko…" understanding state, 4 Clarification sheets |
| gaile-pointing.png | pointing forward, mid-stride | 5 Response display, 6 Route options |
| gaile-map.png | holding an open map | 7 Route details, 8 Map / Schematic |
| gaile-walk.png | walking forward | 9 Commute progress |
| gaile-cheer.png | both paws raised | 10 Trip complete |
| gaile-binoculars.png | scanning with binoculars | 11 Saved empty state, 14 not-found / error states |
| gaile-idle.png | neutral standing | app bar avatar, 12 Profile signed-out |
