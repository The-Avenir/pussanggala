import type { RouteIds } from '../store/tripStore';

// Walkthrough §3 visual fixtures, NOT eligible pack records or travel guidance.
// Stable synthetic IDs let the existing ID-only store exercise the UI safely.
export interface PreviewStep {
  id: string; title: string; subtitle: string; instruction: string;
  mode: 'walk' | 'ride'; stop: string; signboard?: string;
}
export interface PreviewRoute {
  id: string; title: string; fare: string; time: string; transfers: number;
  badges: readonly string[]; steps: readonly PreviewStep[]; ids: RouteIds;
}
export type Preference = 'cheapest' | 'fastest' | 'fewest-transfers';

const carouselWalk: PreviewStep = {
  id: 'SYNTHETIC-monumento-walk', title: 'Walk to the Carousel boarding point',
  subtitle: 'Walk time pending', mode: 'walk', stop: 'Monumento',
  instruction: 'Head from LRT-1 Monumento to the Carousel boarding point.',
};
const carouselRide: PreviewStep = {
  id: 'SYNTHETIC-carousel-north', title: 'Ride EDSA Carousel southbound',
  subtitle: 'Monumento → North Avenue', mode: 'ride', stop: 'North Avenue', signboard: 'PITX',
  instruction: 'Board at Monumento. Get off at North Avenue to transfer to MRT-3.',
};
const mrtWalk: PreviewStep = {
  id: 'SYNTHETIC-north-transfer', title: 'Walk to MRT-3 North Avenue',
  subtitle: 'About 5–10 min · example estimate', mode: 'walk', stop: 'MRT-3 North Avenue',
  instruction: 'Walk from the Carousel stop to MRT-3 North Avenue station.',
};
const mrtRide: PreviewStep = {
  id: 'SYNTHETIC-mrt-ayala', title: 'Ride MRT-3 southbound to Ayala',
  subtitle: 'North Avenue → Ayala · 10 stations', mode: 'ride', stop: 'One Ayala', signboard: 'TAFT AVENUE',
  instruction: 'Get off at Ayala station. One Ayala connects to the station.',
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
    badges: ['Lowest example fare', 'Example travel time'], steps: [carouselWalk, carouselRide, mrtWalk, mrtRide] }),
  route({ id: 'SYNTHETIC-carousel-direct', title: 'Carousel direct', fare: '≈₱59', time: '50–80 min', transfers: 0,
    badges: ['Fewest transfers'], steps: [carouselWalk, {
      id: 'SYNTHETIC-carousel-ayala', title: 'Ride EDSA Carousel to One Ayala', subtitle: 'Monumento → One Ayala',
      mode: 'ride', stop: 'One Ayala', signboard: 'PITX', instruction: 'Take the southbound Carousel from Monumento. Get off at the One Ayala stop.',
    }] }),
  route({ id: 'SYNTHETIC-lrt-mrt', title: 'LRT-1 + MRT-3', fare: '₱43–53', time: '55–75 min', transfers: 1, badges: [],
    steps: [{ id: 'SYNTHETIC-lrt-edsa', title: 'Ride LRT-1 southbound', subtitle: 'Monumento → EDSA', mode: 'ride', stop: 'EDSA',
      instruction: 'Board LRT-1 at Monumento and get off at EDSA station.' },
    { id: 'SYNTHETIC-taft-transfer', title: 'Walk the EDSA–Taft link', subtitle: 'About 10–15 min · example estimate',
      mode: 'walk', stop: 'MRT-3 Taft Avenue', instruction: 'Follow the walking link to MRT-3 Taft Avenue station.' },
    { id: 'SYNTHETIC-mrt-northbound', title: 'Ride MRT-3 northbound', subtitle: 'Taft Avenue → Ayala · 2 stations',
      mode: 'ride', stop: 'One Ayala', signboard: 'NORTH AVENUE', instruction: 'Get off at Ayala station for One Ayala.' }] }),
];

export const EXAMPLE_ROUTE = PREVIEW_ROUTES[0]!;
export function rankedPreviewRoutes(preference: Preference): readonly PreviewRoute[] {
  return preference === 'fewest-transfers'
    ? [PREVIEW_ROUTES[1]!, PREVIEW_ROUTES[0]!, PREVIEW_ROUTES[2]!]
    : PREVIEW_ROUTES;
}
