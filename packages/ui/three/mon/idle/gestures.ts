import type { MonGesture } from '../lipsync/cue.ts';

/**
 * Which upper-body gesture a spoken sentence earns, from its words. The host
 * (the simulator's voice player) classifies each sentence and sends the class
 * on its start cue; the view maps the class to one of the Mon's own clips.
 * At most one per sentence, and most sentences get none: a Mon that gestures
 * on every line reads as a mime.
 */
const RULES: readonly (readonly [MonGesture, RegExp])[] = [
  ['greet', /\b(yo|hey|hi|hello|what['’]?s good|wassup|sup|welcome|good (morning|evening|night)|bye|later|peace)\b/i],
  ['deny', /\b(nah|no way|nope|can['’]?t|not (now|yet|happening)|only the caller)\b/i],
  ['self', /\b(i['’]?m|i am|me|my|myself|mine)\b/i],
  ['excited', /!|\b(bet|let['’]?s go|yes+|fire|lit|hype|love (it|that))\b/i],
  ['agree', /\b(say less|for real|facts|true|yeah|yep|ok(ay)?|got (you|it)|word)\b/i],
];

/** A sentence's gesture class, or null for none. Stage directions (*chuckle*) are not words. */
export function gestureFor(sentence: string): MonGesture | null {
  const words = sentence.replace(/\*[^*]*\*/g, ' ').trim();
  if (words === '') return null;
  if (/\?\s*["”’']?\s*$/.test(words)) return 'question';
  for (const [gesture, re] of RULES) if (re.test(words)) return gesture;
  return null;
}

/**
 * Each class's clip, best first; the first one the GLB has wins. Lil' Ratti
 * has all of these. Squeaklet has none, so it keeps its idle and hops.
 */
export const GESTURE_CLIPS: Readonly<Record<MonGesture, readonly string[]>> = {
  greet: ['wave', 'head_nod'],
  question: ['shrug', 'up_look_listen'],
  self: ['self_point'],
  excited: ['emote_happy'],
  agree: ['head_nod'],
  deny: ['head_shake'],
};
