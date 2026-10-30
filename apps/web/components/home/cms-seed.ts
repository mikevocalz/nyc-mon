import { DISTRICT_COPY } from '@acme/spatial/copy';
import { W01_COPY } from './copy';
import { WAITLIST_COPY } from '../waitlist/copy';
import { art, artHref, starterArt, type ArtEntry, type ArtSlot } from './art';
import { starterCards } from './StartersSection';

/** Export the shipped copy, not freshly invented replacement marketing content. */
export function buildHomeSeed(origin: string) {
  const rows = (values: Record<string, string>) => Object.entries(values).map(([key, value]) => ({ key, label: key.replaceAll('.', ' / '), value }));
  const section = (sectionKey: string, label: string, copy: Record<string, string> = {}) => ({ sectionKey, label, hidden: false, copy: rows(copy), content: [] });
  const hero = W01_COPY.hero, world = W01_COPY.world, hlynk = W01_COPY.hlynk, starters = W01_COPY.starters, care = W01_COPY.care, hatch = W01_COPY.hatch;
  const cards = starterCards();
  const sections = [
    section('hero', 'Hero', { title: hero.title, body: hero.body, cta: hero.cta, ctaHref: hero.ctaHref, districtLabel: hero.districtLabel }),
    section('signage', 'District board', { title: W01_COPY.signage.title, ...Object.fromEntries(Object.entries(DISTRICT_COPY).flatMap(([key, value]) => [[`districts.${key}.name`, value.name], [`districts.${key}.streets`, value.streets ?? '']])) }),
    section('world', 'World', { title: world.title, body: world.body, body2: world.body2 }),
    section('district-divider', 'District divider'),
    section('hlynk', 'H-Lynk', { title: hlynk.title, lede: hlynk.lede, body: hlynk.body, bond: hlynk.bond, stageLabel: hlynk.stageLabel, caption: hlynk.caption, 'screen.controlLabel': hlynk.screen.controlLabel, 'screen.sideKey': hlynk.screen.sideKey, 'screen.sound': hlynk.screen.sound, ...Object.fromEntries(hlynk.proof.flatMap((item, i) => [[`proof.${i}.title`, item.title], [`proof.${i}.line`, item.line]])) }),
    section('starters', 'Starter Mons', { eyebrow: starters.eyebrow, title: starters.title, body: starters.body(cards.map((card) => card.eggName)), body2: starters.body2, ...Object.fromEntries(cards.flatMap((card) => [[`cards.${card.slot}.name`, card.babyName], [`cards.${card.slot}.bloodline`, card.bloodline], [`cards.${card.slot}.hatchesFrom`, starters.hatchesFrom(card.eggName)]])) }),
    section('grid', 'Grid animation'),
    section('care', 'Care', { title: care.title, body: care.body, closing: care.closing, example: care.example, cueLabel: care.cueLabel, answerLabel: care.answerLabel, meterLabel: '{meter}, example level', ...Object.fromEntries(care.items.flatMap((item, i) => (['verb', 'meter', 'cue', 'answer'] as const).map((key) => [`items.${i}.${key}`, item[key]]))) }),
    section('hatch', 'Hatch', { eyebrow: hatch.eyebrow, 'title.0': hatch.title[0], 'title.1': hatch.title[1], body: hatch.body, body2: hatch.body2, closing: hatch.closing }),
    section('waitlist', 'Waitlist', { title: WAITLIST_COPY.section.title, body: WAITLIST_COPY.section.body }),
  ];
  const slots: [string, ArtSlot][] = [
    ['hero', 'hero'], ['world', 'world.primary'], ['world', 'world.secondary'],
    ['hlynk', 'hlynk.static'], ['hlynk', 'hlynk.scanner'], ['hlynk', 'hlynk.controls'],
    ['hatch', 'hatch'],
  ];
  // Starter plates are keyed by slot number; a Baby without art yet (Coming Soon) exports no image.
  const entries: [string, string, ArtEntry][] = [
    ...slots.map(([sectionKey, slot]): [string, string, ArtEntry] => [sectionKey, slot, art(slot)]),
    ...cards.flatMap((card): [string, string, ArtEntry][] => { const image = starterArt(card.slot); return image ? [['starters', `starter.${card.slot}`, image]] : []; }),
  ];
  const assets = entries.map(([sectionKey, slot, image]) => {
    return { sectionKey, slot, source: new URL(artHref(image), origin).href, alt: image.alt, decorative: Boolean(image.decorative),
      width: image.width, height: image.height, focalX: image.focalPoint?.x ?? 0.5, focalY: image.focalPoint?.y ?? 0.5,
      caption: image.caption ? slot === 'hero' ? W01_COPY.landmarkCaption(image.caption.title, image.caption.place) : image.district ? W01_COPY.placeCaption(image.district, image.caption.place) : image.caption.title : '' };
  });
  return { schemaVersion: 1, page: { title: 'Home', route: '/', _status: 'draft', seo: { title: `NYC-MON | ${hero.title}`, description: hero.body }, sections }, assets };
}
