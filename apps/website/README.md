# Pusang Gala landing website

An interactive Android-app landing page using the mobile app's Sunset Playful
palette, locally bundled Nunito/DM Sans fonts and original Gaile artwork.

From the repository root:

```sh
npm run website:dev
npm run website:build
npm run website:check
```

The preview is **http://127.0.0.1:4173**. `PORT` can override the preview port.
The build output is `apps/website/dist/`. Publish that directory on a static
website host; no application server, environment secrets, runtime package install
or external font/asset service is required. All paths support subdirectory hosting.
The production output excludes these design/task documents and the development tools.

## Interaction design

- Responsive navigation with keyboard and Escape support.
- Gaile greetings and gentle pointer movement, with reduced-motion support.
- An illustrative three-moment commuter story that advances as visitors scroll,
  stays in view through all three moments and releases into the FAQ. Stage buttons,
  keyboard controls and insight reveals remain available; reduced motion and
  oversized content use the manual navigation fallback.
- Native FAQ disclosures and readable fallback content without JavaScript.
- A download section that changes only when an APK URL is configured.

The website is a marketing preview. It does not run the native assistant, search the
route pack or provide travel guidance. Copy reflects the current mobile README:
supported route facts are bundled; the separate local assistant needs setup;
basemap/GPS and persistent storage integration remain pending.

## Publish the Android download

The public CTA opens the project's GitHub release listing. It does not download
a file or assert that a verified APK, version, or measured size is available.
The configured URL in `site-config.js` is:

```js
export const siteConfig = Object.freeze({
  apkUrl: 'https://github.com/The-Avenir/pussanggala/releases',
  version: null,
  apkSizeLabel: null,
  releaseNotesUrl: 'https://github.com/The-Avenir/pussanggala/releases',
});
```

The existing URL safety checks accept relative same-origin URLs and HTTPS URLs;
invalid or unsafe values keep the unavailable state. Rebuild after changing
configuration. The CTA is an ordinary link without a `download` attribute and
visitors choose any published APK from the release listing themselves.

## Verification

`website:check` uses the existing repository Playwright dependency and installed
Chrome, starts an isolated test server, and shuts that server down afterward.
Set `WEBSITE_BROWSER_CHANNEL=chromium` to use an installed Playwright Chromium
instead. The check produces screenshots and `dist/qa/report.json`.

Covered widths: 1440, 1024, 390 and 320px. Checks include image loading, horizontal
overflow, scroll progression/reversal and sticky release, stage selection/reveal and keyboard controls,
FAQ, mobile navigation, download availability and URL safety, reduced motion,
200% text and no-JavaScript fallback. No third-party requests or browser errors
were recorded in the checked flows.

Fonts retain their original OFL notices under `assets/licences/`. Gaile artwork is
reused from the app. `PRODUCT.md`, `DESIGN.md` and `STORY_CONTRACT.md` document the
brand context and current journey contract. See [ORCA-REPORT.md](ORCA-REPORT.md)
for worker provenance and completion evidence.
