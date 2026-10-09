const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.join(workspaceRoot, "packages/core")];
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];
// Hierarchical lookup stays enabled: apps/mobile's lockfile nests
// version-conflicted deps under node_modules/expo/node_modules
// (expo-asset, ws@8, accepts@1, zod@3), which flat lookup would misresolve.
// packages/core is a symlink whose realpath walks up to the repo-root
// node_modules, where its pinned zod@4.6.5 lives (root `npm install` required);
// app code resolves zod to apps/mobile/node_modules/zod@4.6.5.
module.exports = config;
