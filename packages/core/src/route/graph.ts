import type { Pack } from "../pack/types";
import type { LegRow, PlaceStopRow, RouteRow, WalkLinkRow } from "../schema/pack";

export type Edge = { kind: "leg"; leg: LegRow; route: RouteRow } | { kind: "walk"; walk: WalkLinkRow };

export interface RouteGraph {
  outByStop: ReadonlyMap<string, readonly Edge[]>;
  originAccesses(placeId: string): readonly PlaceStopRow[];
  destinationAccesses(placeId: string): readonly PlaceStopRow[];
}

const graphs = new WeakMap<Pack, RouteGraph>();

export function getGraph(pack: Pack): RouteGraph {
  const cached = graphs.get(pack);
  if (cached) return cached;
  const outgoing = new Map<string, Edge[]>();
  const add = (stopId: string, edge: Edge) => {
    const list = outgoing.get(stopId) ?? [];
    list.push(edge);
    outgoing.set(stopId, list);
  };
  for (const leg of pack.legs.values()) {
    const route = pack.routes.get(leg.route_id);
    if (leg.eligibility === "ready" && route && (route.service_status === "reported_active" || route.service_status === "unknown")) {
      add(leg.board_stop_id, { kind: "leg", leg, route });
    }
  }
  for (const walk of pack.walks.values()) {
    if (walk.eligibility === "ready") add(walk.from_stop_id, { kind: "walk", walk });
  }
  const edgeId = (edge: Edge) => edge.kind === "leg" ? edge.leg.leg_id : edge.walk.walk_id;
  const outByStop = new Map<string, readonly Edge[]>();
  for (const stopId of [...outgoing.keys()].sort()) {
    const list = outgoing.get(stopId)!;
    list.sort((a, b) => edgeId(a) < edgeId(b) ? -1 : edgeId(a) > edgeId(b) ? 1 : 0);
    outByStop.set(stopId, Object.freeze(list));
  }
  const accesses = (placeId: string, direction: "to_stop" | "from_stop") =>
    (pack.placeStopsByPlace.get(placeId) ?? [])
      .filter((access) => access.eligibility === "ready" && (access.direction === direction || access.direction === "both"))
      .sort((a, b) => a.access_id < b.access_id ? -1 : a.access_id > b.access_id ? 1 : 0);
  const graph: RouteGraph = {
    outByStop,
    originAccesses: (placeId) => accesses(placeId, "to_stop"),
    destinationAccesses: (placeId) => accesses(placeId, "from_stop"),
  };
  graphs.set(pack, graph);
  return graph;
}
