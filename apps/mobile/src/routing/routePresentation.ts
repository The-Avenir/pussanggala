import type { Card, HourStatement } from '@pusang-gala/core';

export type Ride = Extract<Card, { kind: 'ride' }>;
export const isTaglish = (query: string): boolean => /\b(?:paano|pa['’]?no|saan|magkano|ako|galing|pupunta(?:ng)?|pumunta(?:ng)?|pamasahe|salamat|oras|katagal|bababa|sasakay)\b/i.test(query);
export function vehicle(card: Ride): string {
  return card.mode === 'rail' ? /\b(?:LRT-[12]|MRT-3|PNR)\b/i.exec(card.directionLabel + ' ' + card.board.name)?.[0] ?? 'train'
    : card.mode === 'jeepney' ? 'jeepney' : card.mode.replace(/_/g, ' ');
}
export function isVisibleStep(card: Card): boolean {
  return card.kind !== 'access' || card.place.name.toLowerCase() !== card.stop.name.toLowerCase();
}
export function stepText(card: Card, taglish = false, boardingOnly = false, alightingOnly = false): string {
  if (card.kind === 'ride') {
    const ride = taglish ? `Sakay ka ng ${vehicle(card)} sa ${card.board.name}, tapos baba sa ${card.alight.name}.`
      : `Take the ${vehicle(card)} from ${card.board.name} and get off at ${card.alight.name}.`;
    return (boardingOnly ? taglish ? `Sa ${card.board.name} ka sasakay ng ${vehicle(card)}.` : `Board at ${card.board.name}.`
      : alightingOnly ? taglish ? `Baba ka sa ${card.alight.name}.` : `Get off at ${card.alight.name}.` : ride) +
      (!alightingOnly && card.signboard ? taglish ? ` Hanapin ang signboard na “${card.signboard}”.` : ` Look for the “${card.signboard}” signboard.` : '');
  }
  const from = card.kind === 'walk' ? card.from.name : card.direction === 'start' ? card.place.name : card.stop.name;
  const to = card.kind === 'walk' ? card.to.name : card.direction === 'start' ? card.stop.name : card.place.name;
  return taglish ? `Lakad mula ${from} papuntang ${to}.` : `Walk from ${from} to ${to}.`;
}

/** Missing values stay visual placeholders; they never enter the pack as estimates. */
export function fareLabel(card: Ride): string {
  if (!card.fares.length) return '₱— · pending';
  return card.fares.map(fare => `₱${fare.min}${fare.max === fare.min ? '' : '–' + fare.max}`).join(' / ') +
    (card.warnings.some(warning => warning.code === 'fare_conflict') ? ' · varies' : '');
}
export function timeLabel(card: Card): string {
  const minutes = card.kind === 'ride' ? card.rideMinutes : card.walkMinutes;
  return minutes.known ? `${minutes.value} min` : '— min · pending';
}
export function fareText(card: Ride, taglish = false): string {
  if (!card.fares.length) return taglish ? `Hindi pa available ang pamasahe para sa ${vehicle(card)} na ito.` : `The fare for this ${vehicle(card)} is still pending.`;
  return `${taglish ? 'Ang pamasahe ay' : 'The available fare is'} ${fareLabel(card)}.` +
    (card.warnings.some(warning => warning.code === 'fare_conflict') ? taglish ? ' Magkakaiba ang halaga, kaya kumpirmahin muna bago sumakay.' : 'The amounts differ, so check before boarding.' : '');
}
export function durationText(card: Card, taglish = false): string {
  const minutes = card.kind === 'ride' ? card.rideMinutes : card.walkMinutes;
  const action = card.kind === 'ride' ? taglish ? 'sakay' : 'ride' : taglish ? 'lakad' : 'walk';
  return minutes.known ? taglish ? `Mga ${minutes.value} minuto ang ${action}.` : `Allow about ${minutes.value} minutes for this ${action}.`
    : taglish ? `Hindi pa available ang tagal ng ${action} na ito.` : `The ${action} time is still pending.`;
}
export function hoursText(hour: HourStatement, taglish = false): string {
  if (hour.status === 'unknown') return taglish ? 'Hindi pa available ang operating hours, kaya hindi ko makukumpirma ang last trip.'
    : 'I don’t have the operating hours yet, so I can’t confirm the last trip.';
  return hour.reports.map(report => report.text).join('; ') +
    (hour.conflict ? taglish ? ' Magkakaiba ang oras, kaya kumpirmahin muna bago bumiyahe.' : 'The times differ, so check before you travel.' : '');
}
