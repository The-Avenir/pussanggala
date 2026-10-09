/** Shared test fixtures for T34 lifecycle/capability tests. */

import { AiRuntimeManager, type Clock, type LifecycleOptions } from "../lifecycle";
import type { DeviceSnapshot, ModelRequirements } from "../capability";
import { FakeModelRuntime } from "./fake-runtime";

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

export const EMPTY_CONTEXT = { cardsJson: "[]", notesJson: "[]", tripStateJson: "{}" };

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
