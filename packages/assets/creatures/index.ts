/// <reference path='../photos/webp.d.ts' />
/**
 * Generated concept art of the three starter Baby forms, their eggs and the
 * hatch night scene (PS-028). Bundled WebP, never hotlinked. These are
 * stand-ins for final renders (PS-007): replace a file under a new name and
 * update the entry, and the slots that read it keep their layout.
 *
 * Canon gives the species and the v7 dossier traits (silhouette, fur colours,
 * egg skins); everything else in the pictures (pose, expression, setting,
 * light) is an art-direction choice, not canon.
 *
 * Source: Figma `generate_image`, model `gpt-image-2.5-sunburst`, generated
 * 2026-10-07. The model returned 960×1280 (3:4) and 1536×1024 (3:2); the 3:4
 * frames are cropped to 4:5 (960×1200). `blurDataURL` is a 20×25 (24×16 for
 * the wide frame) WebP of the same crop.
 */

import cornerEgg from './corner-egg.webp';
import hatchNight from './hatch-night.webp';
import kitteeCee from './kittee-cee.webp';
import metroEgg from './metro-egg.webp';
import prismEgg from './prism-egg.webp';
import squeaklet from './squeaklet.webp';
import yotito from './yotito.webp';

export type CreatureSource = string | number | { src: string; width: number; height: number };

/** Which canon record the art depicts. `scene` is the hatch night, which shows an egg but no particular one. */
export type CreatureArtKind = 'baby' | 'egg' | 'scene';

export interface CreatureArt {
  id: string;
  kind: CreatureArtKind;
  /** Roster v11.1 Dex number of the form shown (DECISIONS.md #9); absent for the scene. */
  dexId?: number;
  source: CreatureSource;
  /** Describes the picture for screen readers. No pronoun for a Mon (PS-005). */
  alt: string;
  width: number;
  height: number;
  blurDataURL: string;
  /** How the image was made, so a final render can replace it knowingly. */
  generatedWith: { tool: string; model: string; date: string };
}

const GENERATED = { tool: 'Figma generate_image', model: 'gpt-image-2.5-sunburst', date: '2026-10-07' } as const;

export const CREATURE_ART: readonly CreatureArt[] = [
  {
    id: 'squeaklet',
    kind: 'baby',
    dexId: 2,
    source: squeaklet,
    alt: 'Squeaklet, a young charcoal-furred rat Mon with big round pink ears and a long pink tail, sitting on a sunny Harlem brownstone stoop and grinning at the viewer',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRtIAAABXRUJQVlA4IMYAAADQBACdASoUABkAPu1ur1IppiQiqAgBMB2JQAHOC375WWhwaSIRBGBoB1k5sB3dgAD91q9U5se1Uv6HZrXvz522zbH/lDUdX+dvnn7B2/xV8YFNKq5gpyfkVeGeEyrepQCsziAuCyZMw/Emx/594aNfbJ3pUUZNfmsyFRSjNk3DxGw5IdyzjiRtMX23ge5/WBbIPfqTH1Otg6iN9Urfa/VaHzU9xjNpNqcUwZkwHee7WhMnvESI31VXgFH7i6dTjkMXTozAAAA=',
    generatedWith: GENERATED,
  },
  {
    id: 'kittee-cee',
    kind: 'baby',
    dexId: 9,
    source: kitteeCee,
    alt: 'Kittee Cee, a young calico cat Mon with big soft paws, sitting upright on a Harlem bodega step beside a fruit stand, chin raised and calm',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRuoAAABXRUJQVlA4IN4AAAAQBgCdASoUABkAPu1ur1IppiQiqAgBMB2JYgCdMswlvwy+6QHV09WaHfRFNTlC8qvf2w9e/qzsMgAA/robVM9yiQIjC+VHIMBj19Ac3Q3iUAn6N9qLrG+uklxtLLX0KQArD1qLy4Gjmz3Yn+BMiNPCmJ8fweJviaZWt6n0OXXIhzJsY9NDEzpxCi5l4oRpvRlZs4WjXX8NgEBGVsNW6GKasJLh57l6QJZ1oPGiPvu60VtkT+K/2OakCH7UHpCAl0c2pLqnqkSoGOTsIoinMy5MuiHcKIhZSqx3SIYgAAA=',
    generatedWith: GENERATED,
  },
  {
    id: 'yotito',
    kind: 'baby',
    dexId: 62,
    source: yotito,
    alt: 'Yotito, a young sandy-gray coyote Mon with tall pointed ears and big paws, standing on a Times Square sidewalk under bright screens and looking at the viewer',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRgABAABXRUJQVlA4IPQAAADwBQCdASoUABkAPu1qqFAppiOiqA1RMB2JaACdMs8+RTAOukRuAT8RhaMpSYZM0OMGnnTQ4hmVQADhH3kJrvbHtHUL3IIve4ZZNIhwSiCACTCtUpbcrt5JFAaHUqly2kr/yQk+x/fjQr0AKQc/gYeiF8g5D9fvZ8a8DNcwSEKPVrV3QKgtg3hMbKJnbx0yaHevxVb8EgVvfg5thBS4IoCTA/uDxxR0yfs/2VMYS0NbfFQhb3cP+pUr1ZyvaY9ZO7XxT4i8swgZyhVw6Yy5vxvZ1PKLNu9vkoSPcJH+a41BAKDh5fPllo49o8P7mIiKn5kJmAAA',
    generatedWith: GENERATED,
  },
  {
    id: 'metro-egg',
    kind: 'egg',
    dexId: 1,
    source: metroEgg,
    alt: 'The Metro Egg, a glossy red egg with white diagonal stripes and a small round gold inset, resting on a Harlem brownstone step',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRugAAABXRUJQVlA4INwAAACQBQCdASoUABkAPu1sq1EppaOiqAqpMB2JbACdM48OAbS4XFyAOOeKKkWd0x1Fyqz75Jc0AAD+xQuGVxFpGLxeaZ4nPAE+H6ZrJgNaz78vGRQb+eeK+HiyewReEhSa9g/RbqoKwkUDYpJNz68LclbT94QDmWB8CGfE1lrPdrFYP16EbaYeZdgkVy8eG7Yk5EWBPyo1OWiI3TMmiUVJfqUKBdiahKbgXBxklUTfQXhmaimgraUPX91aBNS7ScivQxLdl45EC7iO6hXlRn8hhn5KfoK5CHlpAvNjAAAA',
    generatedWith: GENERATED,
  },
  {
    id: 'corner-egg',
    kind: 'egg',
    dexId: 8,
    source: cornerEgg,
    alt: 'The Corner Egg, a glossy pink egg wrapped in a band of white fur with a tiny gold heart, resting on a bodega step',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRs4AAABXRUJQVlA4IMIAAABwBQCdASoUABkAPu1ur1IppiQiqAgBMB2JQBadtQI/4IopQBe7pkmYaDrPOPHeuikaD4wAAP6Ff+xRmz00YaBQl0vHX0iIGZ0FCb4HxTLtg1O63cBYmvRS9fZzjXCeAZUsImQPJiZuThO26GZmgxKOLaiUEGZamXVSoqvKfiJLQ6EBCtNG4+DTcNEnsw+6JceGtbUw/wGtG0u9xiZZpzCRFk/B8lQf0w8Km7U9YgP5+HpOxNMrjwIwdOHUjBqAeRQAAA==',
    generatedWith: GENERATED,
  },
  {
    id: 'prism-egg',
    kind: 'egg',
    dexId: 61,
    source: prismEgg,
    alt: 'The Prism Egg, a glossy black egg with painted red, orange and yellow flames and a clear crystal inset, resting on a ledge in Times Square',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRg4BAABXRUJQVlA4IAIBAAAwBgCdASoUABkAPu1oqk+ppiOiKA1RMB2JbACdMoSCntVsf4W4Ox8+cQCfifMIArnqZG/Of5RpkU0AAPZCi9W5YsIMBC6mGC5bwwncaUg/s9kFGBBYnrqMok+ULijkRGtmOD6+JAFPztCwIm73QsUptkyFxTP5FWBifOMDph07NR8baAh4T2puBny3YhgjFleKmDtlKs433ip8LqG/LUKI601yIH8x/z/0UJeTd/yr5w/7f1H3NnzQsB3ZjLd/vEZ1y/Xv2Sq8pHfs1CuzYaD3o2OFpQLbacqLwuOUpP25u26y3fVQBZwxv3UnmpMVviPUvAbmkLIX0sCWkzV18HeAAAA=',
    generatedWith: GENERATED,
  },
  {
    id: 'hatch-night',
    kind: 'scene',
    source: hatchNight,
    alt: 'Night on a Harlem stoop: an egg rests in an open metal case on the bottom step, a thin crack in its shell glowing orange, with a lit bridge and skyline blurred behind',
    width: 1536,
    height: 1024,
    blurDataURL:
      'data:image/webp;base64,UklGRmoAAABXRUJQVlA4IF4AAAAQAwCdASoYABAAPu1iqU2ppaQiMAgBMB2JZWfkTKATu8AA/vCI4dpDMXcWF9efCp4l9Lqebzvw8Vs6nlj5MDlbBH46qthL7PBqtx3e+EetuG8eIDVXmvXSwUf/RAAA',
    generatedWith: GENERATED,
  },
];

export function creatureArt(id: string): CreatureArt {
  const entry = CREATURE_ART.find((a) => a.id === id);
  if (!entry) throw new Error(`@acme/assets/creatures has no art "${id}"`);
  return entry;
}
