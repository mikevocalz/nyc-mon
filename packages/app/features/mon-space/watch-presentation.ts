import { deriveMonMood, voiceStage } from '@acme/core/sim';
import type { CareState, MonInstance } from '@acme/core/types';
import { monLine } from '@acme/content/lines';
import { planMonUtterance, type MonLingo } from '@acme/content/voice';

/** Watch replies use the same authored lines and first-day babble gate as the app. */
export function watchPresentation(mon: MonInstance, care: CareState, now: number, lingo?: MonLingo) {
  const mood = deriveMonMood(care);
  const stage = voiceStage(mon, now);
  const reply = (occasion: 'hello' | 'hungry') => {
    const line = monLine(occasion, { ...mon, mood }, lingo);
    return planMonUtterance(line ?? '', {
      lineageId: mon.voiceLineageId ?? mon.speciesId,
      stage: mon.stage, voiceStage: stage, mood,
    }, lingo, { seed: `${mon.monInstanceId}|watch|${occasion}|${stage}|${mood}` }).caption;
  };
  return { speciesId: mon.speciesId, hello: reply('hello'), hungry: reply('hungry') };
}
