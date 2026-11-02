import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// KTX2 (KHR_texture_basisu) transcode on web: the GLTFLoader sites attach a
// shared KTX2Loader (packages/ui/three/ktx2.ts) whose setTranscoderPath points
// at /basis/. Resolve the transcoder through @acme/ui's own three, so the
// copied files always match the KTX2Loader build the rigs load — the repo can
// carry more than one three version.
const uiRequire = createRequire(join(root, 'packages/ui/package.json'));

let source;
try {
  source = dirname(uiRequire.resolve('three/examples/jsm/libs/basis/basis_transcoder.wasm'));
  await access(join(source, 'basis_transcoder.js'));
} catch {
  // No three with a bundled transcoder here; nothing to copy.
  process.exit(0);
}

const targets = [
  'apps/web/public/basis',
  'apps/storybook/public/basis',
  'apps/admin-vite/public/basis',
  'apps/mobile/public/basis',
  'packages/web-sim/public/basis',
];

for (const destination of targets) {
  const target = join(root, destination);
  await mkdir(target, { recursive: true });
  await cp(join(source, 'basis_transcoder.js'), join(target, 'basis_transcoder.js'), { force: true });
  await cp(join(source, 'basis_transcoder.wasm'), join(target, 'basis_transcoder.wasm'), { force: true });
}
