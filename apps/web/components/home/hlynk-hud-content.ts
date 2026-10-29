import { starterBloodlines } from '@acme/content';
import { DISTRICT_COPY, DISTRICTS } from '@acme/spatial/copy';
import { W01_COPY } from './copy.ts';
import type { HudContent, HudMeter } from '@acme/ui/three/hlynk/hud';

/** Care meter colour on the screen, by the CARE section's tone for the same meter. */
const METER_TONE: Record<(typeof W01_COPY.care.items)[number]['color'], HudMeter['tone']> = {
  orange: 'amber',
  royal: 'cyan',
  leaf: 'green',
};
/** The Care tab lists the meters in this order. */
const METER_ORDER = ['Energy', 'Fullness', 'Social'] as const;

/**
 * What the H-Lynk's screen shows (PS-037), all from approved sources: the
 * tier name and "Your Mon" (copy.ts), the three starters' Baby names and Dex
 * numbers (@acme/content, Baby forms only), the CARE section's example meter
 * levels with its "example" line, and the four district names. Nothing is
 * invented for the screen.
 */
export function hudContent(): HudContent {
  const screen = W01_COPY.hlynk.screen;
  const starters = starterBloodlines.map(({ bloodline }) => {
    const baby = bloodline.chain.evolvesTo[0];
    if (!baby || baby.formName === null || baby.dexId === null) {
      throw new Error(`${bloodline.bloodlineId} has no named Baby form in @acme/content`);
    }
    return { babyName: baby.formName, dexId: baby.dexId };
  });
  const mon = starters[0]?.babyName;
  if (!mon) throw new Error('@acme/content has no starter in slot 1');
  const meters = METER_ORDER.map((name) => {
    const item = W01_COPY.care.items.find((i) => i.meter === name);
    if (!item) throw new Error(`W01_COPY.care has no ${name} meter`);
    return { name, value: item.value, tone: METER_TONE[item.color] };
  });
  return {
    title: screen.title,
    mon,
    note: screen.note,
    tabs: screen.tabs,
    dex: starters.map((s) => ({ no: W01_COPY.starters.dex(s.dexId), name: s.babyName })),
    care: { meters, note: W01_COPY.care.example },
    bag: screen.bag,
    city: { districts: DISTRICTS.map((d) => DISTRICT_COPY[d].name), line: W01_COPY.world.body2 },
  };
}
