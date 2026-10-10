import type { Card, HourStatement } from '@pusang-gala/core';
import { buildGroundingContext, DEFAULT_BUDGETS } from '@pusang-gala/ai';
import type { CanonicalStatement, GroundingContext, TripContextPort } from '@pusang-gala/ai';
import type { FollowUpTopic } from '@pusang-gala/conversation';
import { durationText, fareText, hoursText, isTaglish, isVisibleStep, stepText } from './routePresentation';
import { isDurationQuestion } from './conversationQuery';

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

export function routeGroundingContext(cards: readonly Card[], hours: readonly HourStatement[] = [], topic?: FollowUpTopic, question?: string,
  tripContext?: TripContextPort): GroundingContext | null {
  const statements: CanonicalStatement[] = [];
  const repeated = new Map<string, CanonicalStatement>();
  const taglish = isTaglish(question ?? '');
  function add(text: string, card: Card, role: CanonicalStatement['role'], stepOrder?: number) {
    const existing = role === 'step' ? undefined : repeated.get(text);
    if (existing) { existing.packRecordIds = [...new Set([...existing.packRecordIds, ...card.recordIds])]; return; }
    const statement: CanonicalStatement = { id: `f${statements.length + 1}`, text, role,
      ...(stepOrder ? { stepOrder } : {}), packRecordIds: card.recordIds };
    statements.push(statement);
    if (role !== 'step') repeated.set(text, statement);
  }
  cards.filter(isVisibleStep).forEach((card, index) => {
    if (topic === 'ask_hours') return;
    if (topic === 'ask_fare') { if (card.kind === 'ride') add(fareText(card, taglish), card, card.fares.length ? 'note' : 'unknown'); return; }
    if (isDurationQuestion(question ?? '')) { add(durationText(card, taglish), card, 'note'); return; }
    if (topic === 'ask_boarding' && card.kind !== 'ride') return;
    const alightingOnly = topic === 'ask_transfer' && /bababa|\bbaba\b|get off|alight/i.test(question ?? '');
    if (alightingOnly && card.kind !== 'ride') return;
    add(stepText(card, taglish, topic === 'ask_boarding', alightingOnly), card, 'step', index + 1);
    if (topic === 'ask_boarding' || alightingOnly) return;
    if (card.kind === 'ride' && card.fares.length) add(fareText(card, taglish), card, 'note');
    if ((card.kind === 'ride' ? card.rideMinutes : card.walkMinutes).known) add(durationText(card, taglish), card, 'note');
    // Keep provenance and long notes on core cards, outside the conversational surface.
    const conflict = card.warnings.find(warning => warning.code === 'fare_conflict' || warning.code === 'hours_conflict');
    if (conflict) add(taglish ? 'Magkakaiba ang ilang detalye, kaya kumpirmahin muna bago bumiyahe.' : 'Some details differ, so check before you travel.', card, 'warning');
  });
  statements.push(...hours.map((hour, index) => ({ id: `h${index + 1}`, text: hoursText(hour, taglish), role: 'hours' as const,
    packRecordIds: [hour.routeId, ...hour.reports.map(report => report.hoursId)] })));
  // Keep long/conflicting evidence intact on cards; never truncate facts to fit a prompt.
  const result = buildGroundingContext({ cards: cards.map((card, index) => ({ cardId: `c${index + 1}`,
    title: stepText(card, taglish), packRecordIds: card.recordIds })), statements,
    ...((question || tripContext) ? { trip: { ...tripContext, ...(question ? { question } : {}) } } : {}) },
  { ...DEFAULT_BUDGETS, maxUnits: 4, connectiveTextOnly: true });
  return result.ok ? result.context : null;
}
