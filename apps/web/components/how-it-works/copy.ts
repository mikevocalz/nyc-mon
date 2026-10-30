import { DISTRICT_COPY, HOME_COPY } from '@acme/spatial/copy';
import { W01_COPY } from '../home/copy';

/**
 * Every string on the How it works page (W04): the Phase-1 companion loop,
 * Meet → Name → Incubate → Hatch → Care. Phase 1 scope only — nothing past
 * the care loop. All `voice: "ui"`.
 *
 * The page's own lines are below. Where a stop or band repeats a line the
 * site already says, it reads it from its one source (the home page's
 * `W01_COPY`, `HOME_COPY`, `DISTRICT_COPY`), so the two pages never drift.
 * The incubation options are the glossary's (docs/COPY_DECK.md, V11 ¶49).
 */
export const W04_COPY = {
  loop: {
    eyebrow: 'The loop',
    title: 'How it works',
    /** The hero's two signage plates; the guard below keeps them spelling `title`. */
    titleLines: ['How it', 'works'],
    body: 'Five steps, from the day you meet your egg to everyday care.',
    listLabel: 'The five steps',
    steps: [
      { numeral: '01', verb: 'Meet', line: 'Dr. Santoro shows you four eggs. You pick one.' },
      { numeral: '02', verb: 'Name', line: 'You pick a Caller name, the one your Mon will know you by.' },
      { numeral: '03', verb: 'Incubate', line: "15 minutes, 30 minutes or an hour, then one notification when it's ready." },
      { numeral: '04', verb: 'Hatch', line: 'Your Mon chooses too. The first look your Mon gives you is the yes.' },
      { numeral: '05', verb: 'Care', line: 'Feed, Rest and Play raise Fullness, Energy and Social.' },
    ],
  },
  /** Stop 02's art: the H-Lynk Core, in the home page's words. */
  hlynk: { name: W01_COPY.hlynk.title, lede: W01_COPY.hlynk.lede },
  /** Stop 03's three options (COPY_DECK glossary: Incubation). */
  incubation: { label: 'Incubation', options: ['15 minutes', '30 minutes', '1 hour'] },
  /** Stop 04's line under the Baby art: the home hatch band's closing line. */
  hatchClosing: W01_COPY.hatch.closing,
  /** Stop 05's bento: the home page's care copy, one source. */
  care: W01_COPY.care,
  /** The end of the line: the city, in the home page's words. */
  city: {
    title: W01_COPY.world.title,
    body: W01_COPY.world.body,
    body2: W01_COPY.world.body2,
    boardLabel: W01_COPY.signage.title,
    cta: HOME_COPY.openCity,
    ctaHref: '/spatial',
    districts: DISTRICT_COPY,
  },
  cta: {
    eyebrow: 'The waitlist',
    title: 'Get on the waitlist.',
    body: "NYC-MON isn't out yet. Leave your email and we'll let you know the day it is.",
    cta: 'Join the waitlist',
    ctaHref: '/get',
  },
} as const;

if (W04_COPY.loop.titleLines.join(' ') !== W04_COPY.loop.title) {
  throw new Error('W04 hero title lines must spell W04_COPY.loop.title');
}
