# Seed extractor grounding helper

Completed in the isolated `seed-extractor-grounding` checkout, based on
`a3defd5`, for Cursor's `feat/t14-t16-seed-handoff` integration.
Owned files: `extract.mjs`, `extract.test.mjs`, and this report only.
Source/test commit: **`bb4a7996446364c3661ba77e02ebd2867461efd7`**.
This report is committed separately after the source/test commit.

## Findings and fixes

- Question punctuation formerly disappeared before extraction, so questions and
  chained speculative recommendations produced ride/walk candidates. Preserve
  question punctuation and sentence-wide uncertainty across chain separators;
  exclude interrogatives, explicit speculation, and negated boarding advice.
  Preference-conditional route advice remains supported.
- A walking instruction involving an LRT-named endpoint formerly produced a rail
  ride. Walking now stays walking, and an explicit vehicle mode overrides mode
  keywords within endpoint names. Multiple modes, multiple connections, and
  unsplit mixed boarding/walking instructions do not establish a unique ride.
- Fare/hour/status records formerly attached to the nearest preceding or following
  ride, including trip totals and reports naming another service. Scope now requires
  an unambiguous same-segment ride, an explicitly named unique service with matching
  stated endpoints, or contiguous fact-only follow-ups to a sole ride. Global,
  ambiguous, unrelated, and cross-comment associations remain `applies_to_ride: null`.
- Deduplication formerly discarded equal fare/hour/status values on different legs.
  Include the ride target in deduplication keys and retain the target when a connection
  is repeated in the same comment.
- Wait/appointment times, duration ranges, approximations, percentages, and partial
  decimal matches formerly could become exact ride/fare/walk quantities. These stay
  absent. Invalid meridiem values and ambiguous multi-clock service reports stay absent.
- Walking continuation uses only an explicit adjacent chain from the previous ride
  in the same comment. Question endpoints, another answer, or an unrelated preceding
  ride never supply missing evidence. Signboards, directions, numbers, endpoints,
  and specific status remain confined to their cited comment.

No candidate is marked `accepted`; review fields and the single-comment source
locator retain the existing contract. No raw source text was added to tests or this
report. Synthetic authored cases use invented places. The original checkout,
T12 source, generated seed, committed evidence reports, and reference artifacts
were not edited.

The root eval test rewrote its generated timing report as a test side effect;
that isolated, previously clean file was restored before handoff and is not in
either helper commit.

## Snapshot delta and ID compatibility

Measured by calling `extractAll(JSON.parse(readFileSync(snapshot)))` before and
after the changes and comparing complete candidate objects by `candidate_id`.
The snapshot checksum remains
`d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`.

| Kind | Baseline | Final | Delta |
| --- | ---: | ---: | ---: |
| place | 4090 | 4088 | -2 |
| ride | 1702 | 1052 | -650 |
| walk | 358 | 205 | -153 |
| fare | 91 | 60 | -31 |
| hours | 38 | 28 | -10 |
| service_status | 4 | 4 | 0 |
| note | 357 | 276 | -81 |
| total | 6640 | 5713 | -927 |

All **2186 answered posts** still have one outcome. Across **711 affected posts**,
5708 IDs remain, 932 disappear, and 5 appear. Of retained IDs, **5316 candidate
objects are identical**, while **392 change**; 220 of those change record kind.
Unchanged comments preserve their ordinal IDs; removing unsupported earlier facts
can reuse an ordinal for a different fact within an affected comment.

**Discard/resample previous T12 verdicts against the final extraction, even when
an ID still exists.** Count/ID changes were communicated immediately through Orca,
and the coordinator relayed them to Cursor. No final seed was regenerated here.

## Validation

Node: `v26.11.1` on Windows PowerShell.

| Exact command | Result |
| --- | --- |
| `node --test tools/corpus/extract.test.mjs` before edits | 13/13 passed |
| `node --test tools/corpus/extract.test.mjs` after final edits | 24/24 passed, including byte-identical full-snapshot shard runs into temporary directories |
| `node --test tools/corpus/evidence.test.mjs tools/corpus/eligible.test.mjs tools/pack-builder/build.test.mjs` in the child checkout | 30/35 passed: eligible 9/9; evidence 6/7; pack 15/19 |
| `node --test tools/corpus/extract.test.mjs tools/corpus/evidence.test.mjs tools/corpus/eligible.test.mjs tools/pack-builder/build.test.mjs` in the temporary LF-normalized validation copy | **59/59 passed**: extractor 24; evidence 7; eligible 9; pack 19 |
| `npm run typecheck` | Completed all four workspaces without errors |
| `npm test` | **578/578 passed**, 37 files: core 428; conversation 52; AI 88; eval conversation 10 |
| `git diff --check` | Passed |

The five checkout-only failures have concrete external causes:

1. The evidence suite compares committed reports to current extraction counts.
   Those Cursor-owned reports still describe 6640 candidates and must be rebuilt.
   Windows CRLF also differs from the freshly generated LF Markdown.
2. Four positive pack cases reject the synthetic fixture's CRLF bytes against its
   committed LF checksum. The negative pack checks pass. The coordinator reported
   that another helper's **`e703888`** fixes LF input hashing while retaining
   byte-exact pack hashing. That inherited commit was **not** cherry-picked here.

The passing downstream check used
`C:/Users/cjds0/AppData/Local/Temp/pusang-grounding-validation-sDZtnR`.
It copied `tools/corpus`, `tools/pack-builder`, and the raw snapshot into a temporary
root, normalized text copies to LF, called the copied extractor with
`run({out: <temporary-root>/data/raw/t11, writeProgress: false})`, and called the
copied evidence pass with both `out` and `reportDir` inside that temporary root.
The exact four-suite `node --test` command above then ran there, exit 0; its output
is retained in the temporary `validation.log`. No committed reports or fixtures in
the working checkout were rewritten. Local ignored T11 intermediates were created
solely for the first downstream test run, with progress writing disabled.

## Cursor integration and rebuild order

1. Cherry-pick `bb4a7996446364c3661ba77e02ebd2867461efd7`, followed by the separate
   report commit delivered in `worker_done`. Integrate the other helpers' focused
   fixes, including the coordinator's `e703888`, before final validation.
2. `node tools/corpus/extract.mjs` — final T11 extraction.
3. `node tools/corpus/evidence.mjs` — final T12 part A, rebuilding its reports.
4. Fresh T12 part B: use `node tools/corpus/ai-sample.mjs --summary` and its batch
   sampling flow on these final candidates, rebuild Cursor-owned verdicts, then
   `node tools/corpus/ai-apply.mjs`. Do not apply previous IDs' verdicts or
   manufacture human acceptance.
5. `node tools/corpus/places.mjs`, then `node tools/corpus/eligible.mjs`.
6. `node tools/pack-builder/build.mjs --eligible data/raw/t14/eligible --dispositions data/raw/t14/dispositions.json --run data/raw/t14/run.json --raw howtogetthereph_dataset/ncr_routes.json --out data/raw/out`.
7. `node tools/pack-builder/acceptance.mjs --pack data/raw/out/pack.sqlite --raw howtogetthereph_dataset/ncr_routes.json`.
8. Only after acceptance: `node tools/corpus/promote-seed.mjs`; rerun the affected
   suites, root typecheck/tests, and Cursor's seed/report consistency checks.

The child checkout's `run-pipeline.mjs` skips part B. Cursor owns reconciling that
runner; use the explicit order above until the runner implements the final T12 flow.
No new reference freeze or T10 audit is needed solely for this extractor change:
the frozen input is unchanged.

## Remaining limitations

Extraction remains a conservative grammar-based candidate generator. Complex
unsplit alternatives, partially stated legs, unusual wording, and ambiguous
numeric or service subjects may produce no ride or an unscoped value; the reduced
volume is not a completeness claim. Existing bare rail-endpoint mode inference is
retained for compatibility when no walk or conflicting explicit vehicle is stated.
This is text grounding, not physical route verification. Cursor must rebuild and
review the final candidate set, reports, eligible records, and seed after integrating
all helpers; full production-seed acceptance was intentionally left to Cursor.
