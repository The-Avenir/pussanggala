/**
 * Shared test fixtures. Synthetic canonical statements only — REPLACEME for
 * real pack-backed fixtures once T24 lands. No raw dataset text anywhere.
 */

import type { DeviceSnapshot, ModelRequirements } from "../capability";
import { buildGroundingContext, type AssemblyInput } from "../grounding-context";
import { AiRuntimeManager, type Clock, type LifecycleOptions } from "../lifecycle";
import type { GroundingContext } from "../ports";
import { FakeModelRuntime } from "./fake-runtime";

export const FIXTURE_BUNDLE: AssemblyInput = {
  trip: { originLabel: "Cubao", destinationLabel: "Makati", preference: "fewer transfers" },
  cards: [
    {
      cardId: "card:route-1",
      title: "MRT-3 ride then jeepney transfer",
      packRecordIds: ["leg:mrt3-1", "walk:w-1"],
    },
  ],
  statements: [
    {
      id: "stmt:step-1",
      role: "step",
      stepOrder: 1,
      text: "Board MRT-3 at Araneta Center-Cubao station southbound.",
      packRecordIds: ["leg:mrt3-1"],
    },
    {
      id: "stmt:step-2",
      role: "step",
      stepOrder: 2,
      text: "Alight at Ayala station.",
      packRecordIds: ["leg:mrt3-1"],
    },
    {
      id: "stmt:step-3",
      role: "step",
      stepOrder: 3,
      text: "Walk to the Ayala Ave jeepney stop near the terminal entrance (reported).",
      packRecordIds: ["walk:w-1"],
    },
    {
      id: "stmt:cmp-1",
      role: "comparison",
      text: "Lowest reported fare among the options that have fare reports; options without fare reports remain shown.",
      packRecordIds: ["leg:mrt3-1", "fare:f-1"],
    },
    {
      id: "stmt:hrs-1",
      role: "hours",
      text: "MRT-3 operating hours are reported from a source dated 2024-11; they may have changed.",
      packRecordIds: ["hours:h-1"],
    },
    {
      id: "stmt:warn-1",
      role: "warning",
      text: "Two conflicting fare reports exist for the jeepney leg and are shown separately with their source dates.",
      packRecordIds: ["fare:f-2", "fare:f-3"],
    },
    {
      id: "stmt:unk-1",
      role: "unknown",
      text: "No reported travel time exists for the jeepney leg; the time for that leg is unknown.",
      packRecordIds: ["leg:jee-1"],
    },
  ],
};

export function fixtureContext(overrides?: Partial<AssemblyInput>): GroundingContext {
  const result = buildGroundingContext({ ...FIXTURE_BUNDLE, ...overrides });
  if (!result.ok) {
    throw new Error(`fixture context failed to assemble: ${result.reason}`);
  }
  return result.context;
}

/** One NDJSON line in the core `ExplanationUnitSchema` shape. */
export function unitLine(fields: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: "summary",
    inserts: [],
    text: "Narito ang sagot, ka-commuter.",
    ...fields,
  });
}

/** Join unit lines into an NDJSON script with a trailing newline. */
export function ndjson(...lines: string[]): string {
  return lines.map((line) => `${line}\n`).join("");
}

/** A clean three-unit script used by several guard and lifecycle tests. */
export const CLEAN_SCRIPT = ndjson(
  unitLine({ kind: "step", inserts: ["stmt:step-1", "stmt:step-2"], text: "Una, sakay, tapos baba." }),
  unitLine({ kind: "step", inserts: ["stmt:step-3"], text: "Pagkatapos, lakad papunta sa terminal." }),
  unitLine({ kind: "caveat", inserts: ["stmt:warn-1"], text: "Pasensya na sa magkaibang fare reports." }),
);

/** Chunk a script so buffering/splitting across chunk boundaries is exercised. */
export function chunked(script: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < script.length; i += size) {
    chunks.push(script.slice(i, i + size));
  }
  return chunks;
}

export async function* tokensOf(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/** Runner that yields pushed chunks and parks — used for mid-stream cancellation. */
export class ControllableRunner {
  readonly chunks: string[] = [];
  private resolvers: (() => void)[] = [];

  push(chunk: string): void {
    this.chunks.push(chunk);
    const waiter = this.resolvers.shift();
    if (waiter) waiter();
  }

  async *stream(signal: { aborted: boolean }): AsyncIterable<string> {
    let i = 0;
    for (;;) {
      while (i < this.chunks.length) {
        if (signal.aborted) return;
        yield this.chunks[i]!;
        i += 1;
      }
      if (signal.aborted) return;
      await new Promise<void>((resolve) => this.resolvers.push(resolve));
      if (signal.aborted) return;
    }
  }
}

export const REQUIREMENTS: ModelRequirements = {
  supportedAbis: ["arm64-v8a"],
  minTotalMemoryMb: 1500,
  reservedForAppMb: 1024,
  full: { contextTokens: 2048, outputTokenCap: 512, threads: 4, runtimeMemoryMb: 900 },
  constrained: { contextTokens: 1024, outputTokenCap: 256, threads: 2, runtimeMemoryMb: 600 },
};

export const FULL_DEVICE: DeviceSnapshot = {
  abis: ["arm64-v8a"],
  totalMemoryMb: 4096,
  lowMemoryMode: false,
  modelAssetReady: true,
};

// Above the RAM floor but short of full budget + reserved (900 + 1024).
export const CONSTRAINED_DEVICE: DeviceSnapshot = {
  abis: ["arm64-v8a"],
  totalMemoryMb: 1800,
  lowMemoryMode: false,
  modelAssetReady: true,
};

export const UNSUPPORTED_ABI_DEVICE: DeviceSnapshot = {
  abis: ["armeabi-v7a"],
  totalMemoryMb: 4096,
  lowMemoryMode: false,
  modelAssetReady: true,
};

/**
 * REPLACE (T24 core.compose / T44 ACTIVE_TRIP): placeholder shapes proving
 * that no AI failure path mutates deterministic cards or the active trip.
 * The AI layer never receives references to these objects.
 */
export interface CardsFixture {
  readonly packId: string;
  readonly cards: ReadonlyArray<{ cardId: string; body: string }>;
}

export interface TripFixture {
  readonly tripId: string;
  readonly originPlaceId: string;
  readonly destinationPlaceId: string;
  readonly currentStep: number;
}

export function makeCardsFixture(): CardsFixture {
  return {
    packId: "pack-fixture-1",
    cards: [
      { cardId: "leg-1", body: "Ride jeepney A from Stop X to Stop Y (fare reported 13-15 PHP)" },
      { cardId: "walk-1", body: "Walk ~200 m to Stop Z" },
    ],
  };
}

export function makeTripFixture(): TripFixture {
  return {
    tripId: "trip-1",
    originPlaceId: "place-origin",
    destinationPlaceId: "place-destination",
    currentStep: 2,
  };
}

export interface ManagerHarness {
  runtime: FakeModelRuntime;
  manager: AiRuntimeManager;
}

export function makeManager(overrides: {
  snapshot?: DeviceSnapshot;
  clock?: Clock;
  maxLoadAttempts?: number;
  loadTimeoutMs?: number;
}): ManagerHarness {
  const runtime = new FakeModelRuntime();
  const options: LifecycleOptions = {
    probe: () => overrides.snapshot ?? FULL_DEVICE,
    requirements: REQUIREMENTS,
    model: { modelPath: "/data/user/0/app/model.gguf", sha256: "0".repeat(64) },
    backoff: { baseMs: 5, factor: 2, maxMs: 50 },
    ...(overrides.clock ? { clock: overrides.clock } : {}),
    ...(overrides.maxLoadAttempts ? { maxLoadAttempts: overrides.maxLoadAttempts } : {}),
    ...(overrides.loadTimeoutMs ? { loadTimeoutMs: overrides.loadTimeoutMs } : {}),
  };
  return { runtime, manager: new AiRuntimeManager(runtime, options) };
}
