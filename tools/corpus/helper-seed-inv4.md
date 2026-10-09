# INV-4 seed shipping fix

The failure was reproduced on `feat/t14-t16-seed-handoff` at `6f5862c`:
405 `reddit-url` findings in `data/seed/eligible/source.json`. Current `main`
did not yet contain that promoted seed, so a check there missed the failure.

T14 copied post permalinks into eligible sources, pack acceptance exempted those
URLs from the source-copy scan, and promotion copied them into the shipped tree.
Reddit `source.url` is now null. The raw dataset and frozen reference remain
build/audit inputs. IDs, dates, snapshot hashes and comment indices retain
offline provenance, with no changes to other eligible tables or dispositions.

The builder and post-build acceptance reject raw source URLs, dataset imports,
source text copies and usernames. The existing Member 4 policy is reused without
exceptions. Promotion scans staged seed files before publication and preserves
the previous seed on failure. The pipeline runs the full shipped-tree check;
The latest main CI runs the full corpus/pack-builder suite, including these
seed-boundary regressions. Its temporary canonical-permalink exemption is
removed; canonical thread links are rejected by shipping-policy tests too.

Validated on Windows:

- Full pipeline: Node v24.5.0 / SQLite 3.50.3; acceptance 24/24; INV-4 zero findings.
- Latest main corpus/pack CI command on Node v22.23.3: 160/160, no failures or skips.
- Latest main workspace tests on Windows: 641/641; workspace typecheck passed.
- Node v22.23.3 builder-compatible asset-loader suite: 81/81.
- Integrated shipped-tree scan: 183 files / zero findings; explicit inventory 57 inputs.
- Shipping-policy fixtures: 21/21, including rejection of canonical source URLs.
- All four pack-builder outputs reproduce byte for byte from promoted seed inputs
  using the same Node v24.5.0 / SQLite 3.50.3 writer.
- 405 URLs removed; all 406 source rows retain their remaining metadata.
- Original raw input and frozen reference: no tracked changes.

Canonical pack SHA-256:
`3859023cfd63573c1a25f63b567897a7b96a16f98a67b3dce9b6abf34c362e2d`
(811,008 bytes). Companion, checksum and HANDOFF describe this rebuilt pack.
This supersedes the previous `9203234a…` identity.

Actual AI evidence review, designated human decisions, source-backed T26
evaluation and final reviewer sign-off remain open.
