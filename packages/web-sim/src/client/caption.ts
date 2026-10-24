/**
 * What the screen shows for a spoken line. Stage directions (*chuckle*) are
 * performed by the voice, so they're dropped. "Callah" is how a Mon SAYS
 * Caller (TTS lexicon, ADR 0008: Caller → "Call-uh"); on screen the word is
 * always spelled Caller.
 */
export function captionText(text: string): string {
  return text
    .replace(/\bCallah(s?)\b/g, 'Caller$1')
    .replace(/\bCALLAH(S?)\b/g, 'CALLER$1')
    .replace(/\bcallah(s?)\b/g, 'caller$1')
    .replace(/\*[^*\n]{1,60}\*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?])/g, '$1')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}
