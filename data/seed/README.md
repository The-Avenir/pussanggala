# data/seed - cleaned eligible pack inputs

Promoted by tools/corpus/promote-seed.mjs after a deterministic builder validation.

eligible/*.json contains only pack tables; dispositions.json and run.json describe
the same build. pack.manifest.json is the builder companion. pack.sha256 is the
checksum of data/raw/out/pack.sqlite (the pack itself is not shipped here).

No raw source URLs, Reddit wording, usernames or dataset imports.
Source IDs, post IDs, dates, snapshot hashes and comment indices retain offline provenance.
Raw permalinks remain in the build-input snapshot outside shipped assets.
Unknowns remain unknown; conflicts are preserved.
Human needs_review items are not auto-accepted. Source dates are post dates.
Ignored raw reference bytes are audit inputs only, outside shipped assets.

Rebuild: node tools/corpus/run-pipeline.mjs
Promote after a successful build: node tools/corpus/promote-seed.mjs
