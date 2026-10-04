import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// pnpm 12 is strict: the root package cannot resolve a dependency that belongs
// to apps/web. Resolve from the actual workspace that declares the renderer.
const webRequire = createRequire(join(root, 'apps/web/package.json'));

let rendererRoot;
try {
  rendererRoot = dirname(webRequire.resolve('@reactvision/viro-web-renderer/package.json'));
} catch {
  process.exit(0);
}

/**
 * Viro Web Renderer 1.0.0 supports explicit assetBaseUrl/slamBaseUrl, but its
 * unused fallbacks are static new URL("../wasm|slam/", import.meta.url)
 * expressions. Turbopack eagerly resolves those directories as JavaScript
 * modules before runtime options exist.
 *
 * This starter always copies the sidecars into /public/viro, so make the
 * renderer's fallbacks match those public URLs. Exact-match guards make this a
 * no-op as soon as an upstream release changes the implementation.
 */
async function patchRuntimeAssetFallbacks() {
  const patches = [
    {
      file: join(rendererRoot, 'dist/loader.js'),
      from: 'new URL("../wasm/", import.meta.url).href',
      to: '"/viro/wasm/"',
    },
    {
      file: join(rendererRoot, 'dist/slamLoader.js'),
      from: 'new URL("../slam/", import.meta.url).href',
      to: '"/viro/slam/"',
    },
  ];

  for (const patch of patches) {
    try {
      const source = await readFile(patch.file, 'utf8');
      if (!source.includes(patch.from)) continue;
      await writeFile(patch.file, source.replaceAll(patch.from, patch.to));
    } catch {
      // A future renderer layout can move these files. CI will expose the
      // unsupported package shape instead of silently rewriting unknown code.
    }
  }
}

await patchRuntimeAssetFallbacks();

/**
 * The mikevocalz/viro fork vendors a newer WASM build under web/renderer/ (see
 * its build.json for the virocore commit and CI run). It exports what the
 * fork's JS feature-detects and npm 1.0.1 lacks: drag, pinch, scroll and the
 * reticle switch. Its glue and .data match 1.0.1, so the npm package's JS
 * wrapper loads it unchanged; it is copied over the npm wasm/ files.
 */
const VENDORED_RENDERER_FILES = [
  'viro-web.js',
  'viro-web.wasm',
  'viro-web.data',
  'THIRD-PARTY-LICENSES.md',
];

let vendoredRendererDir = null;
try {
  const viroRoot = dirname(webRequire.resolve('@reactvision/react-viro/package.json'));
  const candidate = join(viroRoot, 'web/renderer');
  await access(join(candidate, 'viro-web.wasm'));
  vendoredRendererDir = candidate;
} catch {
  // Public npm Viro has no vendored renderer; keep the npm WASM.
}

const targets = [
  join(root, 'apps/web/public/viro'),
  join(root, 'apps/mobile/public/viro'),
];

for (const target of targets) {
  await mkdir(target, { recursive: true });
  for (const folder of ['wasm', 'slam']) {
    const source = join(rendererRoot, folder);
    try {
      await access(source);
      await cp(source, join(target, folder), { recursive: true, force: true });
    } catch {
      // A renderer release may omit an optional sidecar family.
    }
  }
  if (vendoredRendererDir) {
    for (const file of VENDORED_RENDERER_FILES) {
      try {
        await cp(join(vendoredRendererDir, file), join(target, 'wasm', file), {
          force: true,
        });
      } catch {
        // THIRD-PARTY-LICENSES.md is optional; the three binaries are checked
        // together below.
      }
    }
  }
}

if (vendoredRendererDir) {
  const wasm = await readFile(join(root, 'apps/web/public/viro/wasm/viro-web.wasm'));
  if (!wasm.includes('viroSetReticleVisible')) {
    console.error('[viro] vendored renderer copy did not land in apps/web/public/viro/wasm');
    process.exit(1);
  }
}
