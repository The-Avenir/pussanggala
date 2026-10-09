# Corpus pipeline finalize + cleaned seed (Approach 1)

**Date:** 2026-10-10  
**Branch:** `feat/t14-t16-seed-handoff`

## Goal

Freeze a pre-cleaned reference of `howtogetthereph_dataset/`, re-run T10–T16, and promote eligible (cleaned) pack tables into `data/seed/` without raw Reddit wording.

## Layout

| Path | Git | Role |
|------|-----|------|
| `howtogetthereph_dataset/` | tracked | Working build input (unchanged content) |
| `data/reference/howtogetthereph_dataset-precleaned/` | README + checksums tracked; large files gitignored (recreate via script) | Frozen pre-clean snapshot |
| `data/raw/` | ignored | Pipeline intermediates |
| `data/seed/` | tracked | Eligible tables, dispositions, run metadata, pack companion checksums |

## Honesty

- Agents never set `accepted`; `needs_review` stays quarantined.
- No field-verified badge. Source dates ≠ verification dates.
- Regenerated T11 may differ in volume from historical 19,709-candidate reports; reports refreshed to match this extractor.
