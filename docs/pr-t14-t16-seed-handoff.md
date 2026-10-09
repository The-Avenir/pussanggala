# PR template: `feat/t14-t16-seed-handoff` → `main`

Copy the **Title** and **Body** below into GitHub when opening the pull request.

**Compare URL:** https://github.com/The-Avenir/pussanggala/compare/main...feat/t14-t16-seed-handoff?expand=1

---

## Title

```
feat(corpus): T10–T16 grounded pipeline, seed handoff, helper integrity fixes
```

---

## Body

```markdown
## Summary

Member 1 corpus milestone (Approach 1): freeze a pre-cleaned reference of
`howtogetthereph_dataset/`, run **T10–T16** with grounded `extract.mjs`, and promote
eligible tables into tracked `data/seed/` (INV-4). Helper integrity fixes for freeze,
promotion, pack-builder, and extractor grounding are integrated.

### Layout

| Path | Role |
|------|------|
| `howtogetthereph_dataset/` | Working raw input |
| `data/reference/howtogetthereph_dataset-precleaned/` | Pre-clean reference (README+checksums tracked) |
| `data/raw/` | Intermediates + `pack.sqlite` (gitignored) |
| `data/seed/` | Cleaned eligible handoff |

One-shot: `node tools/corpus/run-pipeline.mjs`

### Final pack (this branch)

- **T16 acceptance: 22/22 PASS**
- `pack_sha256` `737f2aebcc9a725d0500aba223987ac19d9136561e49ffc5ab92c5ea61911d41`
- T11: **5,713** candidates; T12 A: 5,583 `second_passed` / 130 `needs_review` / 0 accepted
- T12 B: **heuristic-part-B** (deterministic; not AI judgment) — sample 313, flagged 21 → quarantine only
- Eligible: 134 legs / 69 routes / 59 stops / 91 places / 21 walks / 276 notes; dispositions 405/75/502/1204

### Honesty

- Agents never set `accepted`; human `needs_review` queue remains open.
- No field-verified badge; places unmapped (no geodata).
- Heuristic-part-B is explicitly labeled and is not a substitute for human/AI review gates.

## Test plan

- [x] `run-pipeline` / acceptance **22/22**
- [x] `node --test tools/corpus/*.test.mjs` + `tools/pack-builder/**/*.test.mjs`
- [x] `npm test -w @pusang-gala/core` (includes seed smoke)
- [ ] Spot-check INV-4 in `data/seed/eligible/`
- [ ] Open PR (gh auth required) from compare URL above
```
