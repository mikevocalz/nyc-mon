import { describe, expect, it } from 'vitest';
import { captionText } from '../src/client/caption.ts';

describe('captionText', () => {
  it('drops stage directions the voice performs', () => {
    expect(captionText('I’ll let your Mon answer that.\n*chuckle* Yeah Callah, I’m good.')).toBe('I’ll let your Mon answer that.\nYeah Caller, I’m good.');
    expect(captionText('*short huff, Squeaklet turns back to the Caller.* Only the Caller can share a meal.')).toBe('Only the Caller can share a meal.');
  });

  it('leaves plain text and a lone asterisk alone', () => {
    expect(captionText('Fullness is at 31 percent.')).toBe('Fullness is at 31 percent.');
    expect(captionText('5 * 3 is fifteen')).toBe('5 * 3 is fifteen');
  });

  it('spells Callah as Caller on screen (the voice still says Call-uh)', () => {
    expect(captionText('You my Callah, for real.')).toBe('You my Caller, for real.');
    expect(captionText('Callahs gotta eat.')).toBe('Callers gotta eat.');
    expect(captionText('Callahan Street')).toBe('Callahan Street');
  });
});
