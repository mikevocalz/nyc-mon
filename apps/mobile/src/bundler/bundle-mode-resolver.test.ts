// Worklet render mode (EXPO_PUBLIC_WORKLET_RENDER=1) composes three resolvers
// in metro.config.js: Expo's, worklets Bundle Mode's (react-native -> its
// shim) and Uniwind's (react-native -> uniwind/components, outermost).
//
// Unpatched, the shim's `require('react-native')` went through Uniwind and
// came back as uniwind/components, whose own react-native import is the shim:
// a require cycle in which uniwind/components/native/Image read `Image` off a
// half-initialised module and crashed at startup in copyComponentProperties
// (docs/implementation/worklet-rendering.md, "Device result, 2026-10-16").
// patches/react-native-worklets@0.13.0.patch (upstream PR
// software-mansion/react-native-reanimated#10751) gives the shim its own
// specifier that only Bundle Mode resolves. patches/metro@0.87.1.patch is the
// worklets-documented fix for "Failed to get the SHA-1" on .worklets files.
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const appRequire = createRequire(join(appRoot, 'package.json'));
const REAL_RN = 'react-native-worklets/bundleMode/realReactNative';

type Resolution = { type: string; filePath: string };
type Context = { originModulePath: string; resolveRequest: (c: Context, name: string, platform: string) => Resolution };

// Stand-in for Metro's default resolver: node resolution, react-native
// condition for uniwind's component entry points.
function baseResolve(context: Context, name: string): Resolution {
  const from = dirname(context.originModulePath);
  const local = createRequire(join(from, 'noop.js'));
  if (name === 'uniwind/components' || name.startsWith('uniwind/components/')) {
    const root = dirname(realpathSync(local.resolve('uniwind/package.json')));
    const file = name === 'uniwind/components' ? 'src/components/index.ts' : `src/components/native/${name.split('/').pop()}.tsx`;
    return { type: 'sourceFile', filePath: join(root, file) };
  }
  return { type: 'sourceFile', filePath: realpathSync(local.resolve(name)) };
}

function loadConfig(flag: string | undefined) {
  const previous = process.env.EXPO_PUBLIC_WORKLET_RENDER;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_WORKLET_RENDER;
  else process.env.EXPO_PUBLIC_WORKLET_RENDER = flag;
  const configPath = appRequire.resolve('./metro.config.js');
  delete appRequire.cache[configPath];
  try {
    return appRequire(configPath) as {
      resolver: { resolveRequest: (c: Context, name: string, platform: string) => Resolution };
      server: { rewriteRequestUrl: (url: string) => string };
    };
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_WORKLET_RENDER;
    else process.env.EXPO_PUBLIC_WORKLET_RENDER = previous;
  }
}

const workletsRoot = dirname(realpathSync(appRequire.resolve('react-native-worklets/package.json')));
const shimPath = join(workletsRoot, 'bundleMode', 'shims', 'reactNativeShim.js');
const uniwindImage = join(dirname(realpathSync(appRequire.resolve('uniwind/package.json'))), 'src', 'components', 'native', 'Image.tsx');
const reactNativeIndex = realpathSync(appRequire.resolve('react-native'));

test('the Bundle Mode shim requires react-native through its own specifier', () => {
  const shim = readFileSync(shimPath, 'utf8');
  assert.match(shim, /require\('react-native-worklets\/bundleMode\/realReactNative'\)/);
  assert.doesNotMatch(shim, /require\('react-native'\)/);
});

test('in worklet mode the shim reaches the real react-native, not uniwind/components', () => {
  const { resolver } = loadConfig('1');
  const resolve = (origin: string, name: string) => resolver.resolveRequest({ originModulePath: origin, resolveRequest: baseResolve }, name, 'android').filePath;
  // Uniwind's own react-native import goes to the shim (Bundle Mode's resolver)...
  assert.equal(resolve(uniwindImage, 'react-native'), shimPath);
  // ...and the shim's import lands on react-native itself, which ends the chain.
  assert.equal(resolve(shimPath, REAL_RN), reactNativeIndex);
  // App code still gets Uniwind's className-aware components.
  assert.match(resolve(join(appRoot, 'index.js'), 'react-native'), /uniwind\/src\/components\/index\.ts$/);
});

test('with the flag unset the resolver chain is unchanged', () => {
  const { resolver } = loadConfig(undefined);
  const resolve = (origin: string, name: string) => resolver.resolveRequest({ originModulePath: origin, resolveRequest: baseResolve }, name, 'android').filePath;
  assert.equal(resolve(uniwindImage, 'react-native'), reactNativeIndex);
  assert.match(resolve(join(appRoot, 'index.js'), 'react-native'), /uniwind\/src\/components\/index\.ts$/);
});

test('the Metro that Expo runs skips the file map for .worklets files, only under the flag', () => {
  const expoRoot = dirname(realpathSync(appRequire.resolve('expo/package.json')));
  const cliRoot = dirname(realpathSync(createRequire(join(expoRoot, 'package.json')).resolve('@expo/cli/package.json')));
  const metroRoot = dirname(realpathSync(createRequire(join(cliRoot, 'package.json')).resolve('metro/package.json')));
  const graph = readFileSync(join(metroRoot, 'src', 'node-haste', 'DependencyGraph.js'), 'utf8');
  assert.match(graph, /if \(workletsBundleMode && mixedPath\.includes\(workletsDirPath\)\)/, `unpatched Metro at ${metroRoot}`);
  // Off unless the worklet render flag is set for the Metro process.
  assert.match(graph, /const workletsBundleMode = \/\^\(1\|true\|worklet\)\$\/i\.test\(/);
});

// The dev client's bundle URL, as the Expo manifest served it on 2026-10-16.
const DEV_BUNDLE_URL =
  'http://127.0.0.1:8081/apps/mobile/index.bundle?platform=android&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable';

test('in worklet mode Metro serves eager bundles, so import() targets reach worklet runtimes', () => {
  // Worklet runtimes evaluate only the bundle the app downloaded. With lazy=true
  // the render host (an import() in render-thread-choice.ts) and its worklets
  // sit in a chunk only the RN runtime fetches: "Unable to resolve worklet with hash".
  const { server } = loadConfig('1');
  const rewritten = server.rewriteRequestUrl(DEV_BUNDLE_URL);
  assert.equal(rewritten, DEV_BUNDLE_URL.replace('lazy=true', 'lazy=false'));
  assert.equal(server.rewriteRequestUrl('/index.bundle?lazy=true'), '/index.bundle?lazy=false');
  assert.equal(server.rewriteRequestUrl('/index.bundle?platform=android&lazy=false'), '/index.bundle?platform=android&lazy=false');
});

test('with the flag unset bundle URLs keep lazy=true', () => {
  const { server } = loadConfig(undefined);
  assert.equal(server.rewriteRequestUrl(DEV_BUNDLE_URL), DEV_BUNDLE_URL);
});
