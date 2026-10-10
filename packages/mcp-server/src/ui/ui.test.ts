import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { brand, palette, semantic } from '@acme/theme';
// Read from the kit source file (as the views import kit files), so the test tracks it.
import { CARE_COLORS } from '../../../ui/care/care-colors.ts';
import { buildUi } from './build.ts';
import { careOutcomeText, spokenSummary, toMonViewModel } from './contract.ts';
import { getUiResources, mcpAppsRegistration, parseUiManifest, UI_MIME_TYPE, UI_TOOL_LINKS, type UiResource } from './index.ts';

/**
 * Budgets per view, measured 2026-10-08. The card is about 1398 KiB raw,
 * 475 KiB gzip: React, react-native-web and the kit pieces, the ext-apps App
 * runtime with zod (about 445 KiB), Tailwind's CSS, two WOFF2 fonts and three
 * Baby stills. The room adds the GridBand backdrop (GridFloor, the TypeGPU
 * scene and the CanvasKit loader glue, not the WASM): about 2270 KiB raw,
 * 722 KiB gzip. Alexa+ names no byte limit; it asks for one gzipped,
 * content-hashed bundle.
 */
const BUDGET: Readonly<Record<string, { raw: number; gzip: number }>> = {
  'mon-card': { raw: 1500 * 1024, gzip: 520 * 1024 },
  'mon-room': { raw: 2400 * 1024, gzip: 780 * 1024 },
};

/**
 * Absolute URLs that appear only as string constants in the bundled
 * libraries: XML namespaces (react-dom, react-native-svg), JSON-Schema
 * `$schema` ids (zod, @cfworker/json-schema), and documentation links inside
 * error and warning messages (React, Next image, Reanimated, Worklets,
 * TypeGPU and the WGSL spec, React Native Skia, rolldown's CJS shim,
 * Tailwind's licence banner). Nothing fetches them; the CSP declares no
 * network origin, so a host would block any fetch anyway.
 */
const IDENTIFIER_URL = [
  /^http:\/\/www\.w3\.org\//,
  /^https:\/\/www\.w3\.org\/TR\/WGSL\//,
  /^https:\/\/rolldown\.rs\/in-depth\//,
  /^https:\/\/github\.com\/software-mansion\/TypeGPU\/issues$/,
  /^https:\/\/shopify\.github\.io\/react-native-skia\/docs\//,
  /^https?:\/\/json-schema\.org\//,
  /^https:\/\/github\.com\/(cfworker|software-mansion\/react-native-reanimated)/,
  /^https:\/\/react\.dev\/errors\/$/,
  /^https:\/\/nextjs\.org\/docs\/messages\//,
  /^https:\/\/docs\.swmansion\.com\//,
  /^https:\/\/dev\.to\/li\/how-to-requestpermission/,
  /^https:\/\/tailwindcss\.com$/,
];

let resources: readonly UiResource[];

beforeAll(async () => {
  await buildUi();
  resources = getUiResources();
}, 300_000);

describe('built MCP App views', () => {
  it('builds both views with the MCP Apps MIME type, a hashed ui:// URI and the declared CSP', () => {
    expect(resources.map((r) => r.id)).toEqual(['mon-card', 'mon-room']);
    for (const r of resources) {
      expect(r.mimeType).toBe('text/html;profile=mcp-app');
      expect(r.mimeType).toBe(UI_MIME_TYPE);
      expect(r.uri).toMatch(new RegExp(`^ui://nyc-mon/${r.id}-[0-9a-f]{8}\\.html$`));
      expect(r.csp).toEqual({ connectDomains: [], resourceDomains: ['data:'] });
    }
  });

  it('is one HTML5 document with the required head', () => {
    for (const { html } of resources) {
      expect(html.startsWith('<!doctype html>')).toBe(true);
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
      expect(html).toMatch(/<title>NYC-MON [^<]+<\/title>/);
      expect(html).toContain('<div id="root"></div>');
      // Production JSX runtime: a dev build (jsxDEV) crashes against production React.
      expect(html).not.toContain('jsxDEV');
    }
  });

  it('is self-contained: loads nothing from the network', () => {
    for (const { html } of resources) {
      expect(html).not.toMatch(/<link\b/i);
      expect(html).not.toMatch(/<script[^>]+\bsrc=/i);
      expect(html).not.toMatch(/<img[^>]+\bsrc=["']?https?:/i);
      const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
      expect(css).not.toMatch(/@import/i);
      // Every url() in the CSS is a data: URI (the two WOFF2 fonts).
      const cssUrls = [...css.matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1] ?? '');
      expect(cssUrls.length).toBeGreaterThanOrEqual(2);
      expect(cssUrls.every((u) => u.startsWith('data:'))).toBe(true);
      expect(html).toMatch(/data:image\/webp;base64,/);
      const urls = new Set(html.match(/https?:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s"'`)<>\\]*/g) ?? []);
      const unexpected = [...urls].filter((u) => !IDENTIFIER_URL.some((re) => re.test(u)));
      expect(unexpected).toEqual([]);
    }
  });

  it('carries the grid backdrop in the room only', () => {
    expect(resources.find((r) => r.id === 'mon-card')!.html).not.toContain('Pause animation');
    expect(resources.find((r) => r.id === 'mon-room')!.html).toContain('Pause animation');
  });

  it('stays under the size budget', () => {
    for (const { id, html } of resources) {
      expect(Buffer.byteLength(html), `${id} raw bytes`).toBeLessThanOrEqual(BUDGET[id]!.raw);
      expect(gzipSync(html, { level: 9 }).byteLength, `${id} gzip bytes`).toBeLessThanOrEqual(BUDGET[id]!.gzip);
    }
  });

  it('registers both resources through the MCP Apps seam', async () => {
    const registered: { uri: string; config: { mimeType?: string }; read: () => Promise<unknown> }[] = [];
    const fakeServer = {
      registerResource: (_name: string, uri: string, config: { mimeType?: string }, read: () => Promise<unknown>) => {
        registered.push({ uri, config, read });
        return {};
      },
    };
    const reg = mcpAppsRegistration();
    reg.registerResources(fakeServer as never);
    expect(registered.map((r) => r.uri)).toEqual(resources.map((r) => r.uri));
    expect(registered.every((r) => r.config.mimeType === 'text/html;profile=mcp-app')).toBe(true);
    const read = (await registered[0]!.read()) as { contents: { mimeType: string; text: string; _meta: unknown }[] };
    expect(read.contents[0]?.text).toBe(resources[0]!.html);
    expect(read.contents[0]?._meta).toEqual({ ui: { csp: { connectDomains: [], resourceDomains: ['data:'] }, prefersBorder: false } });
    expect(Object.keys(reg.toolResourceUris).sort()).toEqual(['feed_mon', 'get_mon_status', 'play_with_mon', 'rest_mon', 'wake_mon']);
    expect(UI_TOOL_LINKS.get_mon_status).toBe('mon-card');
  });
});

describe('manifest', () => {
  it('rejects a manifest that does not match the build, naming the fix', () => {
    expect(() => parseUiManifest({ 'mon-card': { file: 'mon-card.html', hash: 'xyz', bytes: 1 } })).toThrow(/build:ui/);
    expect(() => parseUiManifest('not json')).toThrow(/does not match this build/);
    const ok = { file: 'mon-card.html', hash: '0123abcd', bytes: 10 };
    expect(parseUiManifest({ 'mon-card': ok, 'mon-room': { ...ok, file: 'mon-room.html' } })['mon-card'].hash).toBe('0123abcd');
  });
});

describe('server import path', () => {
  it('index.ts loads under plain Node (no bundler, no asset imports)', () => {
    const out = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', "const m = await import('./src/ui/index.ts'); console.log(typeof m.mcpAppsRegistration, typeof m.toMonViewModel);"],
      { cwd: join(dirname(fileURLToPath(import.meta.url)), '..', '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    expect(out.trim()).toBe('function function');
  });
});

describe('view model (adapter onto the companion models)', () => {
  const careView = { energy: 0.72, fullness: 0.31, social: 0.58, activity: 'awake', sluggish: false, wantsFood: true, lastFedAt: null };

  it("reads lane A's MonView and CareView and names the Mon as M13 does", () => {
    const vm = toMonViewModel({ mon: { monId: 'm1', name: null, speciesId: 'dex-002', stage: 'Baby' }, care: careView });
    expect(vm?.monInstanceId).toBe('m1');
    expect(vm?.name).toBe('Squeaklet');
    expect(vm?.identity.bloodlineLabel).toBe('Hood Ratti Bloodline');
    expect(vm?.identity.dexId).toBe(2);
    expect(vm?.status).toEqual({ text: 'Asking for food', tone: 'request' });
    expect(vm?.suggested).toBe('feed');
    expect(spokenSummary(vm!)).toBe('Squeaklet, Hood Ratti Bloodline. Asking for food.');
  });

  it('uses the nickname, reads asleep, and falls back to mood when there is no care', () => {
    const asleep = toMonViewModel({
      mon: { monId: 'm2', name: 'Biscuit', speciesId: 'dex-009', stage: 'Baby' },
      care: { ...careView, activity: 'asleep', wantsFood: false },
    });
    expect(asleep?.name).toBe('Biscuit');
    expect(asleep?.asleep).toBe(true);
    expect(asleep?.status?.text).toBe('Asleep');
    const moodOnly = toMonViewModel({ mon: { monId: 'm2', speciesId: 'dex-062' }, mood: 'needs-social' });
    expect(moodOnly?.care).toBeNull();
    expect(moodOnly?.status?.text).toBe('Wants to play');
    expect(toMonViewModel({})).toBeNull();
  });

  it('keeps journal rows of known kinds only', () => {
    const vm = toMonViewModel({
      mon: { monId: 'm1', speciesId: 'dex-002' },
      care: careView,
      journal: [{ at: 1, kind: 'hatched', first: true }, { at: 2, kind: 'not-a-kind' }, { at: 3, kind: 'fed', first: true }],
    });
    expect(vm?.journal.map((e) => e.kind)).toEqual(['hatched', 'fed']);
  });

  it('words care outcomes with the M14–M16 strings', () => {
    const vm = toMonViewModel({ mon: { monId: 'm2', name: 'Biscuit', speciesId: 'dex-009' }, care: { ...careView, fullness: 0.66 } })!;
    expect(careOutcomeText({ applied: true, effect: 'eaten' }, vm)).toBe('Biscuit finished eating. Fullness 66 percent.');
    expect(careOutcomeText({ applied: false, declinedBecause: 'asleep' }, vm)).toBe(
      'Biscuit is asleep. Food can wait until Biscuit wakes up.',
    );
    expect(careOutcomeText({ applied: true, effect: 'played' }, vm)).toBe('Biscuit had fun playing with you.');
  });
});

describe('contrast of the kit pieces as the views stack them (Alexa+: 4.5:1 text, 3:1 large text)', () => {
  type Rgb = [number, number, number];
  const parse = (hex: string): [number, number, number, number] => {
    const n = hex.replace('#', '');
    const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as Rgb;
    return [...c, n.length === 8 ? parseInt(n.slice(6, 8), 16) / 255 : 1];
  };
  const over = (top: string, bottom: string): string => {
    const [r, g, b, a] = parse(top);
    const [R, G, B] = parse(bottom);
    const mix = [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
    return `#${mix.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  };
  const lum = (hex: string) => {
    const [r, g, b] = parse(hex).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };

  // Card notch faces per starter tone and their on-face text (Card.tsx NOTCH_ON_INK / NOTCH_ON_WHITE).
  const faces = [
    { tone: 'orange', face: palette.orange[500], text: palette.ink[950] },
    { tone: 'royal', face: palette.royal[500], text: palette.white },
    { tone: 'leaf', face: palette.leaf[500], text: palette.ink[950] },
  ];

  for (const f of faces) {
    it(`${f.tone} notch: name and Bloodline text ≥ 4.5`, () => {
      expect(ratio(f.text, f.face)).toBeGreaterThanOrEqual(4.5);
    });
  }

  // The status chip and the rings sit on the page, beside the Card (MonView.tsx).
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: ring captions on the scrim-scene plate over the page ≥ 4.5`, () => {
      const plate = over(semantic['scrim-scene'][scheme], semantic.bg[scheme]);
      expect(ratio(semantic.text[scheme], plate)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${scheme}: status chip text on surface-sunken ≥ 4.5`, () => {
      expect(ratio(semantic['text-secondary'][scheme], semantic['surface-sunken'][scheme])).toBeGreaterThanOrEqual(4.5);
    });
    it(`${scheme}: ring fill against its track ≥ 3 (non-text)`, () => {
      const s = scheme === 'dark' ? 'night' : 'daylit';
      expect(ratio(CARE_COLORS.fill[s], CARE_COLORS.track[s])).toBeGreaterThanOrEqual(3);
    });
  }

  it('hlynk-care button label (silver-300 on signage black) ≥ 4.5', () => {
    expect(ratio(palette.silver[300], palette.signage.black)).toBeGreaterThanOrEqual(4.5);
  });

  it('the night ring fill against the night plate ≥ 3', () => {
    expect(ratio(brand.carolina, over(semantic['scrim-scene'].dark, palette.royal[500]))).toBeGreaterThanOrEqual(3);
  });
});
