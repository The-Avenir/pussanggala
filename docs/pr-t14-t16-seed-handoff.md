# PR template: `feat/t14-t16-seed-handoff` → `main`

Copy the **Title** and **Body** below into GitHub when opening the pull request.

---

## Title

```
feat(corpus): T10–T16 pipeline, pre-clean reference freeze, and data/seed handoff (Approach 1)
```

---

## Body

```markdown
## Summary

Member 1 corpus milestone: **Approach 1** — freeze a pre-cleaned reference snapshot of `howtogetthereph_dataset/`, re-run **T10–T16** on branch `feat/t14-t16-seed-handoff`, and promote **eligible (cleaned) pack tables** into tracked `data/seed/` for Members 2–4 (no raw Reddit wording in seed artifacts).

### Approach 1 (layout)

| Path | Git | Role |
|------|-----|------|
| `howtogetthereph_dataset/` | tracked | Working build input (unchanged content) |
| `data/reference/howtogetthereph_dataset-precleaned/` | README + `SHA256SUMS.txt` tracked; large blobs gitignored | **Reference freeze** — recreate via `node tools/corpus/freeze-reference.mjs` |
| `data/raw/` | ignored | Pipeline intermediates + rebuilt `pack.sqlite` |
| `data/seed/` | tracked | Eligible JSON tables, dispositions, run metadata, `pack.sha256`, `HANDOFF.json` |

Design contract: [`docs/superpowers/specs/2026-10-10-corpus-seed-handoff-design.md`](docs/superpowers/specs/2026-10-10-corpus-seed-handoff-design.md).

### Pipeline / tooling

- **`node tools/corpus/run-pipeline.mjs`** — orchestrates T10→T16 and seed promotion.
- **Conservative T11** (`extract.mjs`) — ~6.6k candidates vs historical ~19.7k; reports refreshed to match this extractor.
- **`promote-seed.mjs`**, **`freeze-reference.mjs`**, corpus test updates.

### `data/seed` handoff

- Paraphrase-only eligible tables under `data/seed/eligible/` (INV-4).
- `dispositions.json`, `run.json`, `pack.sha256`, machine-readable **`HANDOFF.json`**.
- Rebuild pack locally (gitignored): see `data/seed/README.md` and `HANDOFF.json` notes.

### Reference freeze

- Snapshot SHA256: `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3` (`ncr_routes.json`).
- Checksums: `data/reference/howtogetthereph_dataset-precleaned/SHA256SUMS.txt`.

### Acceptance

- **T16: 21/21 PASS** (integrity, invalid-record fixtures, ambiguity, source-content / INV-4).
- Full report: [`tools/corpus/reports/t16-acceptance.md`](tools/corpus/reports/t16-acceptance.md) (rebuild `data/raw/out/pack.sqlite` before reproducing checksums in that doc if needed).
- Consolidated narrative: [`tools/corpus/reports/corpus-pipeline-report.md`](tools/corpus/reports/corpus-pipeline-report.md).

### Honesty / known gaps (please read)

- **Human `needs_review` queue remains open** — agents never set `accepted`; quarantined candidates are **not** in the seed pack (current run: **244** items / **144** posts in [`tools/corpus/reports/t12-evidence.md`](tools/corpus/reports/t12-evidence.md)).
- **T12 part B** (`tools/corpus/ai-verdicts.json`) is **not re-applied** on this branch — candidate IDs are stale vs the new extractor; only deterministic **part A** counts in committed reports. Re-sample before treating part B as current.
- **No field-verified badge**; post dates ≠ verification dates; all places **unmapped** (no geometry in pack).
- Historical sections in `corpus-pipeline-report.md` retain the first-pass narrative; **live counts** are in `t10-audit.*`, `t12-evidence.*`, `t13-places.*`, `t14-eligible.md`.

## Test plan

- [ ] `node tools/corpus/run-pipeline.mjs` (or stepwise: `eligible.mjs` → `tools/pack-builder/build.mjs` with `data/seed/*` inputs → `acceptance.mjs`) — expect **21/21** acceptance.
- [ ] `npm test` at repo root (workspaces include updated `tools/corpus` tests).
- [ ] Spot-check `data/seed/eligible/` — no raw Reddit handles / 6-word copies (INV-4).
- [ ] Confirm `needs_review` rows do not appear in eligible emission ([`tools/corpus/reports/t14-eligible.md`](tools/corpus/reports/t14-eligible.md)).
- [ ] Optional: run `node tools/corpus/freeze-reference.mjs` and verify checksums against `data/reference/.../SHA256SUMS.txt`.

## Docs / tracking

- [`docs/TODO.md`](docs/TODO.md) — T10, T12, T16 status updated on this branch.
- [`data/seed/README.md`](data/seed/README.md) — seed guardrails and rebuild commands.
```

---

## `gh pr create` (optional)

From repo root, on `feat/t14-t16-seed-handoff` after push:

```powershell
gh pr create --base main --head feat/t14-t16-seed-handoff --title "feat(corpus): T10–T16 pipeline, pre-clean reference freeze, and data/seed handoff (Approach 1)" --body-file docs/pr-t14-t16-seed-handoff-body.md
```

If using `--body-file`, extract only the markdown inside the Body fence above into `docs/pr-t14-t16-seed-handoff-body.md`, or paste the Body section manually in the GitHub UI.

Compare link (if PR not created):  
`https://github.com/<owner>/<repo>/compare/main...feat/t14-t16-seed-handoff`
