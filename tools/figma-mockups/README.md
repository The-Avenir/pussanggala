# Figma mock-up builder

Tools to render the Pusang Gala walkthrough mock-up screens into the Figma file "Pusang Gala / Sunset Playful Mockups". Everything is built on a new page, `Pusang Gala / Walkthrough additions`; existing pages and frames are not touched.

- `spec/` — tokens.json and screens.json, the authoritative design values and screen content read from the live file.
- `serve.mjs` — local static server on `http://127.0.0.1:5577` that serves the spec and the trimmed Gaile PNGs to the plugin, and receives the inventory report.
- `plugin/` — the Figma plugin (manifest.json, code.js, ui.html).

## How to run

1. Start the server: `node tools/figma-mockups/serve.mjs`. Leave it running.
2. In the Figma desktop app, open the target file.
3. Plugins → Development → Import plugin from manifest… and pick `tools/figma-mockups/plugin/manifest.json`.
4. Run the plugin. Press **Inventory** first — it lists the file's pages, `Pusang Gala/*` components, `pg-*` variables, text styles and whether the Nunito / DM Sans fonts load, and writes the result to `tools/figma-mockups/inventory.json`.
5. Press **Build**. It creates (or clears and rebuilds) the `Pusang Gala / Walkthrough additions` page with the eight review wrappers, and a `Pusang Gala/Gaile` component set on that page. Any component, variable, text style or font that fails to resolve is listed in the plugin window — check it before assuming the screens are right.

Notes:

- The Gaile variants are square frames; the artwork inside keeps its trimmed pixel size, centred, so the mascot stays the same visual size across screens. When a screen spec gives a non-square `w`/`h` for a Gaile placement, the instance is rendered square at `max(w, h)`.
- PNG bytes are transferred from the iframe to the plugin main thread as `Uint8Array` for `figma.createImage()`; the main thread cannot fetch, so the server must be reachable from the iframe's origin (`networkAccess` in the manifest covers `http://127.0.0.1:5577`).
