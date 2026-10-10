# Curated NCR rail additions — 2026-10-10

This report describes the initial rail batch. The latest pack also includes
[seven jeepney additions and conversational AI replies](../../docs/evidence/jeepney-conversation.md).

Seven explicit directions from the existing snapshot now reach the retrieval and
routing pack. The automatic extractor missed arrow notation or could not resolve
an abbreviated station name. The supplements name only the boarding station,
alighting station and rail mode; destination labels are derived from those facts.
Reverse trips and transfers are not inferred.

| Line | Boarding station | Alighting station | Source post | Comment index |
|---|---|---|---|---:|
| MRT-3 | North Avenue | Guadalupe | `1wy1iq1` | 0 |
| MRT-3 | North Avenue | Araneta-Cubao | `1waijgm` | 0 |
| MRT-3 | North Avenue | Taft Avenue | `1wvlc7t` | 0 |
| MRT-3 | North Avenue | Shaw Boulevard | `1vkfw4y` | 0 |
| MRT-3 | Ortigas | Araneta-Cubao | `1ush76c` | 3 |
| MRT-3 | Quezon Avenue | Ayala | `1w386ph` | 4 |
| LRT-2 | Araneta Center-Cubao | Katipunan | `1vo3a4u` | 3 |

Each listed comment explicitly supplies a directed rail segment. The station
aliases identify the rail stations rather than nearby malls or unqualified
district names. The comment containing alternatives supplies only the selected
rail segment; its other suggestions are not inferred as connections.
Station membership is also consistent with the
[DOTr MRT-3 station map](https://www.dotrmrt3.gov.ph/station-map.pdf) and
[LRTA railway operations description](https://www.lrta.gov.ph/railway-operations/),
consulted on 2026-10-10. Those pages are corroborating references; shipped
provenance remains the original snapshot's post dates and comment locators.

`curated-routes.json` pins snapshot
`d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`
and each cited comment's SHA-256 after CRLF-to-LF normalization. No raw comment
wording or permalinks are copied into the supplements or shipped seed.
All seven enter T11 as `extracted`, pass T12's deterministic evidence checks
without quarantine overrides, and pass T14 place resolution and builder checks.
Existing pending candidates remain quarantined. Agents set no human `accepted`
decision, and independent AI review and designated reviewer sign-off remain
separate outstanding project gates.

Fares, schedules, ride times, distances, coordinates and additional walking
connections remain unknown. These are source-backed directions, not field
verification or a claim about live service availability.

The rebuild also corrects CRLF snapshot hashing in audit, evidence and eligible
run metadata to follow the builder's existing LF-normalized contract. Audit
inventory fields still record exact input bytes and their hashes.

## Result and validation

- Promoted seed: `data/seed/`; local SQLite: `data/raw/out/pack.sqlite`.
- Pack: 141 legs, 75 routes, 59 stops, 91 places, 21 walk links, 276 notes,
  1,761 provenance links; fares and hours remain empty.
- Change: seven additional directed rail legs and six additional route records.
- Answered-post dispositions: 409 included, 91 pending, 494 rejected, 1,192
  filtered; total 2,186. Post dispositions describe pack yield, not human review.
- Pack SHA-256: `6bc09b18979eef0d97709f7650466038aa22544a663ef673a6d00f4bf3fae657`;
  843,776 bytes. Writer: Node `v26.0.0`, SQLite `3.51.3`.
- Complete pipeline succeeded; pack acceptance passed 24/24 checks and the
  shipped-content scan found no leaks.
- Corpus and builder suites passed 164/164 tests.
- Core seed smoke passed 8/8 tests, including all seven direct rail journeys
  with unknown fares; core TypeScript validation passed.

Reproduce with `node tools/corpus/run-pipeline.mjs`, then
`node --test "tools/corpus/*.test.mjs" "tools/pack-builder/*.test.mjs"` and
`npm run test --workspace @pusang-gala/core -- test/seed-eligible-smoke.test.ts`.
The app's packaged assets must be rebuilt to include this updated local pack.
