import type { Pack } from '@pusang-gala/core';

// Metro selects the native SQLite implementation on Android.
export async function loadBundledPack(): Promise<Pack> {
  throw new Error('Bundled route retrieval requires the native app.');
}
