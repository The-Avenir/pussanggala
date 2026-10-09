import type { Card, SourceRef } from '@pusang-gala/core';
import type { TurnResult } from '@pusang-gala/conversation';

type Ride = Extract<Card, { kind: 'ride' }>;
function vehicle(card: Ride): string {
  if (card.mode === 'rail') return /\b(?:LRT-[12]|MRT-3|PNR)\b/i.exec(card.directionLabel + ' ' + card.board.name)?.[0] ?? 'tren';
  return card.mode === 'jeepney' ? 'jeep' : card.mode;
}
function date(sources: readonly SourceRef[]): string {
  const dates = [...new Set(sources.map(source => source.postedAt?.slice(0, 10) ?? 'hindi nakasaad'))];
  return ` (report: ${dates.join(', ')})`;
}
function rideText(card: Ride): string {
  return `Sakay ka ng ${vehicle(card)} sa ${card.board.name}, tapos baba sa ${card.alight.name}.` +
    (card.signboard ? ` Hanapin ang signboard na “${card.signboard}”.` : '');
}
function directions(cards: readonly Card[]): string {
  return cards.flatMap(card => {
    if (card.kind === 'ride') return [rideText(card)];
    if (card.kind === 'walk') return [`Lakad mula ${card.from.name} papuntang ${card.to.name}. ${card.walkText}`];
    // A station linked to its own boarding point isn't an extra walking instruction.
    if (card.place.name.toLowerCase() === card.stop.name.toLowerCase()) return [];
    return [card.direction === 'start' ? `Pumunta muna sa ${card.stop.name} mula sa ${card.place.name}. ${card.walkText}`
      : `Pagbaba sa ${card.stop.name}, pumunta sa ${card.place.name}. ${card.walkText}`];
  }).join('\n\n');
}

/** Conversational phrasing of retrieved facts; no model load or invented connections. */
export function routeReply(result: TurnResult, query: string): string {
  if (result.type === 'clarification') return `Alin sa mga ito ang ${result.clarification.slot === 'origin' ? 'panggagalingan' : 'pupuntahan'} mo? Pili ka sa ibaba para tama ang ruta natin.`;
  if (result.type !== 'plan' && result.type !== 'followUp') return result.message;
  const cards = result.type === 'plan' ? result.evidence.cards : result.cards;
  const rides = cards.filter((card): card is Ride => card.kind === 'ride');
  if (result.type === 'followUp') {
    if (result.topic === 'ask_fare') return rides.map(card => {
      const lead = `Para sa ${vehicle(card)} mula ${card.board.name} hanggang ${card.alight.name}, `;
      if (!card.fares.length) return lead + 'wala akong naiulat na pamasahe. Ayokong hulaan ang halaga.';
      const amounts = card.fares.map(fare => `₱${fare.min}${fare.max === fare.min ? '' : '–' + fare.max}` + date(fare.sources));
      const conflict = card.warnings.some(warning => warning.code === 'fare_conflict');
      return lead + (conflict ? 'magkakaiba ang naiulat: ' : 'ang naiulat na pamasahe ay ') + amounts.join('; ') +
        (conflict ? '. Hindi ko makukumpirma kung alin ang kasalukuyang singil.' : '. Maaaring nagbago na ang singil.');
    }).join('\n\n') || 'Walang sakay sa rutang ito, kaya wala akong pamasahe na maiuulat.';
    if (result.topic === 'ask_hours') return result.hourStatements.map(hour => {
      const card = rides.find(ride => ride.routeId === hour.routeId);
      const label = card ? `${vehicle(card)} (${card.board.name} → ${card.alight.name})` : 'rutang ito';
      if (hour.status === 'unknown') return `Wala akong naiulat na operating hours para sa ${label}, kaya hindi ko makukumpirma ang last trip.`;
      return `Para sa ${label}, ${hour.conflict ? 'magkakaiba ang reports: ' : 'ito ang naiulat: '}` +
        hour.reports.map(report => report.text + date(report.sources)).join('; ') + '. Report ito, hindi live na timetable.';
    }).join('\n\n') || 'Wala akong naiulat na operating hours para sa rutang ito.';
    if (result.topic === 'ask_boarding') return rides.map(card => `Sa ${card.board.name} ka sasakay ng ${vehicle(card)}.` +
      (card.signboard ? ` Hanapin ang “${card.signboard}”.` : '')).join('\n\n') || 'Walang sakay sa rutang ito.';
    if (result.topic === 'ask_transfer') {
      if (/bababa|\bbaba\b|get off|alight/i.test(query)) return rides.map((card, index) =>
        `Baba ka sa ${card.alight.name}${index < rides.length - 1 ? `, tapos sasakay ka ng ${vehicle(rides[index + 1]!)} sa ${rides[index + 1]!.board.name}` : ''}.`).join('\n\n') || 'Walang sakay sa rutang ito.';
      if (rides.length === 1) return `Isang sakay lang ang nasa rutang ito—walang lipat. ${rideText(rides[0]!)}`;
      return directions(cards);
    }
  }
  return `Ganito ang ruta natin:\n\n${directions(cards)}\n\n` +
    (cards.some(card => card.sources.some(source => source.stale)) ? 'May lumang report sa rutang ito. ' : '') +
    'Ito ang nasa route reports; hindi ko makukumpirma ang live service. Gusto mo bang malaman ang pamasahe o oras ng biyahe?';
}
