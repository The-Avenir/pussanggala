# Pusang Gala

An offline-first NCR commuting assistant: an Android app that answers route questions
using a reviewed, source-backed knowledge pack, deterministic routing, a local on-device
model and offline maps — no runtime networking.

See [docs/index.md](docs/index.md) for the documentation map and
[docs/TODO.md](docs/TODO.md) for the four-member task plan.

## Repository layout

| Path | Purpose | Owner |
|------|---------|-------|
| `packages/core/` | Pure TypeScript contracts, normalization, routing and retrieval — no RN/native/network imports | Member 2 |
| `tools/corpus/` | Dataset audit, extraction, second evidence pass, ambiguity queue | Member 1 |
| `tools/pack-builder/` | SQLite pack, manifest and yield report | Member 1 |
| `tools/map-pack/` | Offline NCR basemap/tiles packaging | Member 4 |
| `tools/eval/` | Route/place/retrieval and conversation evaluation fixtures (T26, T35, T45) | Shared |
| `apps/mobile/` | Expo app — native adapters, assets, map, GPS, persistence, screens | Member 4 |
| `apps/mobile/src/ai/` | Native model runtime and validated streaming | Member 3 |
| `apps/mobile/src/conversation/` | Conversation state, intent and follow-ups | Member 3 |
| `data/seed/` | Reviewed facts/paraphrases only — never raw Reddit wording or usernames (INV-4) | Member 1 |

The supplied `howtogetthereph_dataset/` is raw build input for the corpus pipeline and
must **never** be packaged into the app or copied into runtime/training assets.

## Commands

Run from the repository root (prerequisite: Node.js >= 20):

| Command | What it does |
|---------|--------------|
| `npm install` | Install workspace dependencies and update `package-lock.json` |
| `npm run typecheck` | Type-check all workspaces (`tsc`, no emit) |
| `npm test` | Run workspace tests (vitest in `packages/core`) |

The Expo app scaffold, lint and device/build commands are added by later tasks
(T40, T01); the layout above already reserves their locations.
