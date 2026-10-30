import { MODEL_COPY } from '../mons/model-copy';
import { copyRows } from '@acme/content/site-content-bindings';
import { record } from '@acme/content/site-content';
import { DISTRICT_COPY } from '@acme/spatial/copy';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';
import { buildHomeSeed } from '../home/cms-seed';
import { W01_COPY } from '../home/copy';
import { STORY_COPY } from '../story/copy';
import { STORY_ART } from '../story/art';
import { W03_COPY } from '../city/copy';
import { cityPhoto, CITY_PHOTO_DISTRICTS } from '../city/art';
import { W04_COPY } from '../how-it-works/copy';
import { babyArt, eggArt, hatchNightArt, hlynkArt, photoArt } from '../how-it-works/art';
import { W05_COPY } from '../get/copy';
import { W02_COPY } from '../mons/copy';
import { hatchArt, monsArt } from '../mons/art';
import { monsStarters } from '../mons/starters';
import { starterBloodlines } from '@acme/content';
import { FOOTER_DESCRIPTION, FOOTER_GROUPS, NAV_CTA, navItems } from '../site/nav';
import type { ArtEntry } from '../home/art';
import type { RouteArt } from '../how-it-works/art';

export interface SeedSection { sectionKey: string; label: string; hidden: false; copy: ReturnType<typeof copyRows>; content: [] }
export interface SeedAsset { sectionKey: string; slot: string; source: string; alt: string; decorative: boolean; width: number; height: number; focalX: number; focalY: number; caption: string }
export interface SeedDocument { page: { title: string; route: string; _status: 'draft'; seo: {title: string; description: string}; sections: SeedSection[] }; assets: SeedAsset[] }
const section = (sectionKey: string, label: string, value: unknown = {}): SeedSection => ({sectionKey, label, hidden: false, copy: copyRows(value), content: []});
const document = (route: string, title: string, description: string, sections: SeedSection[]): SeedDocument => ({page: {route, title, _status: 'draft', seo: {title: `NYC-MON | ${title}`, description}, sections}, assets: []});
/** One seed image, or none for a slot whose art does not exist yet (a Coming Soon Baby). */
function asset(origin: string, sectionKey: string, slot: string, image: ArtEntry | RouteArt | null): SeedAsset[] {
  if (image === null) return [];
  const src = typeof image.src === 'object' ? image.src.src : String(image.src);
  const entry = image as ArtEntry; const route = image as RouteArt;
  const caption = entry.caption ?? route.place;
  return [{sectionKey, slot, source: new URL(src, origin).href, alt: image.alt, decorative: Boolean(entry.decorative), width: image.width, height: image.height,
    focalX: entry.focalPoint?.x ?? (route.position ? Number.parseFloat(route.position.left)/100 : .5),
    focalY: entry.focalPoint?.y ?? (route.position ? Number.parseFloat(route.position.top)/100 : .5),
    caption: caption ? image.district ? W01_COPY.placeCaption(image.district, caption.place) : caption.title : ''}];
}
const STARTER_SLOTS = starterBloodlines.map(({ slot }) => slot);

/** All seed words and bytes come from the shipped site. The importer never changes an existing page. */
export function buildSiteSeed(origin: string) {
  const home = buildHomeSeed(origin);
  const pages: SeedDocument[] = [home as unknown as SeedDocument];
  const story = document('/story', 'The Story', STORY_COPY.hero.body, [
    section('hero', 'Hero', STORY_COPY.hero), section('skyline', 'Skyline divider'),
    section('clean-city', 'A clean city', STORY_COPY.cleanCity), section('project-zero', 'Project Zero', STORY_COPY.projectZero), section('sunset', 'Sunset photograph'),
    section('vale', 'Vale', STORY_COPY.vale), section('extinction', 'Extinction', STORY_COPY.extinction), section('cascade', 'Cascade', STORY_COPY.cascade),
    section('returned', 'Returned', STORY_COPY.returned), section('enginex', 'EngineX', STORY_COPY.enginex), section('footer', 'Closing section', STORY_COPY.footer),
  ]);
  for (const [slot, image] of Object.entries(STORY_ART)) story.assets.push(...asset(origin, ({cleanCity: 'clean-city', rooftops: 'cascade', water: 'cascade'} as Record<string,string>)[slot] ?? slot, slot.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), image));
  pages.push(story);
  const city = document('/city', 'The City', W03_COPY.districts.body, [section('districts', 'Districts', {...W03_COPY.districts, districts: DISTRICT_COPY}), section('grid', 'Street grid'), section('cast', 'People of the city', W03_COPY.cast)]);
  for (const district of CITY_PHOTO_DISTRICTS) { const image = cityPhoto(district)!; city.assets.push(...asset(origin, 'districts', district, {...image, src: image.source, caption: {title: image.title, place: image.place}})); }
  pages.push(city);
  const keys = ['meet','name','incubate','hatch','care'];
  const how = document('/how-it-works', 'How it works', W04_COPY.loop.body, [
    section('hero', 'Hero', W04_COPY.loop), section('journey', 'Journey layout'),
    ...keys.map((key, i) => section(key, W04_COPY.loop.steps[i]!.verb, {step: W04_COPY.loop.steps[i],
      ...(key === 'name' ? W04_COPY.hlynk : key === 'incubate' ? W04_COPY.incubation : key === 'hatch' ? {closing: W04_COPY.hatchClosing} : key === 'care' ? W04_COPY.care : {})})),
    section('city', 'The city', W04_COPY.city), section('cta', 'Waitlist call to action', W04_COPY.cta),
  ]);
  const addHow = (key: string, slot: string, image: RouteArt | null) => how.assets.push(...asset(origin, key, slot, image));
  addHow('hero', 'egg.1', eggArt(1)); addHow('hero', 'baby.1', babyArt(1, '100vw')); addHow('hero', 'hlynk', hlynkArt('100vw'));
  for (const slot of STARTER_SLOTS) { addHow('meet', `egg.${slot}`, eggArt(slot)); addHow('hatch', `baby.${slot}`, babyArt(slot, '100vw')); }
  addHow('name', 'hlynk', hlynkArt('100vw')); addHow('incubate','hatch',hatchNightArt('100vw')); addHow('care','baby',babyArt(2,'100vw'));
  addHow('city','bridge',photoArt('megacity-brooklyn-bridge-night','100vw',{left:'50%',top:'55%'})); addHow('cta','egg.3',eggArt(3)); pages.push(how);
  const get = document('/get','Get NYC-MON',W05_COPY.hero.body,[section('hero','Hero and waitlist form',{...W05_COPY.hero, form:W05_COPY.form, stores:W05_COPY.stores}),section('bento','Features',W05_COPY.bento)]);
  get.assets.push(...asset(origin,'hero','hatch',hatchNightArt('100vw')),...asset(origin,'bento','hlynk',hlynkArt('100vw')));
  for(const slot of STARTER_SLOTS) get.assets.push(...asset(origin,'bento',`egg.${slot}`,eggArt(slot))); pages.push(get);
  const starters=monsStarters();
  const index=document('/mons','The Mons',W02_COPY.meta.indexDescription,[section('hero','Hero',W02_COPY.index),section('skyline','Skyline divider'),section('models','3D Mon previews', MODEL_COPY),section('roster','Starter roster',{...W02_COPY.index,cards:Object.fromEntries(starters.map(mon=>[mon.slot,mon]))}),section('closing','Closing section',{title:W02_COPY.index.closing,cta:W02_COPY.index.cta})]);
  index.assets.push(...asset(origin,'hero','hatch',hatchArt('100vw')));
  for(const mon of starters) { const art=monsArt(mon.slot); for(const key of ['baby','egg','street'] as const) index.assets.push(...asset(origin,'roster',`starter.${mon.slot}.${key}`,art[key])); }
  pages.push(index);
  for(const mon of starters) {
    const detail=document(`/mons/${mon.slug}`,mon.babyName,W02_COPY.meta.detailDescription(mon.babyName,mon.bloodline),[
      section('hero','Mon introduction',{...W02_COPY.detail, mon}), section('skyline','Skyline divider'),
      section('dossier','Egg and Bloodline',{...W02_COPY.detail,blurb:W02_COPY.detail.blurb[mon.slug]??'',line:mon.line,cultureNote:mon.cultureNote??''}),
      section('hatch','Hatch',W02_COPY.detail),section('others','Other Mons',{...W02_COPY.detail,...W02_COPY.index}),
    ]);
    const art=monsArt(mon.slot); detail.assets.push(...asset(origin,'hero',`starter.${mon.slot}.baby`,art.baby),...asset(origin,'dossier',`starter.${mon.slot}.egg`,art.egg),...asset(origin,'dossier',`starter.${mon.slot}.street`,art.street),...asset(origin,'hatch','hatch',hatchArt('100vw')));
    for(const other of starters.filter(other=>other.slot!==mon.slot)) detail.assets.push(...asset(origin,'others',`starter.${other.slot}.baby`,monsArt(other.slot).baby)); pages.push(detail);
  }
  for(const [key,route] of [['privacy','privacy'],['terms','terms'],['childrens','childrens-privacy']] as const) { const doc=LEGAL_COPY[key]; pages.push(document(`/legal/${route}`,doc.title,doc.description,[section('hero','Document heading',{title:doc.title,eyebrow:doc.eyebrow,updated:doc.updated}),...doc.sections.map(row=>section(row.id,row.title,row))])); }
  pages.push(document('/website-shell','Shared header and footer','Shared navigation and brand settings.',[
    section('header','Site header',{links:navItems('/'),cta:NAV_CTA}),section('footer','Site footer',{description:FOOTER_DESCRIPTION,tagline:'Every block has a legend.',copyright:'© NYC-MON',logoHref:'/',groups:FOOTER_GROUPS}),
  ]));
  for (const doc of pages.filter(doc => doc.page.route === '/mons' || doc.page.route.startsWith('/mons/'))) doc.page.sections.push(section('captions', 'Image captions and Dex labels', {conceptArt: W02_COPY.conceptArt, dex: W02_COPY.index.dex}));
  // Detect drift before any importer is allowed to write.
  for(const {page,assets} of pages) {
    if(page.sections.some(section=>section.copy.length>100)) throw new Error(`Too many copy fields in ${page.route}`);
    if(assets.some(asset=>!page.sections.some(section=>section.sectionKey===asset.sectionKey))) throw new Error(`Unmapped image on ${page.route}`);
    for(const row of page.sections) if(!record(row)) throw new Error('Invalid seed section');
  }
  return {schemaVersion:2, pages};
}
