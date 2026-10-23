import { MON_GENDERS } from '../schemas/seams.ts';
import type { EggRecord, MonGender } from '../types/index.ts';
import { hash128 } from './random.ts';

/**
 * Voice slots per gender in a line's pool. A lineage id stores its slot, so
 * a Mon's voice never moves when content changes. Pools hold this many voices;
 * a shorter pool wraps (see `@acme/content` voices).
 */
export const VOICE_SLOTS_PER_GENDER = 4;

/** Salted apart from `deriveMonInstanceId`, so the id and the voice draw are unrelated bits. */
function voiceWords(eggId: string): readonly [number, number, number, number] {
  return hash128(`nyc-mon/voice/${eggId}`);
}

/**
 * The individual's gender (Bible v11 ¶54), a pure function of the egg id so
 * every device and the server replay agree. Uses bit 0 of the first hash word.
 */
export function deriveMonGender(eggId: string): MonGender {
  const [first] = voiceWords(eggId);
  return (first & 1) === 0 ? 'female' : 'male';
}

function deriveVoiceSlot(eggId: string): number {
  const [, second] = voiceWords(eggId);
  return (second % VOICE_SLOTS_PER_GENDER) + 1;
}

/**
 * The one voice lineage an egg's Mon keeps for life (Bible v11 ¶56):
 * `<egg form speciesId>/<gender>/<slot>`, e.g. `dex-001/female/2`. The line is
 * keyed by the Egg form's Dex id because core cannot read content; the voice
 * registry in `@acme/content` maps that key to its bloodline's pool.
 */
export function deriveVoiceLineageId(egg: Pick<EggRecord, 'eggId' | 'speciesId'>): string {
  return `${egg.speciesId}/${deriveMonGender(egg.eggId)}/${deriveVoiceSlot(egg.eggId)}`;
}

export interface ParsedVoiceLineage {
  /** The Egg form's speciesId of the line, e.g. `dex-001`. */
  readonly lineKey: string;
  readonly gender: MonGender;
  /** 1-based slot in the line's per-gender pool. */
  readonly slot: number;
}

/** Splits a lineage id; undefined for anything `deriveVoiceLineageId` could not have produced. */
export function parseVoiceLineageId(lineageId: string): ParsedVoiceLineage | undefined {
  const parts = lineageId.split('/');
  if (parts.length !== 3) return undefined;
  const [lineKey, gender, slotText] = parts as [string, string, string];
  if (lineKey === '' || !(MON_GENDERS as readonly string[]).includes(gender)) return undefined;
  if (!/^[1-9]\d*$/.test(slotText)) return undefined;
  const slot = Number(slotText);
  if (slot > VOICE_SLOTS_PER_GENDER) return undefined;
  return { lineKey, gender: gender as MonGender, slot };
}
