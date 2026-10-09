# T13 places engine — counts

Snapshot `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`. 6420 place-name mentions across 2418 distinct normalized aliases. Counts only; no source text.

## Resolution

| bucket | count |
| --- | ---: |
| canonical places | 91 |
| aliases resolved | 271 (191 observed) |
| ambiguous aliases | 23 (50 place refs) |
| unresolved alias_norms | 2209 (3596 mentions) |
| coverage (resolved mentions / total) | 38.29% |

## Places by ncr_status

| ncr_status | places |
| --- | ---: |
| accepted | 89 |
| outside | 0 |
| ambiguous | 2 |

## Places by mapping_status

| mapping_status | places |
| --- | ---: |
| mapped | 0 |
| unmapped | 91 |
| needs_review | 0 |

## Mapping evidence

This repository contains no geodata, gazetteer feed or licensed coordinate source. Coordinates are therefore unmapped by default and no place carries a coordinate claim; any `lat`/`lng` present comes verbatim from the curated gazetteer together with its `mapping_source`. Mapping is deferred to a licensed/geography source.

## Limitations

- Unresolved aliases cannot serve as endpoints in T14; they are listed in data/raw/t13/unresolved.json (not committed) for gazetteer curation.

## Notes

- This repository contains no geodata or licensed coordinate source; lat/lng pass through the gazetteer verbatim and no coordinate is invented.
- Unresolved aliases are not pack-eligible endpoints; T14 cannot route to or from them.
- The dataset's own NCR label or bounding box is never used for ncr_status; membership is the curated city field only.
