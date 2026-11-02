import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { platformIo } from '#cell-source-platform';
import { VD_CELL_MANIFEST } from './data/vd-cells-manifest.ts';

const app = fileURLToPath(new URL('../../../../', import.meta.url));
const mobile = path.resolve(app, '../../apps/mobile');
const require = createRequire(import.meta.url);
const expoMetro = require.resolve('expo/metro-config', { paths: [mobile] });
const { resolve } = require(require.resolve('metro-resolver', { paths: [path.dirname(expoMetro)] })) as {
  resolve(context: Record<string, unknown>, specifier: string, platform: string): { filePath: string };
};
const packageJson = JSON.parse(readFileSync(path.join(app, 'package.json'), 'utf8'));
const origin = fileURLToPath(new URL('./index.ts', import.meta.url));

function context(native: boolean) {
  return {
    originModulePath: origin, assetExts: new Set(['bin']), sourceExts: ['ts', 'tsx', 'js'],
    preferNativePlatform: native, mainFields: ['react-native', 'browser', 'main'],
    unstable_conditionNames: native ? ['require', 'react-native'] : ['require'],
    unstable_conditionsByPlatform: {}, unstable_enablePackageExports: true,
    getPackageForModule: () => ({ rootPath: app, packageJson }),
    getPackage: () => packageJson, redirectModulePath: (p: string) => p,
    fileSystemLookup(p: string) {
      try { return { exists: true, type: statSync(p).isDirectory() ? 'd' : 'f', realPath: realpathSync(p) }; }
      catch { return { exists: false }; }
    },
  };
}

test('installed Metro selects native hash/cache IO from the application package import', () => {
  const source = readFileSync(origin, 'utf8');
  assert.match(source, /from '#cell-source-platform'/);
  for (const platform of ['ios', 'android']) {
    assert.equal(resolve(context(true), '#cell-source-platform', platform).filePath,
      fileURLToPath(new URL('./platform.native.ts', import.meta.url)));
  }
  assert.equal(resolve(context(false), '#cell-source-platform', 'web').filePath,
    fileURLToPath(new URL('./platform.ts', import.meta.url)));
  // The old explicit extension resolves the generic file even on iOS.
  assert.equal(resolve(context(true), './platform.ts', 'ios').filePath,
    fileURLToPath(new URL('./platform.ts', import.meta.url)));
});

test('bundled cells implicated in physical load failures match their byte and hash pins', async () => {
  for (const key of ['lite/-1_1', 'lite/-1_-1'] as const) {
    const bytes = readFileSync(new URL(`../vd-port/blocks/data/${key}.bin`, import.meta.url));
    const pin = VD_CELL_MANIFEST.cells[key];
    assert.ok(pin);
    assert.equal(bytes.byteLength, pin.bytes);
    const sha = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha, pin.sha256);
    assert.equal(await platformIo().sha256Hex(bytes), sha, 'Node default condition retains WebCrypto IO');
  }
});
