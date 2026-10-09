# Pre-cleaned dataset reference (frozen)

This directory is a **byte copy** of `howtogetthereph_dataset/` taken before / beside
eligible-pack cleaning (Approach 1). It is the reference snapshot for audits.

- Frozen at: `2026-10-09T19:09:34.744Z`
- Working input path (unchanged): `howtogetthereph_dataset/`
- Cleaned pack inputs live in `data/seed/` (no raw Reddit wording).
- Large JSON/CSV/DIGEST files here are **gitignored**; recreate with:

```sh
node tools/corpus/freeze-reference.mjs
```

Checksums below use LF-normalized bytes for text files where applicable
(`ncr_routes.json` contract sha256 `d3939475ebd250755fcdac776f703001480aeaa4b72d04b025fba54434c4fdf3`).

See `SHA256SUMS.txt` for per-file digests.
