import { describe, expect, it } from 'vitest';
import { captionText, spokenText, unwrapQuotes } from '../captions.ts';

describe('captionText', () => {
  it('drops stage directions the voice performs', () => {
    expect(captionText('I’ll let your Mon answer that.\n*chuckle* Yeah Callah, I’m good.')).toBe('I’ll let your Mon answer that. Yeah Caller, I’m good.');
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

  it('keeps quotes that do not wrap the line, and pairs closed inside the sentence', () => {
    expect(captionText('It said "feed me" twice.')).toBe('It said "feed me" twice.');
    expect(captionText('"Feed me,” it said.')).toBe('"Feed me,” it said.');
    // A streamed sentence's lone opener is half of a pair split across sentences.
    expect(captionText('“Hold up')).toBe('Hold up');
    expect(unwrapQuotes('"a" and "b"')).toBe('"a" and "b"');
  });

  it('sends no double quote marks to the voice', () => {
    expect(spokenText('"Hold up Callah… my stomach')).toBe('Hold up Callah… my stomach');
    expect(spokenText('louder than I am right now.”')).toBe('louder than I am right now.');
    expect(spokenText("It's \"fine\" *huff*")).toBe("It's fine *huff*");
  });
});

describe('streamed sentences', () => {
  it('drops the half of a quote pair a sentence carries alone', () => {
    expect(captionText('“Say less, Callah.')).toBe('Say less, Caller.');
    expect(captionText('That hit.”')).toBe('That hit.');
    expect(captionText('"Say less, Callah. That hit."')).toBe('Say less, Caller. That hit.');
    expect(captionText('*chuckle* “Callah, I be right here.')).toBe('Caller, I be right here.');
    expect(captionText('“Say less, Callah. That hit.” We good.')).toBe('Say less, Caller. That hit. We good.');
  });

  it('keeps quotes matched inside a sentence, and single marks that are words', () => {
    expect(captionText('It said “feed me” twice.')).toBe('It said “feed me” twice.');
    expect(captionText('’Cause I’m hungry, Callah.')).toBe('’Cause I’m hungry, Caller.');
    expect(captionText('We goin’ out.')).toBe('We goin’ out.');
  });

  it('shows one line, never a blank second line', () => {
    expect(captionText('“Say less, Callah. That hit.”\n\n*chuckle* Next')).toBe('Say less, Caller. That hit. Next');
    expect(captionText('Bet!\n\nLil’ Ratti is good.')).toBe('Bet! Lil’ Ratti is good.');
  });
});

describe('markdown the model sent despite the prompt', () => {
  // Nemotron on Nebius answered the hosted companion with "## headings",
  // "- **label**" bullets and "**Roasted chestnuts** are your favorite". The
  // stage-direction rule read each "*…*" inside the bold as a direction, so the
  // screen showed "* * are your favorite" and the voice skipped the words.
  it('keeps the words of bold text on screen', () => {
    expect(captionText('For your snack: **Roasted chestnuts** are your favorite.')).toBe('For your snack: Roasted chestnuts are your favorite.');
    expect(captionText('Right now your Mon is __awake__, Callah.')).toBe('Right now your Mon is awake, Caller.');
  });

  it('drops heading and bullet markers but keeps their words', () => {
    expect(captionText('## First, who you are\n- **Name:** Call me Captain Lantern.\n* Snack: chestnuts\n1. Feed me')).toBe(
      'First, who you are Name: Call me Captain Lantern. Snack: chestnuts Feed me',
    );
  });

  it('still drops a real stage direction next to bold text', () => {
    expect(captionText('*chuckle* **Captain Lantern**, I see you.')).toBe('Captain Lantern, I see you.');
  });

  it('sends the bold words, not the markers, to the voice', () => {
    expect(spokenText('**Roasted chestnuts** are your favorite. *yawn*')).toBe('Roasted chestnuts are your favorite. *yawn*');
    expect(spokenText('## Next\n- **Fullness:** 81 percent')).toBe('Next\nFullness: 81 percent');
  });
});
