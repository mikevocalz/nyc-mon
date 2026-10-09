/**
 * Builds the Mon views into single self-contained HTML files (MCP Apps: one
 * `text/html;profile=mcp-app` document per ui:// resource, no external URLs).
 * Run: `pnpm --filter @acme/mcp-server build:ui`.
 *
 * The Vite config is Storybook's own: apps/storybook/.storybook/main.ts
 * `viteFinal`, imported and called unmodified (react-native-web aliases,
 * web-first extensions, the worklets pre-transform, TypeGPU, plugin-react),
 * with apps/storybook/postcss.config.mjs (Tailwind v4). Two plugins are added: vite-plugin-singlefile 2.3.3 inlines the JS,
 * CSS and assets; `creatureArt` downsizes the creature WebPs with sharp 0.35.5
 * before they are inlined.
 *
 * Output: dist/ui/<view>.html plus dist/ui/manifest.json with each file's
 * content hash, which index.ts turns into the versioned ui:// URI.
 */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { build, type InlineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { UI_VIEWS, type UiViewId } from './views.ts';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..', '..');
const repoRoot = resolve(pkgRoot, '..', '..');
const storybookDir = join(repoRoot, 'apps', 'storybook');
const viewDir = join(here, 'view');
export const UI_DIST = join(pkgRoot, 'dist', 'ui');

/** 400×500 covers the room's art slot at the Echo Show zoom (about 260 base px × 1.667). */
const BABY_WIDTH = 400;

/**
 * Downsizes packages/assets/creatures/*.webp before singlefile inlines them.
 * The views draw only the three Baby stills; CREATURE_ART also imports the
 * eggs and the hatch scene, which the views never show, so those become
 * 16 px thumbnails rather than 100 KB each.
 */
function creatureArt(): Plugin {
  const creatures = join(repoRoot, 'packages', 'assets', 'creatures');
  const babies = new Set(['squeaklet', 'kittee-cee', 'yotito']);
  return {
    name: 'nyc-mon:creature-art',
    enforce: 'pre',
    async load(id) {
      const file = id.split('?')[0] ?? id;
      if (!file.startsWith(creatures) || !file.endsWith('.webp')) return null;
      const stem = file.slice(creatures.length + 1, -'.webp'.length);
      const width = babies.has(stem) ? BABY_WIDTH : 16;
      const buf = await sharp(file).resize({ width }).webp({ quality: 70, effort: 6 }).toBuffer();
      return `export default ${JSON.stringify(`data:image/webp;base64,${buf.toString('base64')}`)};`;
    },
  };
}

/** Storybook's `viteFinal`, exactly as `storybook build` applies it. */
async function storybookConfig(base: InlineConfig): Promise<InlineConfig> {
  const main = (await import(pathToFileURL(join(storybookDir, '.storybook', 'main.ts')).href)) as {
    default: { viteFinal: (config: InlineConfig, options: { configType: string }) => Promise<InlineConfig> };
  };
  return main.default.viteFinal(base, { configType: 'PRODUCTION' });
}

async function buildView(view: UiViewId): Promise<string> {
  // A fresh temp dir per build, so two builds (parallel test files) never share one.
  const outDir = await mkdtemp(join(tmpdir(), `nyc-mon-${view}-`));
  const base: InlineConfig = {
    configFile: false,
    root: viewDir,
    logLevel: 'warn',
    mode: 'production',
    plugins: [],
    css: { postcss: storybookDir },
    // The repo-root tsconfig extends `expo/tsconfig.base`, which pnpm does not
    // hoist to the root, so the transform reads this package's tsconfig instead.
    tsconfig: join(pkgRoot, 'tsconfig.json'),
    define: {
      __ENTRY__: JSON.stringify(view === 'mon-room' ? 'room' : 'card'),
      // The room carries the GridBand backdrop; the inline card does not.
      __GRID_BACKDROP__: JSON.stringify(view === 'mon-room'),
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir,
      emptyOutDir: true,
      reportCompressedSize: false,
    },
  };
  const config = await storybookConfig(base);
  config.plugins = [creatureArt(), ...(config.plugins ?? []), viteSingleFile({ removeViteModuleLoader: true })];
  // CanvasKit cannot load in the MCP Apps sandbox; swap its web loader for a
  // stand-in that never fetches (view/skia-web-sandbox.ts).
  const alias = config.resolve?.alias;
  config.resolve = {
    ...(config.resolve ?? {}),
    alias: [
      { find: /^react-native-skia\/lib\/module\/web$/, replacement: join(viewDir, 'skia-web-sandbox.ts') },
      ...(Array.isArray(alias) ? alias : Object.entries(alias ?? {}).map(([find, replacement]) => ({ find, replacement: String(replacement) }))),
    ],
  };
  // plugin-react picks the JSX runtime from NODE_ENV. Under vitest it is
  // 'test', which would emit jsxDEV calls the production React lacks.
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await build(config);
  } finally {
    process.env.NODE_ENV = previous;
  }
  const html = await readFile(join(outDir, 'index.html'), 'utf8');
  await rm(outDir, { recursive: true, force: true });
  return html.replace('%NYC_MON_TITLE%', UI_VIEWS[view].title);
}

export interface UiManifestEntry {
  readonly file: string;
  readonly hash: string;
  readonly bytes: number;
}

export async function buildUi(): Promise<Record<UiViewId, UiManifestEntry>> {
  await mkdir(UI_DIST, { recursive: true });
  const manifest = {} as Record<UiViewId, UiManifestEntry>;
  for (const view of Object.keys(UI_VIEWS) as UiViewId[]) {
    const html = await buildView(view);
    const hash = createHash('sha256').update(html).digest('hex').slice(0, 8);
    const file = `${view}.html`;
    await writeFile(join(UI_DIST, file), html);
    manifest[view] = { file, hash, bytes: Buffer.byteLength(html) };
  }
  await writeFile(join(UI_DIST, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = await buildUi();
  for (const [view, entry] of Object.entries(manifest)) {
    console.log(`${view}: ${entry.file} ${(entry.bytes / 1024).toFixed(1)} KiB #${entry.hash}`);
  }
}
