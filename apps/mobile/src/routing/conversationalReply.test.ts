import { describe, expect, it } from 'vitest';
import { conversationalReply } from './conversationalReply';

describe('Gaile conversation', () => {
  it.each(['Who are you?', 'sino ka?', 'What is your name?'])('introduces the app assistant: %s', query => {
    expect(conversationalReply(query)).toContain('I’m Gaile');
  });
  it.each(['What do you know?', 'What can you do?', 'help'])('explains supported questions: %s', query => {
    expect(conversationalReply(query)).toContain('reported fares and hours');
  });
  it('handles greetings and thanks without claiming live information', () => {
    expect(conversationalReply('Hello!')).toContain('Saan ka');
    expect(conversationalReply('salamat po')).toContain('Walang anuman');
    expect(conversationalReply('Are you offline?')).toContain('stored on your phone');
  });
  it('leaves journey requests to the route conversation manager', () => {
    expect(conversationalReply('Paano pumunta Recto to Cubao?')).toBeNull();
    expect(conversationalReply('From Recto to Cubao')).toBeNull();
  });
});
