const { getDefaultConfig } = require("expo/metro-config");
// SDK 52+ discovers npm workspaces and their package exports automatically.
const config = getDefaultConfig(__dirname);
// Binary assets still require explicit local imports/asset-plugin entries (T41).
config.resolver.assetExts = [...new Set([...config.resolver.assetExts,
  "sqlite", "db", "gguf", "pmtiles", "mbtiles", "pbf", "txt",
])];
module.exports = config;
