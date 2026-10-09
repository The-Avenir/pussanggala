// One policy shared by native setup and the off-device APK input check.
// No glob may include curation inputs; glyphs are enumerated and pinned per file.
export const FORBIDDEN_PATH_MARKERS = [
  "howtogetthereph_dataset", "data/raw", "review-queue", "candidates.json",
  "dispositions.json", "yield-report", "raw-dataset", "training",
];
export const ALLOWLIST = [
  ["A1-pack-db", "pack", "assets/pack/pack.sqlite", "assets/licences/PACK-NOTICE.txt"],
  ["A2-pack-manifest", "pack", "assets/pack/pack.manifest.json", "assets/licences/PACK-NOTICE.txt"],
  ["A3-model-weights", "model", "assets/model/qwen2.5-0.5b-instruct-q4_0.gguf", "assets/licences/MODEL-LICENCE.txt"],
  ["A4-model-licence", "licence", "assets/licences/MODEL-LICENCE.txt", "self"],
  ["A5-map-tiles", "map", "assets/map/ncr.pmtiles", "assets/licences/MAP-ATTRIBUTION.txt"],
  ["A6-map-style", "style", "assets/map/style.json", "assets/licences/MAP-ATTRIBUTION.txt"],
  ["A7-map-glyphs", "glyphs", "assets/map/glyphs/", "assets/licences/MAP-ATTRIBUTION.txt"],
  ["A8a-map-sprite-json", "sprites", "assets/map/sprites/sprite.json", "assets/licences/MAP-ATTRIBUTION.txt"],
  ["A8b-map-sprite-png", "sprites", "assets/map/sprites/sprite.png", "assets/licences/MAP-ATTRIBUTION.txt"],
  ["A9-map-attribution", "licence", "assets/licences/MAP-ATTRIBUTION.txt", "self"],
  ["A10-pack-notice", "licence", "assets/licences/PACK-NOTICE.txt", "self"],
].map(([assetId, kind, bundlePath, licenceRef]) => Object.freeze({
  assetId, kind, bundlePath, licenceRef, description: "Requires measured file size and SHA-256 before use.",
}));
Object.freeze(ALLOWLIST);

// Existing UI art only, separate from required offline knowledge assets.
const figmaUiPaths = [
  "assets/figma/08b9c.svg",
  "assets/figma/18a08.svg",
  "assets/figma/1f84b.svg",
  "assets/figma/239f2.svg",
  "assets/figma/29042.svg",
  "assets/figma/2f68d.svg",
  "assets/figma/2ffb3.svg",
  "assets/figma/44e61.svg",
  "assets/figma/47028.svg",
  "assets/figma/4ab7b.svg",
  "assets/figma/4ce16.svg",
  "assets/figma/5c959.svg",
  "assets/figma/5f8e3.svg",
  "assets/figma/62fc3.svg",
  "assets/figma/787af.svg",
  "assets/figma/7a422.svg",
  "assets/figma/7cf24.svg",
  "assets/figma/b4595.svg",
  "assets/figma/b5dc8.svg",
  "assets/figma/bcb41.svg",
  "assets/figma/cc825.svg",
  "assets/figma/d4f14.svg",
  "assets/figma/d8c58.svg",
  "assets/figma/de22a.svg",
  "assets/figma/e681d.svg",
  "assets/figma/e6da9.svg",
  "assets/figma/eed90.svg",
  "assets/figma/f0ea4.svg",
  "assets/figma/f44dc.svg",
  "assets/figma/fb95a.svg",
  "assets/figma/ff654.svg",
  "assets/fonts/DMSans-Bold.ttf",
  "assets/fonts/DMSans-Regular.ttf",
  "assets/fonts/Nunito-Bold.ttf",
  "assets/fonts/Nunito-ExtraBold.ttf",
  "assets/licences/DMSans-OFL.txt",
  "assets/licences/Nunito-OFL.txt",
  "assets/ui-manifest.json",
  "assets/icon.png",
  "assets/adaptive-icon.png",
  "assets/favicon.png",
];
const mascotNames = ["wave", "walk", "think", "pointing", "map", "idle", "compass", "cheer", "binoculars"];
export const UI_ASSET_PATHS = Object.freeze([...figmaUiPaths, ...mascotNames.flatMap(name => [
  `assets/mascot/gaile-${name}.png`, `assets/mascot/trimmed/gaile-${name}.png`,
])]);
export const NON_SHIPPED_ASSET_DOCS = Object.freeze(["assets/mascot/README.md", "assets/mascot/Gaile App Icon.png"]);

export function findForbiddenMarker(value) {
  if (typeof value !== "string") return undefined;
  let path = value.toLowerCase().replaceAll("\\", "/");
  try { path = decodeURIComponent(path).replaceAll("\\", "/"); } catch { return "invalid_encoding"; }
  return FORBIDDEN_PATH_MARKERS.find(marker => path.includes(marker));
}
export function isSafeBundlePath(value) {
  return typeof value === "string" && /^assets\/[A-Za-z0-9_ ./@-]+$/.test(value)
    && !value.includes("//") && !value.endsWith("/")
    && value.split("/").every(part => part !== "." && part !== ".." && part.trim() === part)
    && findForbiddenMarker(value) === undefined;
}
export function entryForBundlePath(value) {
  if (!isSafeBundlePath(value)) return undefined;
  return ALLOWLIST.find(entry => entry.bundlePath === value || (
    entry.kind === "glyphs" && /^assets\/map\/glyphs\/[^/]+\/\d+-\d+\.pbf$/.test(value)
  ));
}
export function isAllowlisted(value) { return entryForBundlePath(value) !== undefined; }
export function isPackagedPath(value) {
  return isAllowlisted(value) || (isSafeBundlePath(value) && UI_ASSET_PATHS.includes(value));
}
export function listBundlePaths() { return ALLOWLIST.map(entry => entry.bundlePath); }
