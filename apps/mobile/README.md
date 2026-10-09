# Pusang Gala mobile app

Member 4 owns the native scaffold. AI/conversation, local assets and user-store
implementations retain their separate ownership. The UI preview does not establish model, pack, map or phone readiness.
See [T40 evidence](t40-build-evidence.md) for executed checks and unresolved gates.
The earlier `spike-t40.md` is historical research, not the installed-version record.

The current entry point is the T46 playful commute chat: Gaile-led onboarding, the Sunset Playful palette, rounded Nunito headings and a “Where to go?” home with a sticky chat composer. The supplied mascot replaces the SVG cat logo. Plan, Map and Trips remain the main destinations; “Enter landmarks” reveals manual routing. The preview shows onboarding once per fresh session; native integration must persist its completion flag for returning users. See the [audit, navigation, interactions and validation](../../docs/ux-redesign.md), [visual review](../../docs/ux-review.html), [wireframes](../../docs/ux-wireframes.html), and [independent Luna review / Orca record](../../docs/playful-chat-review.md). Run `npm run web` here to explore it. Native AI is connected through llama.rn and an explicit model download (see below). Route data is now bundled and connected to real queries. Basemap, GPS and persistent storage remain unconnected; synthetic examples require an explicit action. The earlier [Figma implementation](../../docs/ui-figma-implementation.md) is preserved as a comparison baseline.

## Bundled route retrieval

The Android app ships the validated October 2026 NCR SQLite pack: 69 routes,
134 directed legs, 91 places. It checks database and companion hashes, SQLite
integrity and foreign keys, then loads the complete core pack without networking.
Ask Gaile and Enter landmarks → Find routes use core parsing, place resolution,
directed routing, ranking and cards. Clarifications, fare/boarding/hours follow-ups,
preferences and return trips retrieve fresh evidence. Route replies use conversational
Taglish templates over validated cards and start immediately without loading Qwen.
Full cards and dated source IDs are available behind Route reports & sources.

Gaile also answers greetings, identity/capability questions, route coverage and
offline-help questions locally. Replies stream into the chat with a Stop action.
Route replies retain unknown/conflicting fares and hours without guessing. Native
explanation sampling for explicit examples is constrained to canonical statement IDs.

Rebuild with `npm run pack:bundle --workspace @pusang-gala/mobile` from the repo
root. The build-time tool audits the local raw snapshot against the cleaned seed,
writes SQLite/companion assets, and measures checksums into
`src/routing/packCatalog.json`. Raw data is never imported into the application.
Basemap, GPS and persistent trip storage remain separate integration work.

Android verification uses PusangModelHash, a cancellable native SHA-256 worker with
a 1 MB buffer. It hashes every byte without transferring the GGUF into JavaScript.
Imports, downloads, startup and manual rechecks retain exact size and hash checks.
The with-model-hash plugin preserves registration across prebuild. Platforms without
the Android module use bounded JavaScript hashing.

## On-device Qwen assistant

In a native build, open **Settings → Offline resources → Download local assistant**.
Alternatively, transfer the matching GGUF to the phone (for example, via USB into
Downloads), then choose **Import local GGUF** on the same screen. The system file
picker grants access to that file; it is copied to private app storage and must pass
the same size and SHA-256 checks. Importing makes no network request and requires no
shared-storage permission. Cancelling the picker leaves the current status intact.
The app downloads `qwen2.5-0.5b-instruct-q4_k_m.gguf` from Qwen's
[ModelScope GGUF repository](https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct-GGUF), pinned to
revision `2e50b77b0eee3083842019e257b74854323d880a` (491,400,032 bytes).
SHA-256 is `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`.
The Apache 2.0 model licence is bundled in `assets/licences/MODEL-LICENCE.txt`.

Download progress and verification progress are visible. Files live in private
document storage under `models/`; `.part` downloads cannot reach inference.
Size and SHA-256 must match before promotion to the final filename. SHA-256 uses
1 MB chunks rather than reading the whole model into JS memory. Cancelled or
failed downloads are cleaned up and can be retried. Allow at least 560 MB free.
App startup verifies an existing file without making network requests; the model
survives restarts. Downloads and generation are cancelled when the app backgrounds.

`src/adapters/llamaRuntime.ts` implements the AI package's `ModelRuntime` port:
local model load, chat-template completion, token-to-async-iterator streaming,
cancellation and context release. Native loading itself cannot be interrupted;
cancellation rejects promptly and releases any context that arrives later.
The default is CPU inference with mmap, two threads, a 2,048-token context and
384 output tokens. These are conservative defaults, not measured device budgets.

`src/inference/useLocalAssistant.ts` owns installation and one inference at a time.
Once installed, explicit example answers are explained on-device through `ai.explain` and its
existing NDJSON grounding guard. Only complete validated units reach the screen;
invalid output or native errors restore the deterministic summary. Stop cancels
generation, and clearing a conversation prevents late output from reappearing.
Explicit example journeys keep their synthetic context. Installed route answers,
identity/capability questions and failures do not invoke the model: retrieved facts
are phrased locally so a commute query does not wait for native generation.

Expo Go and web cannot run llama.rn. Use an Android development/release build;
the bridge also uses llama.rn's iOS API, but this app currently targets Android
and web. Native load, inference quality, memory and performance need phone testing.

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
Mobile tests exercise build preflight, download permissions, workspace links, the
model installer and the llama adapter through injected native contexts. Root tests
also run the established core, AI, conversation and evaluation suites.
There is no repository lint command; TypeScript and the existing content checks are
the declared static gates.

Expo's default SDK-57 Metro configuration discovers npm workspace links and package
exports. Core resolves directly to `packages/core/src/index.ts`; AI/conversation resolve
to their existing packages. A resolver fallback supports existing relative `.js`
specifiers in TypeScript source while preferring actual JavaScript files. There is no
copied core, compiler path alias or second React
runtime. Binary asset extensions support explicit static imports; they do not import
whole asset directories. T41 owns the final asset allowlist and loader.

## Local native generation and compilation

Build prerequisites: JDK 17 (`JAVA_HOME`), Android SDK (`ANDROID_HOME`), platform 36,
build-tools 36.0.0, platform-tools, and the NDK/CMake required by the generated RN/native
Gradle project. Gradle may fetch build dependencies; model setup needs internet,
and subsequent inference uses the local model.
No Expo account or EAS cloud build is needed.

The native config pins Gradle 9.1.0. The SDK template's Gradle 9.3.1 fails to
compile React Native 0.86.3's Kotlin settings when `pluginManagement` precedes
`plugins`; an isolated settings build reproduces it on both JDK 17 and 21.
Keep the config plugin registered so subsequent prebuilds retain the working version.

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

For a connected USB-debuggable phone, `adb devices` should list its status as
`device` (accept the USB debugging prompt if it says `unauthorized`). Install the
standalone release from the repository root with:

```sh
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

The release includes its JavaScript bundle and does not need Metro. Open the app,
then Settings → Offline resources to download Qwen. The GGUF is downloaded into
private app storage and is not bundled in this APK. For a smaller arm64 phone-only
build, set `ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a` before building.

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
The app uses native CPU inference; GPU support remains unmeasured.

The release manifest overlay permits INTERNET for the explicit model download and
removes ACCESS_NETWORK_STATE. Debug retains local Metro access. Android backup and OTA updates
are disabled; background location/service, audio and shared-storage permissions are
blocked. There are no analytics, cloud fallback or upload SDKs. A merged-manifest/APK
permission audit and actual offline cold launch after model installation remain
required after compilation. This download-enabled build supersedes the earlier
network-permission-free release configuration recorded in historical evidence docs.

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
The integrated app now supplies a pinned route pack and a native Qwen runtime.
The map remains missing, and the GGUF is imported or downloaded into private storage.
Raw curation data is never imported into the runtime.
