import { describe, expect, it } from 'vitest';
import { captionText, spokenText, unwrapQuotes } from '../src/client/caption.ts';

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

describe('quote marks', () => {
  it('drops one matching pair of quotes around the whole line', () => {
    expect(captionText('"Hold up Callah… my stomach is talking louder than I am right now."')).toBe(
      'Hold up Caller… my stomach is talking louder than I am right now.',
    );
    expect(captionText('“Feed me, Callah.”')).toBe('Feed me, Caller.');
    expect(captionText('‘Night night.’')).toBe('Night night.');
    expect(captionText("*yawn* 'Five more minutes.'")).toBe('Five more minutes.');
  });

  it('keeps quotes that do not wrap the line, and unmatched pairs', () => {
    expect(captionText('It said "feed me" twice.')).toBe('It said "feed me" twice.');
    expect(captionText('"Feed me,” it said.')).toBe('"Feed me,” it said.');
    expect(captionText('“Hold up')).toBe('“Hold up');
    expect(unwrapQuotes('"a" and "b"')).toBe('"a" and "b"');
  });

  it('sends no double quote marks to the voice', () => {
    expect(spokenText('"Hold up Callah… my stomach')).toBe('Hold up Callah… my stomach');
    expect(spokenText('louder than I am right now.”')).toBe('louder than I am right now.');
    expect(spokenText("It's \"fine\" *huff*")).toBe("It's fine *huff*");
  });
});
