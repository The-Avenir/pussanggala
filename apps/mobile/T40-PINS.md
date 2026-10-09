# T40 pins — native scaffold (feat/t40-scaffold-dev)

**Date (UTC):** 2026-10-10
**Branch:** `feat/t40-scaffold-dev` from `dev` @ `ae42517`
**Status:** manifest + lockfile pinned. Device build NOT run (no phone attached).

## 1. Pinned versions (from `npx expo install --fix`)

| Layer | Version |
|---|---|
| expo | 57.0.27 |
| react-native | 0.86.3 |
| react | 19.2.3 |
| llama.rn | 0.13.0-rc.7 (prerelease — S1 must confirm or drop to 0.12.x stable) |
| @maplibre/maplibre-react-native | 11.5.0 |
| expo-sqlite | 57.0.4 |
| expo-location | 57.0.20 |
| expo-asset | 57.0.19 |
| expo-file-system | 57.0.7 |
| expo-dev-client | 57.0.19 |
| expo-build-properties | 57.0.22 |
| Node floor | >=22.13 (verified 22.21.1) |
| Java | 17.0.14 |

Config plugins (`app.json`): `expo-build-properties`, `expo-sqlite`,
`expo-asset`, `@maplibre/maplibre-react-native`, `llama.rn`
(defaults: entitlements on/production, forceCxx20, OpenCL on).
`newArchEnabled: true`. Package `com.pusanggala.app`.
llama.rn key is `enableOpenCLAndHexagon` (0.13 renames `enableOpenCL`; old key warns).

## 2. Native-artifact caveats (must-read for fresh clones)

* `llama.rn` postinstall (`download-native-artifacts.js`) shells to `tar`.
  **Git Bash GNU tar misparses `C:\…` as host `C`** → `Cannot connect to C`.
  Workaround used here: Windows bsdtar first in PATH:
  `PATH="/c/Windows/System32:$PATH" cmd //c "node install/download-native-artifacts.js"`
  Installed: `android-jni-libs` sha `de870c02…` (arm64-v8a + x86_64 — **64-bit only,
  no armeabi-v7a; do not claim 32-bit support**), `ios-xcframework` sha `5cc9cd1a…`.
* `npm` warns `llama.rn` postinstall not in `allowScripts`. Fresh clones must
  approve or rerun the workaround above.

## 3. Model pin (T30 spike input, Member 3)

* File: `model/qwen2.5-0.5b-instruct-q4_k_m.gguf` (gitignored, never commit)
* Bytes: 469M · sha256: `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`
* Source: `Qwen/Qwen2.5-0.5B-Instruct-GGUF` (`/tree/main` at download — HF revision TBD)
* Template: ChatML · Context starter: 1024 · CPU baseline, 1 context / 1 gen

## 4. Phone targets (T00 record)

* Dev daily: owner's 8GB/256 phone (USB debugging, `adb devices` must list it).
* Reference (gates S1–S4/S7): Samsung Galaxy A06 SM-A065F, 4GB/64GB eMMC,
  Helio G85, arm64-v8a, Android 14. **In drawer until soak day.**
* Fallback: TBD (any 2nd low-RAM unit, 1 run).
* `ANDROID_HOME` must be `C:\Users\Vincent\AppData\Local\Android\Sdk`
  (verified present; env var empty at scaffold time — set per-user).

## 5. Real-pack input (PR #20, now on dev)

* `pack_ncr-2026-10`: 598 legs / 324 routes / 88 stops / 91 places, 2.4MB,
  sha `e43a4598…`, 21/21 acceptance. **Zero mapped places, zero shapes,
  all routes `service_status=unknown`** → map markers empty (honest unmapped),
  GPS suggest rarely fires, fares/hours mostly unknown. T41 wires this file;
  coordinates wait for T13 v2.

## 6. Next commands (needs phone plugged in)

```bat
set ANDROID_HOME=C:\Users\Vincent\AppData\Local\Android\Sdk
adb devices
npx expo prebuild --clean --platform android
npx expo run:android --device
```

## 7. Known non-green (honest)

* Mobile `tsc` over `src/core/index.ts` surfaces pre-existing
  `packages/core` errors (unresolved `zod` without root `npm install` +
  implicit-`any` in schema/cards/context/rank). Member-2 owned; not claimed.
* No device build, no S1/S2/S3 evidence yet. Expo Go runs remain non-evidence.
