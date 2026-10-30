/// <reference path='../photos/webp.d.ts' />
/**
 * Concept art of the four starter Baby forms, the starter eggs and the hatch night scene (PS-028). Bundled WebP, never hotlinked. These are
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
 *
 * The Signal Egg is the creator's own art (2026-10-30), 1312×1199, kept as
 * source/signal-egg.png: a cream egg with black and red-ringed dots on a
 * brownstone sidewalk. Cropped to 4:5 at full height (x 171-1130, centred on
 * the egg), scaled to 960×1200, cwebp -q 72 -m 6. It replaces the polka-dot
 * reference still; that reference stays at eggs/signal-egg/source/reference-front.png
 * for the hatch manifest.
 *
 * Fye Dot is the creator's own art (2026-10-30), 1536×1024 (3:2), kept as
 * source/fye-dot.png. The frame is cropped to 4:5 at full height (x 311-1130,
 * centred on the Mon), scaled to 960×1200 and encoded with cwebp -q 80 -m 6.
 *
 * Lil' Ratti is another exception: a render of apps/web/public/mons/lil-ratti.glb
 * (three.js, `up_idle` at 0.4 s, front three-quarter, transparent background)
 * at 960×1200, so the 34 MB model is never needed where one picture will do.
 */

import cornerEgg from './corner-egg.webp';
import fyeDot from './fye-dot.webp';
import hatchNight from './hatch-night.webp';
import kitteeCee from './kittee-cee.webp';
import lilRatti from './lil-ratti.webp';
import metroEgg from './metro-egg.webp';
import prismEgg from './prism-egg.webp';
import signalEgg from './signal-egg.webp';
import squeaklet from './squeaklet.webp';
import yotito from './yotito.webp';

export type CreatureSource = string | number | { src: string; width: number; height: number };

/** Which canon record the art depicts. `scene` is the hatch night, which shows an egg but no particular one. */
export type CreatureArtKind = 'baby' | 'small' | 'egg' | 'scene';

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
const CREATOR_SIGNAL_EGG = { tool: 'creator art, cropped to 4:5', model: 'creatures/source/signal-egg.png', date: '2026-10-30' } as const;
const CREATOR_FYE_DOT = { tool: 'creator art, cropped to 4:5', model: 'creatures/source/fye-dot.png', date: '2026-10-30' } as const;
const RENDERED_LIL_RATTI = { tool: 'three.js render of lil-ratti.glb', model: 'lil-ratti.glb up_idle', date: '2026-10-23' } as const;

export const CREATURE_ART: readonly CreatureArt[] = [
  {
    id: 'squeaklet',
    kind: 'baby',
    dexId: 2,
    source: squeaklet,
    alt: 'Squeaklet, a charcoal-furred rat Mon with pink ears and tail, sitting on a sunny Harlem brownstone stoop.',
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
    alt: 'Kittee Cee, a calico cat Mon with soft paws, sitting on a Harlem bodega step beside a fruit stand.',
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
    alt: 'Yotito, a sandy-gray coyote Mon with tall ears and big paws, standing on a bright Times Square sidewalk.',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRgABAABXRUJQVlA4IPQAAADwBQCdASoUABkAPu1qqFAppiOiqA1RMB2JaACdMs8+RTAOukRuAT8RhaMpSYZM0OMGnnTQ4hmVQADhH3kJrvbHtHUL3IIve4ZZNIhwSiCACTCtUpbcrt5JFAaHUqly2kr/yQk+x/fjQr0AKQc/gYeiF8g5D9fvZ8a8DNcwSEKPVrV3QKgtg3hMbKJnbx0yaHevxVb8EgVvfg5thBS4IoCTA/uDxxR0yfs/2VMYS0NbfFQhb3cP+pUr1ZyvaY9ZO7XxT4i8swgZyhVw6Yy5vxvZ1PKLNu9vkoSPcJH+a41BAKDh5fPllo49o8P7mIiKn5kJmAAA',
    generatedWith: GENERATED,
  },
  {
    id: 'fye-dot',
    kind: 'baby',
    dexId: 21,
    source: fyeDot,
    alt: 'Fye Dot, a glossy black hopper Mon with white polka dots and black-and-white striped antennae, crouched on a sunny brownstone stoop.',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRjABAABXRUJQVlA4ICQBAABwBgCdASoUABkAPtFgqE+oJSOiKAgBABoJYgCdOUFUvjQUwDwAxb47tPmYlQOEOly/FJZ6tFlRWjVP6QwA+/yO6JI7DVOaxWlAtvsgyYiicgQDS+tZ6UMTCOnHdAUl10mYKinKr9VZ79f/D8emgfPr0Mmix9L/heBs23cpUjatj9jmhcWnZBSwHp+vR5KZ0bmLRzDVGwv908ClDeJag0F/MI8EP4F5CmRdkCV8wQaYeRnFWJmIIey4xGL1a2i1TY46wsnTtlvg6ksGJ7DT+Fcn4gW7amwheOv/7KT46BBC653KPTM4WA2K6/1pmx9XunUvwEuIbfZEcgdWqSFGSBXhdRQ+2NsYQGxVX3FCVnhkh4KkFv113d0p3bP49AeRsFQiAAAA',
    generatedWith: CREATOR_FYE_DOT,
  },
  {
    id: 'lil-ratti',
    kind: 'small',
    dexId: 3,
    source: lilRatti,
    alt: 'Lil’ Ratti, a charcoal rat Mon with big pink ears, in a red hoodie, black shorts and red high-tops.',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRrABAABXRUJQVlA4WAoAAAAQAAAAEwAAGAAAQUxQSMoAAAABgKtt//nl81e2jdnY3O6aeABdzY3/Ldfkdts2J9vGAdh445tOICImQP6lfVIgF7oRogi8BDKoThzVrQK402W28fmLETP+RZV8rTYMvvtQGKFi9Bxqn3BVrCusSk+VAjzejlAiMgUAA9/wwMdbW8pw5MMZ0qkgPAN4wTTVVlEOYGGmnZoumAZw03tOxV4Dj4A2gRKz2a340StD4a0OWhQB8OAUWtxIKjqolD4ArvFoZtxegIfTgFwsMhIY7asW2QPcmc/D02KU3yMBVlA4IMAAAADQBACdASoUABkAPtFYpEyoJSOiKA1RABoJbAC93BUCIeC8uYWxS+pI5Z0HX2NGoAD+y1fz30twXdehxreVebZxZ0761PA7vfpOVIczEyMisnOcqR51kcc3fSPEuyh1J576rrtwfzevwoj9aYBEV0+pwwm7PsGNB/8nkDTR/V8v/mYRRMraE8mE1s3aML0wz/f9dZ0pV1Fv6wQEpfNza+eZIMO+hfMJM31pEa38P/BMdn1/S4qxHjL8MVCsf9apkAA=',
    generatedWith: RENDERED_LIL_RATTI,
  },
  {
    id: 'metro-egg',
    kind: 'egg',
    dexId: 1,
    source: metroEgg,
    alt: 'The Metro Egg, glossy red with white diagonal stripes and a gold inset, on a Harlem brownstone step.',
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
    alt: 'The Corner Egg, glossy pink with a white fur band and tiny gold heart, resting on a bodega step.',
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
    alt: 'The Prism Egg, glossy black with painted flames and a clear crystal inset, on a Times Square ledge.',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRg4BAABXRUJQVlA4IAIBAAAwBgCdASoUABkAPu1oqk+ppiOiKA1RMB2JbACdMoSCntVsf4W4Ox8+cQCfifMIArnqZG/Of5RpkU0AAPZCi9W5YsIMBC6mGC5bwwncaUg/s9kFGBBYnrqMok+ULijkRGtmOD6+JAFPztCwIm73QsUptkyFxTP5FWBifOMDph07NR8baAh4T2puBny3YhgjFleKmDtlKs433ip8LqG/LUKI601yIH8x/z/0UJeTd/yr5w/7f1H3NnzQsB3ZjLd/vEZ1y/Xv2Sq8pHfs1CuzYaD3o2OFpQLbacqLwuOUpP25u26y3fVQBZwxv3UnmpMVviPUvAbmkLIX0sCWkzV18HeAAAA=',
    generatedWith: GENERATED,
  },
  {
    id: 'signal-egg',
    kind: 'egg',
    dexId: 20,
    source: signalEgg,
    alt: 'The Signal Egg, a cream speckled egg covered in black dots and a few red-ringed dots, on a sunlit brownstone sidewalk.',
    width: 960,
    height: 1200,
    blurDataURL:
      'data:image/webp;base64,UklGRiABAABXRUJQVlA4IBQBAACwBQCdASoUABkAPtFepE6oJSMiKAqpABoJYgC06dwMXizmzu23iPcy3LGqSsIQfQPFo8fZkQAAzXcPkmKe47g3u27xhDPOiual5ptB3B7hZ0eotPSuiC0jbpmsE9WIuK/tcyaQ8nQ6GA0zmPRh2a11p0jtVQ9GXzuTkYAu1p2cNnXzc5JwbiPvUwFIIeqSB5J4V1tdtKDD30Lqn7D5f/kR7hZtYsqWDEoi3uCnq3T9oAfAlXefrhM3YtX0+Qsmkmp3tr7+0VMVl1/TL7awXNqHB4OPXMAsl7XsSO50KOSo5bB0Zza9Y1QfCMJtBbs6kd+Ivg687MBiKAIjTZ9rXGDFXaQklwxhym8JhRe8DT9SqFTYKAA=',
    generatedWith: CREATOR_SIGNAL_EGG,
  },
  {
    id: 'hatch-night',
    kind: 'scene',
    source: hatchNight,
    alt: 'Night on a Harlem stoop: an egg in an open metal case, a thin shell crack glowing orange against a blurred skyline.',
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
