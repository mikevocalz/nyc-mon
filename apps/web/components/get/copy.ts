import { HOME_COPY } from '@acme/spatial/copy';
import { W01_COPY } from '../home/copy';
import { W04_COPY } from '../how-it-works/copy';
import { LEGAL_COPY } from '../legal/copy';
import { WAITLIST_COPY } from '../waitlist/copy';

/**
 * The waitlist page's own strings (W05). All `voice: "ui"`: warm, plain and
 * honest about scope. The form's strings live with the form in
 * `components/waitlist/copy.ts`, shared with the home page (PS-023).
 *
 * The bento under the hero repeats lines the site already says; each is read
 * from its one source (home, How it works, the privacy notice), never
 * rewritten here. No counts, no dates, no social proof.
 */
const privacyNever = LEGAL_COPY.privacy.sections.find((s) => s.id === 'w06-privacy-never');
const [noAds] = privacyNever?.body ?? [];
if (!privacyNever || typeof noAds !== 'string') {
  throw new Error('W05 privacy tile needs the privacy notice’s "What we never do" section');
}

export const W05_COPY = {
  hero: {
    eyebrow: 'The waitlist',
    title: 'Get NYC-MON',
    /** The h1 as two signage plates; the guard below keeps them spelling `title`. */
    titleLines: ['Get', 'NYC-MON'],
    body: "NYC-MON is coming to iOS and Android. Until it's out, the waitlist is how you'll hear the day it lands.",
  },
  /** The form plate's headline: the home waitlist section's, one source. */
  form: { title: WAITLIST_COPY.section.title },
  stores: {
    label: 'The app stores',
    badges: [
      { name: 'App Store', note: 'At launch' },
      { name: 'Google Play', note: 'At launch' },
    ] as const,
  },
  bento: {
    title: HOME_COPY.tagline,
    eggs: { title: W01_COPY.starters.title, body: W01_COPY.hero.body },
    hlynk: { title: W01_COPY.hlynk.title, lede: W01_COPY.hlynk.lede, body: W01_COPY.hlynk.bond },
    privacy: {
      title: privacyNever.title,
      promise: WAITLIST_COPY.form.privacy,
      body: noAds,
      links: [
        { label: LEGAL_COPY.privacy.title, href: '/legal/privacy' },
        { label: LEGAL_COPY.childrens.title, href: '/legal/childrens-privacy' },
      ],
    },
    loop: { title: W04_COPY.loop.title, body: W04_COPY.loop.body, href: '/how-it-works', steps: W04_COPY.loop.steps },
  },
} as const;

if (W05_COPY.hero.titleLines.join(' ') !== W05_COPY.hero.title) {
  throw new Error('W05 hero title lines must spell W05_COPY.hero.title');
}
