# tools/eval — evaluation fixtures + T01 shipped-content gate

**Owner:** shared (all members contribute; see task reviewers).

**Tasks:** T01 (repo checks/asset guard, lead Member 4), T26 (route/place/
retrieval evaluation, lead Member 2, reviewer Member 1), T35 (conversation/
grounding evaluation, lead Member 3), T45 (functional end-to-end integration,
all members validate).

Guardrails (BUILD §5): meaningful source/route/grounding/asset/lifecycle
fixtures; no test claimed passed before running; evaluation records are
source-backed; fine-tune examples use placeholders only, never real route
facts or raw comments (INV-7).

## allowlist-check.mjs — shipped-content gate (INV-4)

Scans the shippable trees `apps/mobile`, `tools/map-pack` and `data/seed`
for leaked raw Reddit content and exits non-zero on any hit:

| Rule | What fails |
|------|------------|
| `reddit-url` | Reddit permalink / subreddit URL (`reddit.com`, `/r/HowToGetTherePH`) |
| `reddit-username` | Reddit username mention (`u/<name>`, incl. `/u/<name>`) |
| `raw-phrase` | Verbatim sample of raw build-input comment text (blocklist) |
| `long-comment` | One line ≥280 chars with ≥2 commute-signal terms |
| `raw-import` | Raw-dataset import/read in code (`howtogetthereph_dataset` + import verb or concrete `csv/json/md` file) |
| `raw-schema` | Raw snapshot schema fields in code (`top_answer`, `answer_count`, `num_comments`, `created_utc`) |

The supplied `howtogetthereph_dataset/` snapshot at the repo root is
intentional off-device build input. It is never scanned, so its mere
existence never fails the gate — only copies of raw wording/usernames inside
the scanned trees fail. Lockfiles, `node_modules` and binary assets
(tiles, fonts, weights, archives) are skipped; `.md` docs may discuss the
pipeline but code/data files may not import it.

No secrets, no network: the script only reads local files.

```sh
node tools/eval/allowlist-check.mjs                 # scan + built-in self-tests (exit 0 clean, 1 leak, 2 broken detector)
node tools/eval/allowlist-check.mjs --self-test-only  # positive + negative fixtures only
node --test tools/eval/allowlist-check.test.mjs     # committed fixture suite (node:test, no deps)
```

Every run executes built-in self-tests first: positive fixtures (permalink,
username, verbatim comment, comment-like paragraph, raw import, raw schema,
planted temp-dir leak) must be rejected, and negative fixtures (clean
placeholder/guard idioms, dataset-exists note, clean temp-dir tree, scan-root
exclusion) must pass. A broken detector exits 2 without trusting the scan.

Manual planted-leak demo (do not commit the fixture):

```sh
printf 'thanks u/fixture_user -- There are jeepneys going to Sta. Maria Bulacan that traverses Mc. Arthur Highway\n' > data/seed/__tmp_leak__.txt
node tools/eval/allowlist-check.mjs --no-self-test   # expect FAIL, exit 1
rm data/seed/__tmp_leak__.txt
node tools/eval/allowlist-check.mjs                  # expect PASS, exit 0
```
