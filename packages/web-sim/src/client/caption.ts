/** Spoken-only stage directions (*chuckle*, *short huff*) removed, spaces tidied. */
export function captionText(text: string): string {
  return text
    .replace(/\*[^*\n]{1,60}\*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?])/g, '$1')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}
