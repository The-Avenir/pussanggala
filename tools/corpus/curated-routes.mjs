// Source-backed supplements for directions the automatic extractor missed.
// These remain extracted candidates; T12 and the builder decide eligibility.
import { createHash } from "node:crypto";

export function addCuratedRoutes(result, posts, curated, sha) {
  if (curated.snapshot_sha256 !== sha) throw new Error("curated route snapshot mismatch");
  const postById = new Map(posts.map((p) => [p.id, p]));
  const candidates = [...result.candidates];
  const ids = new Set(candidates.map((c) => c.candidate_id));
  for (const ride of curated.rides) {
    const post = postById.get(ride.post_id);
    const text = Number.isInteger(ride.comment_index) && ride.comment_index >= 0
      ? post?.answers?.[ride.comment_index]?.text : null;
    if (typeof text !== "string") throw new Error("curated route locator invalid");
    const hash = createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
    if (hash !== ride.comment_sha256) throw new Error("curated route comment mismatch");
    if (!["rail", "jeepney"].includes(ride.mode) || !ride.board_place || !ride.alight_place) {
      throw new Error("curated rail or jeepney endpoints required");
    }
    const endpointHash = createHash("sha256").update(JSON.stringify([ride.mode, ride.board_place, ride.alight_place])).digest("hex");
    const candidate_id = `c_${ride.post_id}_${ride.comment_index}_${1000000 + parseInt(endpointHash.slice(0, 8), 16)}`;
    if (ids.has(candidate_id)) throw new Error("curated route ID collision");
    ids.add(candidate_id);
    candidates.push({
      candidate_id, snapshot_sha256: sha, post_id: ride.post_id,
      comment_index: ride.comment_index, record_kind: "ride",
      candidate_payload: {
        mode: ride.mode, signboard: null, board_place: ride.board_place,
        alight_place: ride.alight_place, direction_text: `To ${ride.alight_place}`, ride_min: null,
      },
      evidence_check: null, review_reason: null, review_state: "extracted",
      reviewer_id: null, reviewed_at: null,
    });
  }
  const affected = new Set(curated.rides.map((r) => r.post_id));
  const outcomes = result.outcomes.map((outcome) => {
    if (!affected.has(outcome.post_id)) return outcome;
    const rows = candidates.filter((c) => c.post_id === outcome.post_id);
    const routeFacts = rows.filter((c) => c.record_kind === "ride" || c.record_kind === "walk").length;
    return {
      ...outcome, candidate_count: rows.length,
      ...(routeFacts ? { outcome: "route_evidence", reason: `${routeFacts} ride/walk candidate(s) from answers` } : {}),
    };
  });
  return { candidates, outcomes };
}
