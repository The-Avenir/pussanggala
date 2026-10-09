const { getDefaultConfig } = require("expo/metro-config");
// SDK 52+ discovers npm workspaces and their package exports automatically.
const config = getDefaultConfig(__dirname);
// Binary assets still require explicit local imports/asset-plugin entries (T41).
config.resolver.assetExts = [...new Set([...config.resolver.assetExts,
  "sqlite", "db", "gguf", "pmtiles", "mbtiles", "pbf", "txt",
])];
// Shared TS sources use ESM .js specifiers for their eventual emitted files.
// Metro consumes the source directly. Preserve real JS resolution first, then
// let Metro resolve a missing relative .js import against its TS/native suffixes.
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = baseResolveRequest || context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
      try { return resolve(context, moduleName.slice(0, -3), platform); } catch {}
    }
    throw error;
  }
};
module.exports = config;
