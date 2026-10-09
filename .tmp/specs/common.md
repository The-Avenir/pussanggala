# Common rules for every Pusang Gala core worker

Repository: GitHub `The-Avenir/pussanggala`; main checkout `D:\The Avenir\pusanggala`. You work in your own Orca worktree (your cwd).

Project context: offline NCR commuting app. `packages/core` is a pure TypeScript package (no React Native, Expo, Node builtins, network calls in `src/` — `packages/core/test/boundary.test.ts` enforces this). It owns contracts, place resolution, routing, cards and RAG evidence. Authoritative design: `docs/contracts-pusang-gala.md` (read it fully before coding), plus `docs/sdd-pusang-gala.md` §1.3 and §3, `docs/prd-pusang-gala.md` §3.1 (F2, F3, F4, F19, F20, F21) and `docs/TODO.md` §4 Member 2 tasks. Do not change the contracts doc except where your spec says so; if the spec conflicts with the contracts doc or cannot be expressed, ask the coordinator (orchestration `ask`) instead of silently deviating.

Existing code (already merged on your base branch): `src/ids.ts`, `src/result.ts` (Result/ok/err, Known/known/unknown), `src/schema/pack.ts` (zod row schemas, `RawPackTables`), `src/schema/user.ts` (StepRef, ItineraryRef, parseRouteJson), `src/contracts/*.ts` (intent, routing, cards, explanation, api types), `src/text/normalize.ts`, `src/pack/types.ts` (`Pack` indexed maps, `recordKey`), `src/pack/load.ts` (`loadPack`), `test/fixtures/minimal-pack.ts` (`minimalRawPack()`).

Rules:
1. First: `npm install` at the worktree root. Create your task branch exactly as named in your spec from the base named in your spec (`git checkout -b <branch> <base>` if Orca did not already put you on it). Never work on or push to `main`. **Do not push** and do not open PRs — the coordinator reviews, pushes and opens PRs.
2. Code style: compact idiomatic TS, strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), camelCase API objects, snake_case only for pack/user row fields. No new dependencies. Do not add comments explaining changes. Deterministic output everywhere (sort ties by ID).
3. Unknown fares/times/hours are never coerced to 0. Never create connections from coordinates/names/proximity. Suspended/retired routes and `excluded` rows never route.
4. Test fixtures are obviously synthetic (no real fares/routes asserted as fact).
5. Export new public modules from `packages/core/src/index.ts`.
6. Verify from the worktree root: `npm run typecheck` and `npm test` must both pass.
7. Commit on your task branch with Conventional Commit messages (`feat(core): ...`), one commit per task ID in your spec, message body explains why, and end each message with:
   ```
   Generated with [Devin](https://devin.ai)

   Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
   ```
8. In `worker_done`, report: branch name(s), commit SHA(s), test count, and every decision you made beyond the spec.
