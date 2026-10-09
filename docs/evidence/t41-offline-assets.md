# T41 — Local asset integrity, pack loading and readiness

Date: 2026-10-10. Task owner: Member 4 (Vincent/mobile assets). Branch:
`feat/t41-offline-assets`, created from fetched `origin/main`
`ae42517be873d181e2f7ceb4c6e43d995bcc97fb`. Draft PR:
[#24](https://github.com/The-Avenir/pussanggala/pull/24).

**Status: host implementation validated; final assets, native integration and
device acceptance remain open.** T41 is not marked Done. This report supersedes
the synthetic-only T41 research claims for the files changed here.

## Result and scope

Production startup uses `apps/mobile/src/assets/index.ts` and
`setupLocalAssets({ baseDir, catalog, ports })`. An explicit catalog pins the
size, SHA-256, revision and licence reference for each file. There is no default
pack/model/map, no download resolver and no cloud recovery. Missing final pins
produce missing readiness. Known placeholder hashes and stub revisions fail.

Source and installed files are verified before SQLite opens. Damaged private
copies can be repaired from verified APK files; copied bytes are checked again.
An external `pack.manifest.json` must match the pinned pack checksum, size and
identity. The reader checks schema version 1, SQLite `user_version`, integrity,
foreign keys and the single manifest, reads the builder's singular table names
into core's plural `RawPackTables`, and calls the existing core `loadPack`.
It closes the connection before publishing an in-memory `Pack`; failed
validation never publishes a partial graph. Source dates, excluded records,
unknown/conflicting values and status remain core-owned facts.

`canRoute` depends on the validated pack. Missing/damaged model or map files
leave that pack usable. `retainValidCards` retains previously validated
in-memory cards through setup errors, while failed pack readiness prevents new
queries. When a replacement pack loads, both pack ID and checksum must match
before old cards can be retained; changed packs require reconstruction through
core/T44. Setup never reads/writes conversation, GPS, trips or the user DB.

The old T45 screen imports are retained as a clearly labelled demo compatibility
facade in `loader.ts`/`demo-fixtures.ts`. Snapshot-only setup always fails or
reports missing; it cannot advertise ready assets. The production entry and its
dependency graph exclude these demo helpers. T45 still owns replacing its
existing synthetic screen wiring.

The shared shipping policy lists exact knowledge-asset paths, individual glyph
PBFs and the 18 existing mascot image paths. The builder companion filename is
now `assets/pack/pack.manifest.json`. The model filename in the policy is an
allowed candidate path, not a selected/pinned model. A different model/map
format needs a focused policy change when T31/T42 settle it. The existing
mascot README is a non-shipped document, not a permitted registry asset.
The build-input scanner now checks binary paths and rejects symlinks/junctions,
unlisted files, raw-input markers, traversal and unsafe encodings. It still
excludes the repository's intentional raw input directory from wording scans.
This checks source packaging inputs, not an APK that has not been built.

Only assets/adapters, T41 tests/evidence, the allowlist tool/tests and the T41
TODO status are changed. No manifests, lockfiles, app/build configuration,
screens, AI/conversation/store, core, corpus/builder or seed files are changed.
The original checkout and its active Cursor work were not accessed or modified.

## Integration ports and native dependency needs

`AssetPorts` contains `files.stat/sha256/readText/copy`,
`bundle.resolve` and `sqlite.openReadOnly`. Native consumers must await setup,
serialize setup/retry calls, and release model/map file handles before asset
replacement. The install root must be an app-private `file:///` URI, separate
from T44's writable user SQLite. Nonlocal/relative/authority-bearing paths are
rejected before native access. The catalog is reviewed app configuration, not
an untrusted sidecar allowed to select files or change trusted pins.

`createExpoAssetPorts` accepts installed modules through structural bindings;
it does not pretend the uninstalled modules executed here. T40 must supply:

- `expo-file-system`: `File`, existence/size, `parentDirectory.create`,
  `text`, `open/readBytes/close`, local `copy/delete`.
- `expo-asset`: an exact static module registry with already-local
  `Asset.fromModule(id).localUri`, or APK-native local file URIs. No
  `asset.uri`, `downloadAsync`, `useAssets`, broad directories or runtime URLs.
  Embedding GGUF/SQLite/map extensions and native resource extraction still
  require T40/T42 build evidence; an unavailable `localUri` stays missing.
- `expo-sqlite`: `openDatabaseAsync`, `execAsync`, `getAllAsync`, `closeAsync`.
  The inspected SDK 57 API has no OS-level `readOnly` open option. The adapter
  checks the file exists, opens a separate connection with
  `useNewConnection: true`, sets `PRAGMA query_only = ON`, and exposes only
  the fixed pack read queries. It does not expose writes, user migrations or
  libSQL options. Native query-only enforcement remains a device gate.
- A pinned/tested incremental SHA-256 implementation, bound as
  `createSha256().update(bytes)/digestHex()`. File handles are read in at most
  64 KiB chunks and closed on failure. Expo `Asset.hash` is MD5 and is not used
  as SHA-256. Hash throughput/native file API compatibility remain unmeasured.

Official interface references inspected: [Expo SQLite SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/),
[Expo Asset SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/asset/),
[Expo FileSystem reference](https://docs.expo.dev/versions/latest/sdk/filesystem/).
These references do not select dependency versions or prove a compatible native
build. T40 alone owns installation, pins, app configuration and actual module
typechecking. T01/T40 can add the explicit T41 commands below to CI/workspace
scripts without changing the ports.

The style audit checks resource-bearing fields (sources, tiles, glyphs,
sprite arrays and GeoJSON URLs), rejects imports and nonlocal resources, and
allows HTTP attribution links as display text. T42 must bind those local paths
to installed files and validate actual renderer/tiles/font/sprite support.
`allAssetsReady` means file/schema readiness only, not successful inference or
map rendering and not release acceptance.

Asset reasons are local detail codes. At the app/core boundary map missing files
to `asset_missing`, unsupported pack schema to `schema_incompatible`, invalid
pack/manifests to `pack_invalid`; model inference and location failures remain
their owners' existing `inference_failed`/`location_unavailable` contracts.
Recovery is retry from bundled files or app replacement, with separate
missing/checksum/schema/I/O/licence/allowlist/map-resource messages. No network
action is a recovery option.

## Exact validation

Environment: Windows x64, Node `v26.11.1`, npm `11.12.1`. Commands run in this
independent checkout, from its repository root. There is no lint script declared
in the root; none is fabricated. Root commands cover the four registered
core/conversation/AI/evaluation workspaces; the app is not registered there.
The explicit T41 typecheck covers assets, adapter and T41 tests.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Exit 0; all four registered workspaces pass |
| `npm test` | Exit 0; 36 files, 577 tests: core 427, conversation 52, AI 88, evaluation 10 |
| `node node_modules/typescript/bin/tsc -p tools/eval/t41-assets/tsconfig.json` | Exit 0 |
| `node node_modules/vitest/vitest.mjs run --config tools/eval/t41-assets/vitest.config.mts` | Exit 0; 2 files, 81 tests |
| `node tools/eval/allowlist-check.mjs` | Exit 0; 15/15 self-tests; 88 content files and 19 asset-input files inspected |
| `node --test tools/eval/allowlist-check.test.mjs` | Exit 0; 16/16 tests, including binary/raw-path rejection and a Windows junction |
| `git diff --check` | Exit 0 |

The T41 tests use the checked-in pack builder, an actual SQLite file, measured
file bytes/hashes and a Node `readOnly` SQLite adapter. They test fresh installs,
cached copies, same-size bundle corruption, copy damage/repair, missing files,
unsupported companion/DB schemas, foreign keys, missing provenance, manifest
mismatch, read/cleanup errors, placeholder pins, duplicates, local paths, card
retention, map-resource rejection and unknown footprint values. Expo adapter
tests use structural doubles, not a phone or installed native modules.

The existing conversation harness rewrites its timing report during `npm test`.
Only that test-generated timestamp/host/timing change was restored; no change
to another task's evaluation report is included.

Reproducible fixture build/acceptance, also executed:

```powershell
node tools/pack-builder/build.mjs --eligible tools/pack-builder/fixtures/eligible --dispositions tools/pack-builder/fixtures/dispositions.json --run tools/pack-builder/fixtures/run.json --raw tools/pack-builder/fixtures/raw-dataset.json --out data/raw/t41/fixture
node tools/pack-builder/acceptance.mjs --pack data/raw/t41/fixture/pack.sqlite --raw tools/pack-builder/fixtures/raw-dataset.json
```

Both exit 0. Builder acceptance: **21/21** (integrity 2, invalid records 12,
ambiguity 4, source content 3). This is synthetic fixture acceptance, not T16
production corpus approval. Generated files stay in the ignored directory;
none are bundled or committed as final assets.

Measured fixture: `pack_fixture-001`, schema 1, `pack.sqlite` **233,472 bytes**,
SHA-256 `7773146f5f644a40031202e178f5504f2327f02023033b897a394ee72de0668d`.
The original builder companion is **1,047 bytes**, SHA-256
`4dfe579ade6dc4028b353f0041a64cc65d41dcdbb4eeeb53c3d8f625e5cdcaee`.
Its input snapshot hash is
`887101d0b5c44b42046f388f3508d3a2364c2f19e359ce2fd9f721c31dcc54ef`;
4 fixture posts, 3 answered, 2 included, 1 pending, 0 filtered/rejected. Pending
inputs remain pending. These are fixture/source-post facts, not route-count or
physical-verification claims. SQLite-version differences may change fixture
file hashes; tests independently measure their own produced files.

## Open gates

- T15/T16: production eligible pack, its final sidecar/pins, licence basis and
  full-source wording scan/reviewer sign-off. Main contains builder/fixtures;
  no production seed or auto-approved review records are supplied by this PR.
- T30/T31: selected sub-1B GGUF, actual licence/revision/hash/bytes, native loading
  and inference. No model binary is present or selected by this implementation.
- T42: final NCR tiles/style/glyph/sprite/attribution files, exact pins and cold
  offline rendering. The local PMTiles URI syntax audit is not an S2 pass.
- T40/T45: install/bind native modules, embed approved files without broad asset
  globs, replace demo screen wiring, and add the T41 checks to CI/app scripts.
- T00/T47: named reference/fallback phones; native development/release APK;
  airplane-mode cold restart, native corrupt-file recovery, actual APK contents,
  20-query lifecycle soak and concurrent map/GPS/AI memory/performance.
  `Get-Command adb -ErrorAction SilentlyContinue` found no executable on PATH.
  App-local `expo-file-system` and `expo-sqlite` are absent. No phone/build/
  performance evidence is claimed.
- Installed APK, unpacked app, copied/user storage, duplication and peak PSS are
  unmeasured. `recordFootprint` accepts measurements, validates byte counts and
  leaves missing components/total/duplication unknown; it never zero-fills an
  unmeasured component. The fixture size is not an installed-app measurement.
- Another member's review is required. Proposed reviewers: Franz for core/pack
  compatibility and Vincent for native asset binding; Justin for final pack
  handoff, CJ for the eventual model file path. No approval or merge is claimed.
