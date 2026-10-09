import type { RouteIds } from '../store/tripStore';

// Walkthrough §3 visual fixtures, NOT eligible pack records or travel guidance.
// Stable synthetic IDs let the existing ID-only store exercise the UI safely.
export interface PreviewStep {
  id: string; title: string; subtitle: string; instruction: string;
  mode: 'walk' | 'ride'; stop: string; signboard?: string;
  tips?: readonly string[];                                            // paraphrased community notes, never quoted
  fareReports?: readonly { amount: string; date: string }[];           // dated reports; conflicts keep both values
  oldReport?: boolean;                                                 // report is over 180 days old
  hours?: string;                                                      // reported first/last trip line for a ride step
  source?: { label: string; postedAt: string };                        // "Reported in <label> · posted <date>"
  unmapped?: boolean;                                                  // point has no reported coordinates
}
export interface PreviewRoute {
  id: string; title: string; fare: string; time: string; transfers: number;
  badges: readonly string[]; steps: readonly PreviewStep[]; ids: RouteIds;
  fareUnknown?: boolean; timeUnknown?: boolean;                        // listed below the §6 dividers
  sourceLine?: string;                                                 // e.g. "Community reports · posted Jun–Aug 2026"
}
export type Preference = 'cheapest' | 'fastest' | 'fewest-transfers';

const carouselWalk: PreviewStep = {
  id: 'SYNTHETIC-monumento-walk', title: 'Walk to the Carousel boarding point',
  subtitle: 'Distance and time not reported', mode: 'walk', stop: 'Monumento',
  instruction: 'From LRT-1 Monumento, follow the reported walk to the Carousel stop.',
  tips: ['Riders say the Carousel queue at Monumento is long at rush hour; allow extra time.'],
  source: { label: 'r/HowToGetTherePH', postedAt: '14 Aug 2026' },
};
const carouselRide: PreviewStep = {
  id: 'SYNTHETIC-carousel-north', title: 'Ride EDSA Carousel southbound',
  subtitle: 'Monumento → North Avenue', mode: 'ride', stop: 'North Avenue', signboard: 'PITX',
  instruction: 'Board at Monumento. Get off at North Avenue to transfer to MRT-3.',
  tips: ['Riders say southbound Carousel buses bunch up in traffic; reported waits vary widely.'],
  hours: 'Reported first/last trip: 4:00 AM–10:00 PM (posted Jun 2026)',
  source: { label: 'r/HowToGetTherePH', postedAt: 'Jun 2026' },
};
const mrtWalk: PreviewStep = {
  id: 'SYNTHETIC-north-transfer', title: 'Walk to MRT-3 North Avenue',
  subtitle: 'About 5–10 min · distance not reported', mode: 'walk', stop: 'MRT-3 North Avenue',
  instruction: 'Take the reported walking link from the Carousel stop to MRT-3 North Avenue station.',
  tips: ['Riders say the North Avenue link is a covered walkway; follow the MRT-3 signs past the mall entrance.'],
  source: { label: 'r/HowToGetTherePH', postedAt: 'Aug 2026' },
};
const mrtRide: PreviewStep = {
  id: 'SYNTHETIC-mrt-ayala', title: 'Ride MRT-3 southbound to Ayala',
  subtitle: 'North Avenue → Ayala · 10 stations', mode: 'ride', stop: 'One Ayala', signboard: 'TAFT AVENUE',
  instruction: 'Get off at Ayala station. One Ayala connects to the station.',
  fareReports: [{ amount: '₱12', date: 'Jul 2026' }, { amount: '₱24', date: 'Feb 2026' }],
  hours: 'Reported first/last trip: 4:30 AM–10:30 PM (posted May 2026)',
  source: { label: 'r/HowToGetTherePH', postedAt: 'Jul 2026' },
};
const carouselDirectRide: PreviewStep = {
  id: 'SYNTHETIC-carousel-ayala', title: 'Ride EDSA Carousel to One Ayala', subtitle: 'Monumento → One Ayala',
  mode: 'ride', stop: 'One Ayala', signboard: 'PITX',
  instruction: 'Take the southbound Carousel from Monumento. Get off at the One Ayala stop.',
  oldReport: true, hours: 'Hours not reported',
  source: { label: 'r/HowToGetTherePH', postedAt: 'Feb 2026' },
};

function route(input: Omit<PreviewRoute, 'ids'>): PreviewRoute {
  return { ...input, ids: {
    leg_ids: input.steps.map(step => step.id),
    stop_ids: input.steps.map(step => `${step.id}-stop`),
    place_ids: ['SYNTHETIC-monumento', 'SYNTHETIC-one-ayala'], note_ids: [],
  } };
}

export const PREVIEW_ROUTES: readonly PreviewRoute[] = [
  route({ id: 'SYNTHETIC-carousel-mrt', title: 'Carousel + MRT-3', fare: '₱31–44', time: '45–65 min', transfers: 1,
    badges: ['Lowest reported fare', 'Shortest reported time'], sourceLine: 'Community reports · posted May–Aug 2026',
    steps: [carouselWalk, carouselRide, mrtWalk, mrtRide] }),
  route({ id: 'SYNTHETIC-carousel-direct', title: 'Carousel direct', fare: '≈₱59', time: '50–80 min', transfers: 0,
    badges: ['Fewest transfers'], sourceLine: 'Community reports · posted Feb–Aug 2026', steps: [carouselWalk, carouselDirectRide] }),
  route({ id: 'SYNTHETIC-lrt-mrt', title: 'LRT-1 + MRT-3', fare: '₱43–53', time: '55–75 min', transfers: 1, badges: [],
    sourceLine: 'Community reports · posted May–Jun 2026',
    steps: [{ id: 'SYNTHETIC-lrt-edsa', title: 'Ride LRT-1 southbound', subtitle: 'Monumento → EDSA', mode: 'ride', stop: 'EDSA',
      instruction: 'Board LRT-1 at Monumento and get off at EDSA station.',
      fareReports: [{ amount: '₱36–40', date: 'Jun 2026' }],
      hours: 'Reported first/last trip: 4:30 AM–10:15 PM (posted Jun 2026)',
      source: { label: 'r/HowToGetTherePH', postedAt: 'Jun 2026' } },
    { id: 'SYNTHETIC-taft-transfer', title: 'Walk the EDSA–Taft link', subtitle: 'About 10–15 min · distance not reported',
      mode: 'walk', stop: 'MRT-3 Taft Avenue', oldReport: true,
      instruction: 'Follow the reported walking link to MRT-3 Taft Avenue station.',
      source: { label: 'r/HowToGetTherePH', postedAt: 'Jan 2026' } },
    { id: 'SYNTHETIC-mrt-northbound', title: 'Ride MRT-3 northbound', subtitle: 'Taft Avenue → Ayala · 2 stations',
      mode: 'ride', stop: 'One Ayala', signboard: 'NORTH AVENUE', instruction: 'Get off at Ayala station for One Ayala.',
      hours: 'Reported first/last trip: 4:30 AM–10:30 PM (posted May 2026)',
      source: { label: 'r/HowToGetTherePH', postedAt: 'May 2026' } }] }),
  route({ id: 'SYNTHETIC-uv-direct', title: 'UV Express direct', fare: 'Fare not reported', time: 'Time not reported',
    transfers: 0, fareUnknown: true, timeUnknown: true, badges: ['Fewest transfers'],
    sourceLine: 'Community reports · posted Mar 2026',
    steps: [{ id: 'SYNTHETIC-uv-terminal-walk', title: 'Walk to the Monumento UV terminal',
      subtitle: 'Distance and time not reported', mode: 'walk', stop: 'Monumento UV terminal', unmapped: true,
      instruction: 'Follow the reported walk from LRT-1 Monumento to the UV Express terminal. This point has no reported coordinates yet.',
      source: { label: 'r/HowToGetTherePH', postedAt: 'Mar 2026' } },
    { id: 'SYNTHETIC-uv-ayala', title: 'Ride a UV Express van southbound', subtitle: 'Monumento → Ayala',
      mode: 'ride', stop: 'One Ayala', signboard: 'AYALA',
      instruction: 'Take a southbound UV Express van. Get off at Ayala; One Ayala is the reported drop-off area.',
      hours: 'Hours not reported', source: { label: 'r/HowToGetTherePH', postedAt: 'Mar 2026' } }] }),
];

export const EXAMPLE_ROUTE = PREVIEW_ROUTES[0]!;
// Honest static order for the fixtures: reported values rank ahead of unknowns, and
// transfer ties fall back to the lowest reported fare (walkthrough §6 ranking rules).
export function rankedPreviewRoutes(preference: Preference): readonly PreviewRoute[] {
  if (preference === 'fastest')
    return [PREVIEW_ROUTES[0]!, PREVIEW_ROUTES[1]!, PREVIEW_ROUTES[2]!, PREVIEW_ROUTES[3]!];
  if (preference === 'fewest-transfers')
    return [PREVIEW_ROUTES[1]!, PREVIEW_ROUTES[3]!, PREVIEW_ROUTES[0]!, PREVIEW_ROUTES[2]!];
  return [PREVIEW_ROUTES[0]!, PREVIEW_ROUTES[2]!, PREVIEW_ROUTES[1]!, PREVIEW_ROUTES[3]!];
}
