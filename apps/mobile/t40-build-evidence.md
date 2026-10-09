# T40 native scaffold evidence

Task: T40. Branch: `feat/t40-native-build`. Base: current `origin/main`
`ae42517be873d181e2f7ceb4c6e43d995bcc97fb`, fetched and fast-forward checked before
implementation. Date: 2026-10-10 (Asia/Shanghai). PRD-F5/F6/F7/F8/F9 foundation;
INV-1 through INV-7 preserved. Reviewer: Member 3 (CJ), pending.

This report supersedes scaffold/build claims in `spike-t40.md` and the stale suite
status. It does not mark actual-phone, corpus, model, map or release gates passed.

## Implementation and official version evidence

One root npm workspace/lockfile now installs the app and established core, AI,
conversation and eval packages. Mobile typecheck covers production source; Metro
uses Expo monorepo discovery. Existing owned adapters and packages are preserved.
Android CNG generates a minimal harness with registered Expo, llama and MapLibre
plugins. SDK 36/API 24+, New Architecture and arm64/x86_64 are configured.
Release network permissions are removed by a release-only manifest overlay;
debug retains local Metro access. Backup/OTA/background location/audio permissions
are disabled. No raw source/model/map assets or runtime network fallback are added.

Registry queried during this task (not copied from the earlier spike):

- `expo` stable `latest`/`sdk-57`: `57.0.27`; `next`/canary are excluded.
- `llama.rn` `latest`: `0.13.0-rc.7`; select published non-prerelease `0.12.9`
  with OpenCL disabled pending the AI owner's measurement.
- MapLibre `latest`: `11.5.0`; published peers accept Expo >=54, RN >=0.80,
  React/types >=19.1. Pin peer `@types/geojson` `7946.0.16`.
- [Expo SDK reference](https://docs.expo.dev/versions/latest/) maps SDK 57 to
  RN 0.86, React 19.2.3, Node >=22.13, Android compile/target 36.
- [Expo 57.0.27 compatibility manifest](https://unpkg.com/expo@57.0.27/bundledNativeModules.json)
  supplies RN `0.86.3`, React `19.2.3`, asset `57.0.19`, build-properties
  `57.0.22`, crypto `57.0.3`, dev-client `57.0.19`, file-system `57.0.7`,
  location `57.0.20`, SQLite `57.0.4`; these are exact app pins.
- [Expo monorepo guide](https://docs.expo.dev/guides/monorepos/) recommends the
  default Expo Metro config rather than historical manual workspace overrides.
- [MapLibre Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/)
  and [llama.rn 0.12.9 README](https://unpkg.com/llama.rn@0.12.9/README.md)
  establish plugin registration and the need for a custom native build.
- Adapter import/API references: [Asset](https://docs.expo.dev/versions/latest/sdk/asset/),
  [FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/),
  [SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/),
  [build properties](https://docs.expo.dev/versions/latest/sdk/build-properties/).
  The [app README](README.md) documents T41/T44 imports and ownership ports.

## Host and validation

Host: Windows 10.0.26200, PowerShell, Node `v26.11.1`, npm `11.12.1`.
`JAVA_HOME` points to Temurin JDK `17.0.16+8`; bare PATH `java` is JDK 25,
so the build helper deliberately resolves Java from JAVA_HOME.
No ANDROID_HOME/ANDROID_SDK_ROOT or adb/Gradle command is configured. The standard
`C:/Users/cjds0/AppData/Local/Android/Sdk` contains only a `.sdk` cache directory;
platform/build/platform-tools have not been found there. No phone was measured.

| Exact command (repo root unless specified) | Result |
| --- | --- |
| `git fetch origin main`; `git pull --ff-only origin main` | Base matches current main; clean task branch created. |
| `npm install --no-audit --no-fund` | Exit 0, added 488 packages in 4m; one transitive uuid deprecation warning. |
| `npm ci --no-audit --no-fund` | Running; clean-install evidence pending. |
| `npm run typecheck` / `npm test` | Pending clean install. |
| `npm run mobile:check` | Pending. |
| `npm run android:prebuild` / `node apps/mobile/scripts/verify-native.cjs` | Pending. |
| `npm run android:development` / `npm run android:release` | Initial preflight exit 1: no SDK configured; prebuild still pending. No Gradle compilation/APK produced. Re-run after native generation. |
| Existing content/negative/pack/restore checks | Pending. |

## Unresolved gates

- [ ] Android debug and release compilation and merged-release manifest/APK permission audit.
- [ ] APK paths/bytes/SHA-256: no APK has been built; README paths are expected outputs only.
- [ ] Named reference/fallback phone ABI, Android/RAM; install, cold offline launch.
- [ ] T30/T31 native model adapter and selected/licensed/checksummed model; S1/S5 evidence.
- [ ] T41 final asset allowlist, real pack/model/map readiness and bounded-memory large-file SHA-256.
- [ ] T42 local tile/style/glyph/sprite rendering and S2; T43 outdoor foreground GPS/S3.
- [ ] Integrated S4/S7, actual latency/PSS/installed footprint; no performance claims.
- [ ] Distribution signing (T47); generated local release uses template debug signing.
- [ ] Other-member review. T40 remains incomplete until build/device gates are measured.
