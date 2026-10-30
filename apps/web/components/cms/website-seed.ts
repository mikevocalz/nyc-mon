import { copyFields } from '@acme/content/site-content';
import { BRAND_BADGE, BRAND_WORDMARK } from '@acme/assets/brand';
import { DISTRICT_COPY } from '@acme/spatial/copy';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';
import { buildHomeSeed } from '../home/cms-seed';
import { W01_COPY } from '../home/copy';
import type { ArtEntry } from '../home/art';
import { STORY_COPY } from '../story/copy';
import { STORY_PHOTOS } from '../story/art';
import { STORY_SECTION_MAP, STORY_IMAGE_SECTIONS } from '../story/cms';
import { W03_COPY } from '../city/copy';
import { CITY_PHOTO_DISTRICTS, cityPhoto } from '../city/art';
import { W04_COPY } from '../how-it-works/copy';
import { babyArt, eggArt, hatchNightArt, hlynkArt, photoArt, type RouteArt } from '../how-it-works/art';
import { W05_COPY } from '../get/copy';
import { W02_COPY } from '../mons/copy';
import { hatchArt, monsArt } from '../mons/art';
import { monsStarters } from '../mons/starters';
import { FOOTER_DEFAULTS, HEADER_DEFAULTS } from '../site/cms';

type CopyRow = ReturnType<typeof copyFields>[number];
interface SectionSeed { sectionKey: string; label: string; hidden: boolean; copy: CopyRow[]; content: never[] }
interface AssetSeed { sectionKey: string; slot: string; source: string; alt: string; decorative: boolean; width: number; height: number; focalX: number; focalY: number; caption: string }
interface PageSeed { page: { title: string; route: string; _status: 'draft'; seo: { title: string; description: string }; sections: SectionSeed[] }; assets: AssetSeed[] }
const section = (sectionKey: string, label: string, value: unknown = {}, extra: CopyRow[] = []): SectionSeed => ({ sectionKey, label, hidden: false, copy: [...copyFields(value), ...extra], content: [] });
const makePage = (title: string, route: string, description: string, sections: SectionSeed[]): PageSeed => ({ page: { title, route, _status: 'draft', seo: { title: `NYC-MON | ${title}`, description }, sections }, assets: [] });
function imageSource(src: ArtEntry['src']): string {
  if (typeof src === 'string') return src;
  if (typeof src === 'object') return src.src;
  throw new Error('Website seeds require web image sources');
}

/** The manifest is a read-only export of the shipped site; never invent copy or create published content. */
export function buildWebsiteSeed(origin: string): { schemaVersion: 2; pages: PageSeed[] } {
  const add = (target: PageSeed, sectionKey: string, slot: string, image: ArtEntry | RouteArt, caption?: string) => {
    const art = image as ArtEntry;
    const route = image as RouteArt;
    const place = art.caption ?? route.place;
    const point = art.focalPoint ?? { x: route.position ? parseFloat(route.position.left) / 100 : 0.5, y: route.position ? parseFloat(route.position.top) / 100 : 0.5 };
    target.assets.push({ sectionKey, slot, source: new URL(imageSource(image.src), origin).href, alt: image.alt,
      decorative: Boolean(art.decorative), width: image.width, height: image.height, focalX: point.x, focalY: point.y,
      caption: caption ?? (place ? image.district ? W01_COPY.placeCaption(image.district, place.place) : place.title : '') });
  };
  const homeSource = buildHomeSeed(origin);
  const home: PageSeed = { page: { ...homeSource.page, _status: 'draft' }, assets: [...homeSource.assets] };
  add(home, 'hero', 'seal', { ...BRAND_BADGE, decorative: { reason: 'The adjacent site wordmark names the brand.' } });

  const story = makePage('The Story', '/story', STORY_COPY.hero.body, [
    section('hero', 'Hero', STORY_COPY.hero), section('skyline', 'Skyline divider'),
    section('clean-city', 'The clean city', STORY_COPY.cleanCity), section('project-zero', 'Project Zero', STORY_COPY.projectZero),
    section('sunset', 'Sunset photograph'), section('vale', 'Dr. Vale', STORY_COPY.vale), section('extinction', 'Extinction', STORY_COPY.extinction),
    section('cascade', 'The cascade', STORY_COPY.cascade), section('returned', 'The return', STORY_COPY.returned),
    section('enginex', 'EngineX', STORY_COPY.enginex), section('outro', 'Closing', STORY_COPY.footer),
  ]);
  // Keep the explicit map alongside the reader contract; the seed cannot silently omit a copy group.
  for (const key of Object.values(STORY_SECTION_MAP)) if (!story.page.sections.some((s) => s.sectionKey === key)) throw new Error(`Missing Story section ${key}`);
  for (const [key, image] of Object.entries(STORY_PHOTOS)) add(story, STORY_IMAGE_SECTIONS[key as keyof typeof STORY_IMAGE_SECTIONS], key.toLowerCase(), image);

  const city = makePage('The City', '/city', W03_COPY.districts.body, [
    section('districts', 'District atlas', W03_COPY.districts, copyFields(DISTRICT_COPY, 'places')),
    section('street-grid', 'Street grid', W03_COPY.blocks), section('cast', 'The cast', W03_COPY.cast),
  ]);
  for (const district of CITY_PHOTO_DISTRICTS) {
    const photo = cityPhoto(district)!;
    add(city, 'districts', `district.${district}`, { src: photo.source, width: photo.width, height: photo.height, alt: photo.alt, sizes: photo.sizes, focalPoint: { x: 0.5, y: district === 'midtown' ? 0 : 0.5 } }, photo.title);
  }

  const how = makePage('How it works', '/how-it-works', W04_COPY.loop.body, [
    section('hero', 'Hero', { ...W04_COPY.loop, steps: undefined }),
    section('journey', 'The five care steps and city', {}, [
      ...copyFields(W04_COPY.loop.steps, 'steps'), ...copyFields(W04_COPY.hlynk, 'hlynk'), ...copyFields(W04_COPY.incubation, 'incubation'),
      ...copyFields(W04_COPY.hatchClosing, 'hatchClosing'), ...copyFields(W04_COPY.care, 'care'), ...copyFields(W04_COPY.city, 'city'),
    ]), section('cta', 'Waitlist', W04_COPY.cta),
  ]);
  const starters = monsStarters();
  const lead = starters[0];
  if (!lead) throw new Error('Cannot seed a website without the shipped starters');
  add(how, 'hero', `egg.${lead.slot}`, eggArt(lead.slot));
  add(how, 'hero', 'hlynk', hlynkArt('100vw'));
  add(how, 'hero', `baby.${lead.slot}`, babyArt(lead.slot, '100vw'));
  for (const mon of starters) {
    add(how, 'journey', `meet.egg.${mon.slot}`, eggArt(mon.slot));
    add(how, 'journey', `hatch.baby.${mon.slot}`, babyArt(mon.slot, '100vw'));
  }
  add(how, 'journey', 'name.hlynk', hlynkArt('100vw'));
  add(how, 'journey', 'incubate.hatch-night', hatchNightArt('100vw'));
  add(how, 'journey', 'care.baby.2', babyArt(2, '100vw'));
  add(how, 'journey', 'city.photo.megacity-brooklyn-bridge-night', photoArt('megacity-brooklyn-bridge-night', '100vw', { left: '50%', top: '55%' }));
  add(how, 'cta', 'egg.3', eggArt(3));

  const mons = makePage('The Mons', '/mons', W02_COPY.meta.indexDescription, [
    section('hero', 'Hero', { ...W02_COPY.index, conceptArt: W02_COPY.conceptArt, starterNames: Object.fromEntries(starters.map((mon) => [mon.slot, mon.babyName])) }), section('skyline', 'Skyline divider'),
    section('models', 'Interactive models', { heading: 'Meet them in 3D', comingSoon: 'Coming Soon', live: [{ name: 'Squeaklet', line: 'Hood Ratti · Baby' }, { name: 'Lil’ Ratti', line: 'Hood Ratti · Small' }], soon: [{ name: 'Hood Ratti', line: 'Hood Ratti · Mid' }, { name: 'Kittee Cee', line: 'Bodega Baddiee Cee · Baby' }, { name: 'Yotito', line: 'Yote · Baby' }] }),
    section('roster', 'Starter roster', { conceptArt: W02_COPY.conceptArt }, starters.flatMap((mon) => copyFields({ name: mon.babyName, bloodline: mon.bloodline, hatchesFrom: W02_COPY.index.hatchesFrom(mon.eggName), cardLabel: W02_COPY.index.cardLabel(mon.babyName) }, `cards.${mon.slot}`))),
    section('closing', 'Closing', { closing: W02_COPY.index.closing, cta: W02_COPY.index.cta }),
  ]);
  add(mons, 'hero', 'hero', hatchArt('100vw'));
  for (const mon of starters) {
    const images = monsArt(mon.slot);
    for (const kind of ['baby', 'egg', 'street'] as const) add(mons, 'roster', `starter.${mon.slot}.${kind}`, images[kind]);
  }
  const details = starters.map((mon) => {
    const display = (s: typeof mon) => ({ name: s.babyName, bloodline: s.bloodline, eggName: s.eggName, cultureNote: s.cultureNote ?? '' });
    const common = { ...W02_COPY.detail, conceptArt: W02_COPY.conceptArt, eyebrow: W02_COPY.detail.eyebrow(mon.bloodline), bloodlineBody: W02_COPY.detail.bloodlineBody(mon.bloodline), eggBody: W02_COPY.detail.eggBody(mon.eggName, mon.babyName) };
    const detail = makePage(mon.babyName, `/mons/${mon.slug}`, W02_COPY.meta.detailDescription(mon.babyName, mon.bloodline), [
      section('hero', 'Hero', common, copyFields(display(mon), `cards.${mon.slot}`)), section('skyline', 'Skyline divider'),
      section('dossier', 'Bloodline, egg and street', common, copyFields(display(mon), `cards.${mon.slot}`)),
      section('hatch', 'Hatch', common), section('others', 'Other starters', common, starters.filter((s) => s.key !== mon.key).flatMap((s) => copyFields(display(s), `cards.${s.slot}`))),
    ]);
    const images = monsArt(mon.slot);
    add(detail, 'hero', `starter.${mon.slot}.baby`, images.baby);
    add(detail, 'hero', `starter.${mon.slot}.egg`, images.egg);
    add(detail, 'dossier', `starter.${mon.slot}.egg`, images.egg);
    add(detail, 'dossier', `starter.${mon.slot}.street`, images.street);
    add(detail, 'hatch', 'hatch', hatchArt('100vw'));
    for (const other of starters.filter((s) => s.key !== mon.key)) add(detail, 'others', `starter.${other.slot}.baby`, monsArt(other.slot).baby);
    return detail;
  });

  const get = makePage('Get NYC-MON', '/get', W05_COPY.hero.body, [
    section('hero', 'Hero and waitlist', W05_COPY.hero, [...copyFields(W05_COPY.stores, 'stores'), ...copyFields(W05_COPY.form, 'form')]),
    section('features', 'Features and privacy', W05_COPY.bento),
  ]);
  add(get, 'hero', 'hatch-night', hatchNightArt('100vw'));
  for (const mon of starters) add(get, 'features', `egg.${mon.slot}`, eggArt(mon.slot));
  add(get, 'features', 'hlynk', hlynkArt('100vw'));

  const legal = ([['privacy', '/legal/privacy'], ['terms', '/legal/terms'], ['childrens', '/legal/childrens-privacy']] as const).map(([key, route]) => {
    const doc = LEGAL_COPY[key];
    return makePage(doc.title, route, doc.description, [section('masthead', 'Document heading', { title: doc.title, eyebrow: doc.eyebrow, updated: doc.updated, description: doc.description }), ...doc.sections.map((part) => section(part.id, part.title, part))]);
  });
  const chrome = makePage('Shared header and footer', '/site-chrome', 'Shared website navigation, logos and footer copy.', [section('header', 'Header and navigation', HEADER_DEFAULTS), section('footer', 'Footer and links', FOOTER_DEFAULTS)]);
  add(chrome, 'header', 'logo', BRAND_WORDMARK);
  add(chrome, 'footer', 'logo', BRAND_WORDMARK);
  const pages = [home, story, city, how, mons, ...details, get, ...legal, chrome];
  for (const entry of pages) {
    const used = new Set<string>();
    for (const s of entry.page.sections) {
      if (s.copy.length > 100) throw new Error(`Copy limit exceeded: ${entry.page.route} ${s.sectionKey}`);
      if (new Set(s.copy.map((row) => row.key)).size !== s.copy.length) throw new Error(`Duplicate copy field: ${entry.page.route} ${s.sectionKey}`);
    }
    for (const asset of entry.assets) {
      const key = `${asset.sectionKey}:${asset.slot}`;
      if (used.has(key) || !entry.page.sections.some((s) => s.sectionKey === asset.sectionKey)) throw new Error(`Invalid seed placement: ${entry.page.route} ${key}`);
      used.add(key);
    }
  }
  return { schemaVersion: 2, pages };
}
