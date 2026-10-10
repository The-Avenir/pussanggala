import { describe, expect, it } from 'vitest';
import { conversationalReply } from './conversationalReply';

describe('Gaile conversation', () => {
  it.each(['Who are you?', 'sino ka?', 'What is your name?'])('introduces the app assistant: %s', query => {
    expect(conversationalReply(query)).toContain('I’m Gaile');
  });
  it.each(['What do you know?', 'What can you do?', 'help'])('explains supported questions: %s', query => {
    expect(conversationalReply(query)).toContain('fares and travel times');
  });
  it('handles greetings and thanks without claiming live information', () => {
    expect(conversationalReply('Hello!')).toContain('Where are we heading');
    expect(conversationalReply('salamat po')).toContain('Walang anuman');
    expect(conversationalReply('Are you offline?')).toContain('stored on your phone');
  });
  it('leaves journey requests to the route conversation manager', () => {
    expect(conversationalReply('Paano pumunta Recto to Cubao?')).toBeNull();
    expect(conversationalReply('From Recto to Cubao')).toBeNull();
  });
  it('asks only the missing origin and keeps small talk out of technical reports', () => {
    const trip = { packId: 'test', schemaVersion: 1, preference: 'balanced' as const, currentStep: 0, destinationPlaceId: 'destination' };
    expect(conversationalReply('Hello!', undefined, trip)).toBe('Hi, traveler! Where are you coming from?');
    expect(conversationalReply('Who are you?')).not.toMatch(/reports|records|sources|pack/);
    expect(conversationalReply('What can you do?')).not.toMatch(/reports|records|sources|pack/);
    expect(conversationalReply('Thank you!')).not.toContain('?');
  });
});
