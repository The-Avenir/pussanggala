# Android technical harness (T40)

Member 4 owns the native scaffold. AI/conversation, local assets and user-store
implementations retain their separate ownership. This harness preserves the existing
synthetic journey screen; it does not establish model, pack, map or phone readiness.
See [T40 evidence](t40-build-evidence.md) for executed checks and unresolved gates.
The earlier `spike-t40.md` is historical research, not the installed-version record.

## Install and checks

Use Node >=22.13 and npm from the repository root. The root `package-lock.json`
is the only lockfile. Do not install a separate app dependency tree.

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run mobile:check
node tools/eval/allowlist-check.mjs
node --test tools/eval/allowlist-check.test.mjs
```

The app typecheck covers all mobile production TypeScript, including the existing
AI/conversation imports. Their test files remain covered by their own workspaces.
Mobile tests exercise build preflight, offline-release configuration and real workspace
links. Root tests also run the established core, AI, conversation and evaluation suites.
There is no repository lint command; TypeScript and the existing content checks are
the declared static gates.

Expo's default SDK-57 Metro configuration discovers npm workspace links and package
exports. Core resolves directly to `packages/core/src/index.ts`; AI/conversation resolve
to their existing packages. There is no copied core, compiler path alias or second React
runtime. Binary asset extensions support explicit static imports; they do not import
whole asset directories. T41 owns the final asset allowlist and loader.

## Local native generation and compilation

Build prerequisites: JDK 17 (`JAVA_HOME`), Android SDK (`ANDROID_HOME`), platform 36,
build-tools 36.0.0, platform-tools, and the NDK/CMake required by the generated RN/native
Gradle project. Gradle may fetch build dependencies; installed app runtime is offline.
No Expo account or EAS cloud build is needed.

```sh
# From the repository root:
npm run android:prebuild
node apps/mobile/scripts/verify-native.cjs
npm run android:development
npm run android:release

# From apps/mobile, once a USB-debuggable Android device is connected:
npm run android
npm start -- --localhost
```

`android:prebuild` regenerates ONLY the ignored `apps/mobile/android` directory;
hand-editing generated native files is not durable. Re-run it after native dependency
or plugin changes. The build scripts run `:app:assembleDebug` or `:app:assembleRelease`
with the generated Gradle wrapper, without requiring a phone, and print actual APK
paths, bytes and SHA-256 only after successful compilation. SDK/JDK failures return
nonzero and produce no APK claim. `npm run android:tooling` from the app inspects them.

Expected APK locations after successful builds:

- `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

The generated local release uses the template's debug signing key. It is suitable
for local installation checks, not distribution signing; T47 owns the release key.
Compilation never counts as phone installation, cold offline launch or performance
evidence. Expo Go cannot load the custom MapLibre/llama native modules.

## Native configuration and offline boundary

Expo `57.0.27`, RN `0.86.3`, React `19.2.3` and dev-client `57.0.19` are exact
manifest/lockfile pins. New Architecture is enabled; build ABIs are `arm64-v8a` and
`x86_64`. MapLibre `11.5.0` and llama.rn `0.12.9` are installed and their plugins
registered. llama's newer registry `latest` is a release candidate; this scaffold
uses the published non-prerelease `0.12.9`, with OpenCL disabled until T30 measures it.
Neither native execution nor GPU support is claimed.

The release manifest overlay removes INTERNET/ACCESS_NETWORK_STATE from the merged
release manifest. Debug retains local Metro access. Android backup and OTA updates
are disabled; background location/service, audio and shared-storage permissions are
blocked. There are no analytics, cloud fallback or upload SDKs. A merged-manifest/APK
permission audit and actual network-blocked cold launch remain required after compilation.
Removing INTERNET also prevents opening HTTP links inside the app; a future explicit
source-link action must hand off to a browser rather than fetch content.

## Adapter ports for T41 and T44

These are installed pins and available imports, not competing adapter implementations:

| Package | Exact pin | Adapter imports and constraints |
| --- | --- | --- |
| expo-asset | 57.0.19 | `import { Asset } from 'expo-asset'`; resolve static module assets with `Asset.fromModule`. Accept only bundled local URIs; never use a remote asset/download fallback. |
| expo-file-system | 57.0.7 | `import { File, Directory, Paths } from 'expo-file-system'`; private document/cache files, `copy`, `exists`, `size`, `uri`, native-readable paths. Old `copyAsync`/`getInfoAsync`/`documentDirectory` imports must use `'expo-file-system/legacy'`. |
| expo-sqlite | 57.0.4 | `import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'`; async query/bind APIs, transaction APIs and `closeAsync`. FTS is enabled; SQLCipher is disabled. Enforce read-only pack access in the T41 adapter; T44 owns the separate ID-only user DB and migrations. |
| expo-crypto | 57.0.3 | `import { digest, CryptoDigestAlgorithm } from 'expo-crypto'`; SHA-256 of bytes, not MD5 or stringified binary. This is a whole-buffer API: do not read a large GGUF into JS merely to hash it. Bounded-memory large-file hashing remains an adapter/device gate. |
| expo-location | 57.0.20 | Foreground permission/watch APIs only; T43 owns lifecycle and explicit origin confirmation. |

T41 adds final explicit bundled asset references/checksums once artifacts are eligible.
No pack, map or GGUF file is supplied by T40, and no raw curation dataset is imported.
T30/T31 consume the installed llama native module through their existing runtime/model
ports. A native runtime adapter and model selection are outside this task.
