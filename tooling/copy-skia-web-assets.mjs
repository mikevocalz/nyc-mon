import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const targets = [
  ['apps/web/package.json', 'apps/web/public/canvaskit'],
  ['apps/storybook/package.json', 'apps/storybook/public/canvaskit'],
  ['apps/mobile/package.json', 'apps/mobile/public/canvaskit'],
  ['packages/web-sim/package.json', 'packages/web-sim/public/canvaskit'],
];

// Resolve canvaskit-wasm through react-native-skia (v3), so the copied
// CanvasKit is always the exact build Skia's web runtime was published with
// (canvaskit-wasm 0.41.0 for react-native-skia 3.0.2), never a stray copy an
// app happens to declare.
for (const [manifest, destination] of targets) {
  const appRequire = createRequire(join(root, manifest));
  let source;
  try {
    const skiaRequire = createRequire(appRequire.resolve('react-native-skia/package.json'));
    source = dirname(skiaRequire.resolve('canvaskit-wasm/bin/full/canvaskit.wasm'));
    await access(source);
  } catch {
    continue;
  }

  const target = join(root, destination);
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}
