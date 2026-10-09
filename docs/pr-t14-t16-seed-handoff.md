# INV-4 follow-up: `fix-seed-inv4` ? `main`

The original seed/integration handoff merged in PR #25. This follow-up fixes the 405 raw-content findings and removes the temporary canonical-permalink exception.

**Title:** `fix(corpus): keep raw source URLs out of shipped seed`

**Body:**

The promoted seed copied 405 Reddit source URLs into shipped data. Reddit `source.url` is now null, while IDs, dates, snapshot hashes and comment indices retain offline provenance. Raw permalinks remain in build inputs. No other eligible tables or dispositions change.

Builder and post-build acceptance reject raw URLs, imports, source wording and usernames. Promotion runs the existing INV-4 policy on staged files before publication and retains the previous seed on failure. The full pipeline also runs the same shipped-tree check as CI. Canonical Reddit URLs receive no exception.

The regenerated companion, checksum and HANDOFF identify pack SHA-256 `3859023cfd63573c1a25f63b567897a7b96a16f98a67b3dce9b6abf34c362e2d` (811,008 bytes, Node v24.5.0 / SQLite 3.50.3 writer). The raw dataset and frozen reference remain unchanged. Rebuilding from seed inputs reproduces all four builder outputs byte for byte on that runtime.

Validation commands and results: [T16 acceptance](../tools/corpus/reports/t16-acceptance.md) and [INV-4 fix evidence](../tools/corpus/helper-seed-inv4.md).

Actual AI evidence review, designated human decisions, source-backed T26 evaluation and final reviewer sign-off remain pending.
