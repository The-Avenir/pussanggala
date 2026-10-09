# T40 native scaffold evidence

Task: T40. Branch: `feat/t40-native-build`. Base: current `origin/main`
`ae42517be873d181e2f7ceb4c6e43d995bcc97fb`, fetched and fast-forward checked before
implementation. Draft PR: [#21](https://github.com/The-Avenir/pussanggala/pull/21).
Date: 2026-10-10 (Asia/Shanghai). PRD-F5/F6/F7/F8/F9 foundation;
INV-1 through INV-7 preserved. Reviewer: Member 3 (CJ), pending.

This report supersedes scaffold/build claims in `spike-t40.md` and the stale suite
status. It does not mark actual-phone, corpus, model, map or release gates passed.

## Implementation and official version evidence

One root npm workspace/lockfile now installs the app and established core, AI,
conversation and eval packages. Mobile typecheck covers production source; Metro
uses Expo monorepo discovery. Existing owned adapters and packages are preserved.
The Metro resolver first preserves normal resolution, then supports missing relative
`.js` specifiers in checked-in TS sources. Android bundling exposed this integration
requirement; it is fixed in configuration without editing the other owners' modules.
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
- Expo's actual compatibility check additionally requires `@types/react ~19.2.4`;
  exact `19.2.4` replaces the prototype's `19.2.3`. The first compatibility/CI run
  rejected that older types pin; corrected-pin CI passes.
- [Expo monorepo guide](https://docs.expo.dev/guides/monorepos/) recommends the
  default Expo Metro config rather than historical manual workspace overrides.
- [Expo custom resolver documentation](https://docs.expo.dev/guides/customizing-metro/)
  documents delegating custom resolution to the standard context resolver.
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
| `npm ci --no-audit --no-fund` | Exit 0 on final pins: 531 packages in 7m. Native postinstall scripts enabled, not skipped. Earlier clean install also passed (531 packages in 2m). |
| `npm run typecheck` | Exit 0 after final clean install: all five workspaces, including mobile production source and existing core/AI/conversation test typechecks. |
| `npm test` | Exit 0 after final clean install: 580 tests, core 427, mobile 3, conversation 52, AI 88, eval 10. |
| `npm run mobile:check` | Exit 0: dependencies up to date; all configured plugins load. Final llama plugin uses `enableOpenCLAndHexagon: false`, with no deprecated-option warning. |
| `npm run android:prebuild` | Exit 0: clean local Android generation, no package manifest changes. No SDK or phone is needed for generation. |
| `node apps/mobile/scripts/verify-native.cjs` | Exit 0: release network overlay, backup off, foreground-only permissions, GPU libraries not requested, New Architecture and ABIs verified. Generated Gradle wrapper is `9.3.1`. |
| `npm exec --workspace @pusang-gala/mobile -- expo-modules-autolinking react-native-config --platform android --json` | Exit 0: both llama.rn and MapLibre have Android source directories under this checkout's root node_modules. Expo config also lists the installed Expo native modules. |
| `npm run export:android --workspace @pusang-gala/mobile` | Exit 0 after Metro resolver fix: Android Hermes bundle, 728 modules, `apps/mobile/dist/android`; no model/pack/map binaries bundled. This is JS bundling, not native compilation or runtime execution. |
| `npm run android:development` / `npm run android:release` | Each exit 1 at preflight after generation, with process-local `ANDROID_HOME=C:/Users/cjds0/AppData/Local/Android/Sdk`: platform `android-36/android.jar`, `build-tools/36.0.0`, `platform-tools/adb.exe` all absent. JDK 17 verified. Neither Gradle compilation nor APK output produced. |
| `node tools/eval/allowlist-check.mjs` | Exit 0 after final source/config/native generation: 15/15 self-tests, 110 scanned files, no leak; raw build input is excluded. |
| `node --test tools/eval/allowlist-check.test.mjs` | Exit 0: 12/12 positive/negative fixtures. |
| `node tools/eval/t44-restore-check.mjs` | Exit 0: 16/16 self-tests, 7 restore fixtures plus deletion/privacy checks; synthetic fixture evidence only. |
| `node --test tools/corpus/*.test.mjs tools/pack-builder/*.test.mjs` | Exit 1: 43/44 pass. Existing `tools/corpus/evidence.test.mjs` cannot open absent off-device `data/raw/t11/candidates-s0.jsonl` (ENOENT). No substitute inputs or corpus fixes made. |
| [GitHub Actions on corrected pin](https://github.com/The-Avenir/pussanggala/actions/runs/37979986792) | PASS on Linux/Node 22: clean install, root/mobile type/tests, Expo config/dependency checks, Android prebuild/manifest inspection, content guards. No native compilation step in this job. |

The CLI emitted a transitive uuid deprecation during installation and color-environment
warnings during bundling; both commands passed. The evaluation suite regenerates its
existing preliminary/stub report. Only this run's
generated timestamp/host timing changes were restored; no AI/conversation/eval source
or pre-existing evidence was replaced. Stub scores are not model or device evidence.

Reproducibility identifiers for this host run:

- Root lockfile SHA-256: `e192425bfbb1604d78ba11a7c3ff2e9e1ad6de72720ebc635bdc36a5d584997b`.
- Exported JS/Hermes file (ignored build output):
  `apps/mobile/dist/android/_expo/static/js/android/index-34482539d5a32d83542ff1175a146027.hbc`,
  2,370,030 bytes, SHA-256 `a3e8679c7a078d2b93a9cf53c7f52583723af769ff9b3e9a6ee1cdd1ac19fe52`.
  This is not an APK, installed-footprint result or device benchmark.
- llama.rn native postinstall marker matches pinned Android archive SHA-256
  `cda945a7c0ed075a0b028c1c3c6f5b668532eb18b069ecc4793ed7ca6cdb65ac`.
  This identifies runtime-library installation, not a selected model or inference run.
- MapLibre package Android native version: `13.6.1` from its installed Gradle properties.

All feasible T40 host checks are complete. Both build commands were attempted and
stopped before compilation for the documented missing SDK components; no APK path,
APK checksum or successful native-build claim exists. T40 stays partial pending those
gates and other-member review. The final PR checklist also records current CI results.

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
