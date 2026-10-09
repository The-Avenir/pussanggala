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
  it('ships exactly the measured bytes and loads the complete eligible pack', () => {
    for (const spec of catalog) {
      const file = readFileSync(new URL('../../' + spec.bundlePath, import.meta.url));
      expect(file.length).toBe(spec.bytes);
      expect(createHash('sha256').update(file).digest('hex')).toBe(spec.sha256);
    }
    expect(pack.routes.size).toBe(69);
    expect(pack.places.size).toBe(91);
    expect(pack.legs.size).toBe(134);
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
    const facts = result.evidence.cards.flatMap(cardFacts);
    expect(context!.statements.every(statement => facts.includes(statement.text))).toBe(true);
    expect(context!.statements.every(statement => statement.packRecordIds.every(id => result.evidence.allowedRecordIds.includes(id)))).toBe(true);
    const unpriced = result.evidence.cards.find(card => card.kind === 'ride' && !card.fares.length);
    if (unpriced) expect(cardFacts(unpriced)).toContain('Fare unknown: no report for this ride.');
    // Oversized reports stay on cards rather than being cut into misleading prompt fragments.
    const card = result.evidence.cards[0]!;
    const oversized = { ...card, warnings: [{ code: 'source_date_unknown' as const, message: 'x'.repeat(241), recordIds: card.recordIds }] };
    expect(routeGroundingContext([oversized])).toBeNull();
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
    expect(unknown).toContain('Ayokong hulaan');
    expect(unknown).not.toMatch(/₱\d/);
    const sources = [{ sourceId: 'src_test', kind: 'post', postedAt: '2026-04-01', stale: true }];
    const text = routeReply({ type: 'followUp', message: '', topic: 'ask_fare', hourStatements: [], cards: [{ ...ride,
      fares: [{ fareId: 'fare_one', min: 20, max: 25, currency: 'PHP', sources }, { fareId: 'fare_two', min: 30, max: 30, currency: 'PHP', sources }],
      warnings: [{ code: 'fare_conflict', message: '', recordIds: [] }] }] }, 'Magkano?');
    expect(text).toContain('magkakaiba ang naiulat');
    expect(text).toContain('₱20–25 (report: 2026-04-01)');
    expect(text).toContain('₱30 (report: 2026-04-01)');
    expect(text).toContain('Hindi ko makukumpirma kung alin');
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
    expect(displayed).toEqual([fact.text]);
    expect(displayed.join('')).not.toContain('Imaginary');
  });

  it('grounds fare and hours follow-ups in their requested topic', async () => {
    const { origin, destination } = supportedJourney();
    const manager = createRouteConversation(pack);
    await manager.handleUserMessage(`From ${origin.name} to ${destination.name}`);
    const fare = await manager.handleUserMessage('How much is the fare?');
    if (fare.type !== 'followUp') throw new Error(fare.message);
    const fareContext = routeGroundingContext(fare.cards, fare.hourStatements, fare.topic)!;
    expect(fareContext.statements.every(statement => /^Reported fare:|^Fare unknown:|^Fare reports differ|^Source post/.test(statement.text))).toBe(true);
    const hours = await manager.handleUserMessage('What time is the last trip?');
    if (hours.type !== 'followUp') throw new Error(hours.message);
    const hourContext = routeGroundingContext(hours.cards, hours.hourStatements, hours.topic)!;
    expect(hourContext.statements.every(statement => statement.role === 'hours')).toBe(true);
  });
});
