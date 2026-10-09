import type { Card, HourStatement } from '@pusang-gala/core';
import { buildGroundingContext, DEFAULT_BUDGETS } from '@pusang-gala/ai';
import type { CanonicalStatement, GroundingContext } from '@pusang-gala/ai';
import type { FollowUpTopic } from '@pusang-gala/conversation';

/** The same canonical strings feed the factual UI and guarded model inserts. */
export function cardFacts(card: Card): string[] {
  const result: string[] = [];
  if (card.kind === 'ride') {
    result.push(`Ride ${card.mode}: ${card.board.name} → ${card.alight.name}.`,
      `Direction: ${card.directionLabel}.`);
    if (card.signboard) result.push(`Signboard: ${card.signboard}.`);
    result.push(...(card.fares.length ? card.fares.map(fare => `Reported fare: PHP ${fare.min}${fare.max === fare.min ? '' : '–' + fare.max}.`)
      : ['Fare unknown: no report for this ride.']));
    result.push(card.rideMinutes.known ? `Reported ride time: ${card.rideMinutes.value} minutes.` : 'Ride time unknown.');
    result.push(...card.hours.map(hours => `Reported hours: ${hours.text}.`));
  } else {
    result.push(card.kind === 'walk' ? `Walk: ${card.from.name} → ${card.to.name}.`
      : card.direction === 'start' ? `Access: ${card.place.name} → ${card.stop.name}.` : `Access: ${card.stop.name} → ${card.place.name}.`);
    if (card.walkText) result.push(card.walkText);
    result.push(card.walkMinutes.known ? `Reported walk time: ${card.walkMinutes.value} minutes.` : 'Walk time unknown.');
  }
  result.push(...card.warnings.map(warning => warning.message));
  if (card.kind !== 'access') result.push(...card.notes.map(note => note.body));
  return result;
}

export function routeGroundingContext(cards: readonly Card[], hours: readonly HourStatement[] = [], topic?: FollowUpTopic): GroundingContext | null {
  const statements: CanonicalStatement[] = [];
  const repeated = new Map<string, CanonicalStatement>();
  cards.forEach((card, index) => cardFacts(card).forEach((text, fact) => {
    if (topic === 'ask_hours') return;
    if (topic === 'ask_fare' && (card.kind !== 'ride' || !/^Reported fare:|^Fare unknown:|^Fare reports differ|^Source post/.test(text))) return;
    const existing = fact === 0 ? undefined : repeated.get(text);
    if (existing) { existing.packRecordIds = [...new Set([...existing.packRecordIds, ...card.recordIds])]; return; }
    const statement: CanonicalStatement = { id: `f${statements.length + 1}`, text,
      role: fact === 0 ? 'step' : 'note', ...(fact === 0 ? { stepOrder: index + 1 } : {}), packRecordIds: card.recordIds };
    statements.push(statement);
    if (fact !== 0) repeated.set(text, statement);
  }));
  statements.push(...hours.map((hour, index) => ({ id: `h${index + 1}`, text: hour.text, role: 'hours' as const,
    packRecordIds: [hour.routeId, ...hour.reports.map(report => report.hoursId)] })));
  // Keep long/conflicting evidence intact on cards; never truncate facts to fit a prompt.
  const result = buildGroundingContext({ cards: cards.map((card, index) => ({ cardId: `c${index + 1}`,
    title: cardFacts(card)[0]!, packRecordIds: card.recordIds })), statements }, { ...DEFAULT_BUDGETS, maxUnits: 4 });
  return result.ok ? result.context : null;
}
