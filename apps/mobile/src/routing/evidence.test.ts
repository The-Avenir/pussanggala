/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse, newTrip, route } from '@pusang-gala/core';
import type { Pack } from '@pusang-gala/core';
import { readValidatedPack, parsePackCompanion } from '../assets/pack-loader';
import { createRouteConversation, createEvidencePort } from './evidence';
import { routeGroundingContext, cardFacts } from './facts';
import { buildExplainPrompt, guardStream } from '@pusang-gala/ai';
import { renderSafeExplanation, renderGroundedRouteUnit } from '../inference/explanationContext';
import catalog from './packCatalog.json';
import { routeReply } from './routeReply';
import { conversationContext } from '../inference/conversationContext';

const assetDir = new URL('../../assets/pack/', import.meta.url);
let pack: Pack;
beforeAll(async () => {
  const companion = parsePackCompanion(readFileSync(new URL('pack.manifest.json', assetDir), 'utf8'));
  if (!companion.ok) throw new Error(companion.error.detail);
  const result = await readValidatedPack(new URL('pack.sqlite', assetDir).href, companion.value, {
    async openReadOnly(uri) {
      const db = new DatabaseSync(fileURLToPath(uri), { readOnly: true });
      return { async all(sql) { return db.prepare(sql).all(); }, async close() { db.close(); } };
    },
  });
  if (!result.ok) throw new Error(result.error.detail);
  pack = result.value;
});

function supportedJourney() {
  for (const origin of pack.places.values()) for (const destination of pack.places.values()) {
    if (origin.place_id === destination.place_id || origin.ncr_status !== 'accepted' || destination.ncr_status !== 'accepted') continue;
    const found = route(origin.place_id, destination.place_id, 'balanced', pack);
    if (found.status === 'ok') return { origin, destination, found };
  }
  throw new Error('Bundled pack has no routable journey.');
}

describe('installed NCR retrieval integration', () => {
  it.each(['One Ayala', 'SM North EDSA', 'Intramuros'])
    ('a new destination request for %s replaces unresolved Cubao choices', async destination => {
      const manager = createRouteConversation(pack);
      const first = await manager.handleUserMessage('Paano pumunta sa Cubao?');
      expect(first.type).toBe('clarification');
      const query = `Paano pumunta sa ${destination}?`;
      const next = await manager.handleUserMessage(query);
      expect(next.type, JSON.stringify(next)).toBe('needsTrip');
      const trip = manager.getState().trip;
      expect(trip.pendingClarification).toBeUndefined();
      expect(pack.places.get(trip.destinationPlaceId!)?.name).toContain(destination);
      expect(routeReply(next, query, trip, pack)).toContain('Saan ka manggagaling?');
      expect(trip.originPlaceId).toBeUndefined();
    });
  it('changing destination retains a confirmed origin and routes to the new place', async () => {
    const destination = [...pack.places.values()].find(place => place.name === 'One Ayala transport hub')!;
    const startingPoint = [...pack.places.values()].find(place => place.place_id !== destination.place_id
      && route(place.place_id, destination.place_id, 'balanced', pack).status === 'ok')!;
    expect(startingPoint).toBeDefined();
    const manager = createRouteConversation(pack);
    expect((await manager.handleUserMessage(`From ${startingPoint.name} to Cubao`)).type).toBe('clarification');
    const origin = manager.getState().trip.originPlaceId;
    expect(origin).toBe(startingPoint.place_id);
    const next = await manager.handleUserMessage('Paano pumunta sa One Ayala?');
    expect(next.type).toBe('plan');
    expect(manager.getState().trip.originPlaceId).toBe(origin);
    expect(pack.places.get(manager.getState().trip.destinationPlaceId!)?.name).toContain('One Ayala');
    expect(manager.getState().trip.pendingClarification).toBeUndefined();
  });
  it('replacing an ambiguous origin retains the deferred destination choices', async () => {
    const manager = createRouteConversation(pack);
    expect((await manager.handleUserMessage('From Buendia to Cubao')).type).toBe('clarification');
    const next = await manager.handleUserMessage('From Recto');
    expect(next.type).toBe('clarification');
    if (next.type !== 'clarification') throw new Error(next.message);
    expect(next.clarification.slot).toBe('destination');
    expect(next.clarification.text).toBe('Cubao');
    expect(pack.places.get(manager.getState().trip.originPlaceId!)?.name).toContain('Recto');
    const index = next.clarification.candidates.findIndex(candidate => candidate.name === 'Cubao LRT-2 station');
    expect((await manager.handleClarificationPick(index)).type).toBe('plan');
  });
  it('changing destination during origin clarification discards the old deferred destination', async () => {
    const manager = createRouteConversation(pack);
    expect((await manager.handleUserMessage('From Buendia to Cubao')).type).toBe('clarification');
    const next = await manager.handleUserMessage('Paano pumunta sa One Ayala?');
    expect(next.type).toBe('clarification');
    if (next.type !== 'clarification') throw new Error(next.message);
    expect(next.clarification.slot).toBe('origin');
    await manager.handleClarificationPick(0);
    expect(manager.getState().trip.pendingClarification).toBeUndefined();
    expect(pack.places.get(manager.getState().trip.destinationPlaceId!)?.name).toContain('One Ayala');
  });
  it('grounds the prompt after an explicit Cubao button pick in the selected place and asks only for origin', async () => {
    const manager = createRouteConversation(pack);
    const question = 'pano pumuntang cubao';
    const first = await manager.handleUserMessage(question);
    if (first.type !== 'clarification') throw new Error(first.message);
    const index = first.clarification.candidates.findIndex(candidate => candidate.name === 'Cubao LRT-2 station');
    const candidate = first.clarification.candidates[index]!;
    const picked = await manager.handleClarificationPick(index);
    expect(picked.type).toBe('needsTrip');
    const context = conversationContext('ask_origin', candidate.name,
      [{ role: 'user', text: question }, { role: 'assistant', text: routeReply(first, question) }],
      { destinationLabel: pack.places.get(manager.getState().trip.destinationPlaceId!)!.name });
    const prompt = buildExplainPrompt(context).prompt;
    expect(prompt).toContain('TRIP destination="Cubao LRT-2 station"');
    expect(prompt).toContain('QUESTION text="Cubao LRT-2 station"');
    expect(prompt).toContain('USER text="pano pumuntang cubao"');
    expect(prompt).toContain('Ask only where they are coming from');
    expect(prompt).toContain('Do not ask for the destination again');
    expect(context.statements).toEqual([]);
    const plan = await manager.handleUserMessage('Recto');
    if (plan.type !== 'plan') throw new Error(plan.message);
    const routeContext = routeGroundingContext(plan.evidence.cards, plan.evidence.hourStatements, undefined, 'Recto',
      { originLabel: plan.endpoints.origin.name, destinationLabel: plan.endpoints.destination.name })!;
    expect(buildExplainPrompt(routeContext).prompt).toContain('origin="LRT-2 Recto station" destination="Cubao LRT-2 station"');
    expect(routeContext.statements.some(statement => statement.role === 'step' && /Recto.*Cubao/.test(statement.text))).toBe(true);
  });
  it('double-ambiguity regression: selecting Buendia retains the pending Cubao destination', async () => {
    const manager = createRouteConversation(pack);
    const first = await manager.handleUserMessage('From Buendia to Cubao lowest fare');
    expect(first.type).toBe('clarification');
    if (first.type !== 'clarification') throw new Error(first.message);
    expect(first.clarification.slot).toBe('origin');
    const second = await manager.handleClarificationPick(0);
    expect(second.type, JSON.stringify({ second, trip: manager.getState().trip })).toBe('clarification');
    if (second.type !== 'clarification') throw new Error(second.message);
    expect(second.clarification.slot).toBe('destination');
    expect(second.clarification.text).toBe('Cubao');
    expect(manager.getState().trip.originPlaceId).toBe(first.clarification.candidates[0]!.placeId);
    expect(manager.getState().trip.preference).toBe('lowest_fare');
    const index = second.clarification.candidates.findIndex(candidate => candidate.name === 'Cubao LRT-2 station');
    const completed = await manager.handleClarificationPick(index);
    expect(['plan', 'failure']).toContain(completed.type);
    expect(manager.getState().trip.destinationPlaceId).toBe(second.clarification.candidates[index]!.placeId);
    expect(manager.getState().trip.pendingClarification).toBeUndefined();
  });

  it('does not carry an abandoned second ambiguity into a new trip', async () => {
    const manager = createRouteConversation(pack);
    await manager.handleUserMessage('From Buendia to Cubao');
    manager.newTrip();
    const next = await manager.handleUserMessage('From Recto to Cubao');
    expect(next.type).toBe('clarification');
    if (next.type !== 'clarification') throw new Error(next.message);
    const index = next.clarification.candidates.findIndex(candidate => candidate.name === 'Cubao LRT-2 station');
    const plan = await manager.handleClarificationPick(index);
    expect(plan.type).toBe('plan');
    expect(manager.getState().trip.pendingClarification).toBeUndefined();
  });
  it('rejects a repeated ambiguous name, invalid number, and place outside the displayed choices', async () => {
    const manager = createRouteConversation(pack);
    const first = await manager.handleUserMessage('From Recto to Cubao');
    expect(first.type).toBe('clarification');
    if (first.type !== 'clarification') throw new Error(first.message);
    for (const query of ['Cubao', '9', 'SM North', 'yung Cubao po']) {
      const next = await manager.handleUserMessage(query);
      expect(next.type).toBe('clarification');
      expect(manager.getState().trip.pendingClarification?.candidates).toEqual(first.clarification.candidates);
      expect(manager.getState().trip.destinationPlaceId).toBeUndefined();
    }
  });
  it.each(['number', 'full name', 'unique prefix', 'alias', 'polite alias'] as const)
    ('Cubao selection regression: %s confirms the place, asks for origin, and routes from Recto', async pickStyle => {
      const manager = createRouteConversation(pack);
      const result = await manager.handleUserMessage('paano pumunta sa Cubao');
      expect(result.type).toBe('clarification');
      if (result.type !== 'clarification') throw new Error(result.message);
      const index = result.clarification.candidates.findIndex(candidate => candidate.name === 'Cubao LRT-2 station');
      const candidate = result.clarification.candidates[index]!;
      const picks = { number: String(index + 1), 'full name': candidate.name, 'unique prefix': 'Cubao LRT-2',
        alias: 'LRT2 Cubao', 'polite alias': 'yung LRT2 Cubao po' };
      const picked = await manager.handleUserMessage(picks[pickStyle]);
      expect(picked.type, JSON.stringify({ pickStyle, picked, state: manager.getState().trip })).toBe('needsTrip');
      expect(manager.getState().trip.destinationPlaceId).toBe(candidate.placeId);
      expect(manager.getState().trip.pendingClarification).toBeUndefined();
      const plan = await manager.handleUserMessage('Recto');
      expect(plan.type).toBe('plan');
      if (plan.type !== 'plan') throw new Error(plan.message);
      expect(plan.endpoints.destination.placeId).toBe(candidate.placeId);
      expect(routeReply(plan, 'pano pumuntang cubao')).toContain('Sakay ka ng LRT-2');
    });

  it.each(['pano pumuntang cubao', 'pano pumunta cubao', 'paano pumuntang cubao', 'paano pumunta sa cubao', 'Pano po pumuntang Cubao?'])
    ('Cubao phrase regression: %s reaches place selection instead of the default redirect', async query => {
      const manager = createRouteConversation(pack);
      const result = await manager.handleUserMessage(query);
      expect(result.message, JSON.stringify({ query, result, state: manager.getState().trip })).not.toContain('Gala lang tayo');
      expect(result.type).toBe('clarification');
      if (result.type !== 'clarification') throw new Error(result.message);
      expect(result.clarification.slot).toBe('destination');
      const choice = result.clarification.candidates.findIndex(candidate => candidate.name === 'Cubao LRT-2 station');
      expect(choice).toBeGreaterThanOrEqual(0);
      const picked = await manager.handleUserMessage(String(choice + 1));
      expect(picked.type).toBe('needsTrip');
      expect(manager.getState().trip.destinationPlaceId).toBe(result.clarification.candidates[choice]!.placeId);
      expect(manager.getState().trip.pendingClarification).toBeUndefined();
      expect(routeReply(picked, query, manager.getState().trip, pack)).toContain('Saan ka manggagaling?');
    });

  it('ships exactly the measured bytes and loads the complete eligible pack', () => {
    for (const spec of catalog) {
      const file = readFileSync(new URL('../../' + spec.bundlePath, import.meta.url));
      expect(file.length).toBe(spec.bytes);
      expect(createHash('sha256').update(file).digest('hex')).toBe(spec.sha256);
    }
    expect(pack.routes.size).toBe(80);
    expect(pack.places.size).toBe(91);
    expect(pack.legs.size).toBe(148);
    expect([...pack.sources.values()].every(source => !source.url?.includes('reddit'))).toBe(true);
  });

  it('answers a real journey and fresh follow-ups from pack records', async () => {
    const { origin, destination } = supportedJourney();
    const manager = createRouteConversation(pack);
    const answer = await manager.handleUserMessage(`From ${origin.name} to ${destination.name}`);
    expect(answer.type, JSON.stringify({ origin: origin.name, destination: destination.name, answer })).toBe('plan');
    if (answer.type !== 'plan') throw new Error(JSON.stringify(answer));
    expect(answer.evidence.packId).toBe(pack.manifest.pack_id);
    expect(answer.evidence.cards.some(card => card.kind === 'ride')).toBe(true);
    expect(answer.evidence.cards.every(card => card.recordIds.length && card.sources.length)).toBe(true);
    expect((await manager.handleUserMessage('How much is the fare?')).type).toBe('followUp');
    const hours = await manager.handleUserMessage('What time is the last trip?');
    expect(hours.type).toBe('followUp');
    if (hours.type === 'followUp') expect(hours.hourStatements.length).toBeGreaterThan(0);
    const reverse = await manager.handleUserMessage('Return trip');
    expect(['plan', 'failure']).toContain(reverse.type);
    if (reverse.type === 'plan') {
      expect(reverse.trip.originPlaceId).toBe(destination.place_id);
      expect(reverse.trip.destinationPlaceId).toBe(origin.place_id);
    }
  });

  it('grounds Qwen in exact canonical facts and leaves unknown fares explicit', async () => {
    const { origin, destination } = supportedJourney();
    const result = await createEvidencePort(pack).plan({ ...newTrip(pack), originPlaceId: origin.place_id, destinationPlaceId: destination.place_id });
    if (result.kind !== 'planned') throw new Error(result.reason);
    const context = routeGroundingContext(result.evidence.cards);
    expect(context, JSON.stringify(result.evidence.cards.map(card => cardFacts(card)))).not.toBeNull();
    expect(context!.statements.some(statement => statement.role === 'step' && /Take the/.test(statement.text))).toBe(true);
    expect(context!.statements.every(statement => !/sources?:|reports?|stale|sourceId/i.test(statement.text))).toBe(true);
    expect(context!.statements.every(statement => !/^Ride |^Access:|^Direction:/.test(statement.text))).toBe(true);
    expect(context!.statements.every(statement => statement.packRecordIds.every(id => result.evidence.allowedRecordIds.includes(id)))).toBe(true);
    const unpriced = result.evidence.cards.find(card => card.kind === 'ride' && !card.fares.length);
    if (unpriced) expect(cardFacts(unpriced)).toContain('Fare unknown: no report for this ride.');
    // Oversized reports stay on cards rather than being cut into misleading prompt fragments.
    const ride = result.evidence.cards.find(card => card.kind === 'ride')!;
    expect(routeGroundingContext([{ ...ride, board: { ...ride.board, name: 'x'.repeat(241) } }])).toBeNull();
  });

  it('requires confirmation for ambiguous aliases and rejects absent places', async () => {
    const [alias, ids] = [...pack.ambiguitiesByNorm][0]!;
    const manager = createRouteConversation(pack);
    const { destination } = supportedJourney();
    const clarification = await manager.handleUserMessage(`From ${alias} to ${destination.name}`);
    expect(clarification.type, JSON.stringify({ alias, destination: destination.name, clarification })).toBe('clarification');
    expect(manager.getState().trip.originPlaceId).toBeUndefined();
    if (clarification.type === 'clarification') expect(clarification.clarification.candidates.every(candidate => ids.includes(candidate.placeId))).toBe(true);
    const confirmed = await manager.handleClarificationPick(0);
    expect(['plan', 'failure']).toContain(confirmed.type);
    expect(manager.getState().trip.originPlaceId).toBe(clarification.type === 'clarification' ? clarification.clarification.candidates[0]!.placeId : '');
    const absent = await createRouteConversation(pack).handleUserMessage('From imaginary zzzzz station to another imaginary zzzzz station');
    expect(absent.type).toBe('failure');
  });

  it('displays only guarded model output citing the retrieved canonical evidence', async () => {
    const { origin, destination } = supportedJourney();
    const result = await createEvidencePort(pack).plan({ ...newTrip(pack), originPlaceId: origin.place_id, destinationPlaceId: destination.place_id });
    if (result.kind !== 'planned') throw new Error(result.reason);
    const context = routeGroundingContext(result.evidence.cards)!;
    const prompt = buildExplainPrompt(context).prompt;
    expect(prompt).not.toContain(result.evidence.cards[0]!.cardId);
    expect(prompt.length).toBeLessThan(7000);
    const fact = context.statements[0]!;
    async function* output() {
      yield JSON.stringify({ kind: 'step', cardRef: 'c1', inserts: [fact.id], text: 'Start here.' }) + '\n';
      yield JSON.stringify({ kind: 'summary', inserts: ['invented'], text: 'Guaranteed fare PHP 999.' }) + '\n';
    }
    const displayed: string[] = [];
    const report = await guardStream(context, output(), unit => displayed.push(renderSafeExplanation(unit, context)));
    expect(displayed).toEqual(['Start here. ' + fact.text]);
    expect(report.rejectedUnits.length).toBe(1);
  });

  it('resets trip references and redirects unrelated input without retrieval', async () => {
    const manager = createRouteConversation(pack);
    const { origin, destination } = supportedJourney();
    await manager.handleUserMessage(`From ${origin.name} to ${destination.name}`);
    manager.newTrip();
    expect((await manager.handleUserMessage('How much is the fare?')).type).toBe('needsTrip');
    expect(parse('Tell me a joke').kind).toBe('unrelated');
    expect((await manager.handleUserMessage('Tell me a joke')).type).toBe('redirect');
    expect(manager.getState().trip.selected).toBeUndefined();
  });

  it('recognizes the home quick question and asks for the missing starting point', async () => {
    const manager = createRouteConversation(pack);
    const answer = await manager.handleUserMessage('Paano pumunta sa One Ayala?');
    expect(answer.type).toBe('needsTrip');
    expect(manager.getState().trip.destinationPlaceId).toBeDefined();
    expect(manager.getState().trip.originPlaceId).toBeUndefined();
  });

  it('recognizes the phone question and clarifies Cubao against the real pack', async () => {
    const manager = createRouteConversation(pack);
    const answer = await manager.handleUserMessage('Paano pumunta recto to cubao');
    expect(answer.type).toBe('clarification');
    expect(manager.getState().trip.originPlaceId).toBeDefined();
    if (answer.type === 'clarification') {
      const chosen = answer.clarification.candidates.findIndex(candidate => candidate.name === 'Cubao LRT-2 station');
      expect(chosen).toBeGreaterThanOrEqual(0);
      expect((await manager.handleClarificationPick(chosen)).type).toBe('plan');
    }
  });

  it('answers the phone journey conversationally without an inference pass or access-field dump', async () => {
    const manager = createRouteConversation(pack);
    const clarification = await manager.handleUserMessage('Paano pumunta recto to cubao');
    if (clarification.type !== 'clarification') throw new Error(clarification.message);
    const plan = await manager.handleClarificationPick(clarification.clarification.candidates.findIndex(candidate => candidate.name === 'Cubao LRT-2 station'));
    expect(plan.type).toBe('plan');
    const text = routeReply(plan, 'Paano pumunta recto to cubao');
    expect(text).toContain('Sakay ka ng LRT-2 sa LRT-2 Recto station, tapos baba sa Cubao LRT-2 station.');
    expect(text).not.toMatch(/Access:|Boarding point for this place|Walk time unknown|Cards attached|PHP \d|₱\d/);
    const alight = await manager.handleUserMessage('Saan ako bababa?');
    expect(routeReply(alight, 'Saan ako bababa?')).toBe('Baba ka sa Cubao LRT-2 station.');
    const hours = await manager.handleUserMessage('Anong oras last trip?');
    if (hours.type !== 'followUp') throw new Error(hours.message);
    const hoursText = routeReply(hours, 'Anong oras last trip?');
    if (hours.hourStatements.every(hour => hour.status === 'unknown')) expect(hoursText).toContain('hindi ko makukumpirma ang last trip');
    expect(hoursText).not.toContain('Sakay ka');
  });

  it('keeps conflicting dated fares and unknown prices honest in conversational replies', async () => {
    const { origin, destination } = supportedJourney();
    const outcome = await createEvidencePort(pack).plan({ ...newTrip(pack), originPlaceId: origin.place_id, destinationPlaceId: destination.place_id });
    if (outcome.kind !== 'planned') throw new Error(outcome.reason);
    const ride = outcome.evidence.cards.find(card => card.kind === 'ride')!;
    const unknown = routeReply({ type: 'followUp', message: '', topic: 'ask_fare', cards: [{ ...ride, fares: [] }], hourStatements: [] }, 'Magkano?');
    expect(unknown).toContain('Hindi pa available ang pamasahe');
    expect(unknown).not.toMatch(/₱\d/);
    const sources = [{ sourceId: 'src_test', kind: 'post', postedAt: '2026-04-01', stale: true }];
    const text = routeReply({ type: 'followUp', message: '', topic: 'ask_fare', hourStatements: [], cards: [{ ...ride,
      fares: [{ fareId: 'fare_one', min: 20, max: 25, currency: 'PHP', sources }, { fareId: 'fare_two', min: 30, max: 30, currency: 'PHP', sources }],
      warnings: [{ code: 'fare_conflict', message: '', recordIds: [] }] }] }, 'Magkano?');
    expect(text).toContain('Magkakaiba ang halaga');
    expect(text).toContain('₱20–25');
    expect(text).toContain('₱30');
    expect(text).not.toMatch(/report:|2026-04-01|sources/i);
    expect(sources[0]!.postedAt).toBe('2026-04-01');
  });

  it('never displays invented route prose even when the model cites a valid fact', async () => {
    const { origin, destination } = supportedJourney();
    const result = await createEvidencePort(pack).plan({ ...newTrip(pack), originPlaceId: origin.place_id, destinationPlaceId: destination.place_id });
    if (result.kind !== 'planned') throw new Error(result.reason);
    const context = routeGroundingContext(result.evidence.cards)!;
    const fact = context.statements[0]!;
    async function* output() {
      yield JSON.stringify({ kind: 'summary', inserts: [fact.id], text: 'Board a secret express at Imaginary Terminal.' }) + '\n';
    }
    const displayed: string[] = [];
    await guardStream(context, output(), unit => displayed.push(renderGroundedRouteUnit(unit, context)));
    expect(displayed).toEqual([]);
    expect(displayed.join('')).not.toContain('Imaginary');
  });

  it('grounds fare and hours follow-ups in their requested topic', async () => {
    const { origin, destination } = supportedJourney();
    const manager = createRouteConversation(pack);
    await manager.handleUserMessage(`From ${origin.name} to ${destination.name}`);
    const fare = await manager.handleUserMessage('How much is the fare?');
    if (fare.type !== 'followUp') throw new Error(fare.message);
    const fareContext = routeGroundingContext(fare.cards, fare.hourStatements, fare.topic)!;
    expect(fareContext.statements.every(statement => /fare/i.test(statement.text))).toBe(true);
    const hours = await manager.handleUserMessage('What time is the last trip?');
    if (hours.type !== 'followUp') throw new Error(hours.message);
    const hourContext = routeGroundingContext(hours.cards, hours.hourStatements, hours.topic)!;
    expect(hourContext.statements.every(statement => statement.role === 'hours')).toBe(true);
  });
  it('remembers a bare destination and treats the next place as the missing origin', async () => {
    const manager = createRouteConversation(pack);
    const destination = await manager.handleUserMessage('sm north edsa');
    expect(destination.type).toBe('needsTrip');
    const firstTrip = manager.getState().trip;
    expect(pack.places.get(firstTrip.destinationPlaceId!)?.name).toMatch(/SM North/i);
    expect(firstTrip.originPlaceId).toBeUndefined();
    const spoken = routeReply(destination, 'sm north edsa', firstTrip, pack);
    expect(spoken).toContain('Where are you coming from?');
    expect(spoken).toContain('SM North');
    // No inferred connection: the available pack may have no complete Ayala -> SM North route.
    const result = await manager.handleUserMessage('ayala mrt');
    expect(['plan', 'failure']).toContain(result.type);
    expect(pack.places.get(manager.getState().trip.originPlaceId!)?.name).toMatch(/Ayala/i);
    expect(manager.getState().trip.destinationPlaceId).toBe(firstTrip.destinationPlaceId);
  });
  it('keeps short replies ambiguous until the commuter picks a place', async () => {
    const manager = createRouteConversation(pack);
    const result = await manager.handleUserMessage('Cubao');
    expect(result.type).toBe('clarification');
    expect(manager.getState().trip.destinationPlaceId).toBeUndefined();
  });
  it('handles an explicit conversational starting point before asking for the destination', async () => {
    const manager = createRouteConversation(pack);
    const result = await manager.handleUserMessage('I’m at Ayala MRT');
    expect(result.type).toBe('needsTrip');
    expect(manager.getState().trip.originPlaceId).toBeDefined();
    expect(manager.getState().trip.destinationPlaceId).toBeUndefined();
    expect(routeReply(result, 'I’m at Ayala MRT', manager.getState().trip, pack)).toContain('Where are we heading?');
  });
  it('answers duration follow-ups without replaying directions or fabricating minutes', async () => {
    const { origin, destination } = supportedJourney();
    const manager = createRouteConversation(pack);
    await manager.handleUserMessage(`From ${origin.name} to ${destination.name}`);
    const result = await manager.handleUserMessage('How long is the journey?');
    expect(result.type).toBe('followUp');
    if (result.type !== 'followUp') throw new Error(result.message);
    expect(routeReply(result, 'How long is the journey?')).toMatch(/pending|minutes/);
    const context = routeGroundingContext(result.cards, [], result.topic, 'How long is the journey?')!;
    expect(context.statements.every(statement => /time|minutes/.test(statement.text))).toBe(true);
    expect(context.statements.every(statement => statement.role !== 'step')).toBe(true);
  });
});
