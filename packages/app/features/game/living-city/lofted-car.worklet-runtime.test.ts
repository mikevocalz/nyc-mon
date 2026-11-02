// N8 (slop-grade-city §9) and the worklet-bundle check for the lofted fleet.
//
// The cars stayed boxes because the three.js CarGenerator binding was never verified on the worklet render runtime
// (vehicle-actor.ts header). This file loads the lofted modules the way that runtime would and builds a car there.
// The harness is the one render-runtime/game-render.worklet-runtime.test.ts uses: __RUNTIME_KIND is a worker
// runtime (3), the dev Turbo Module guard is installed, and react-native, uniwind, React, Expo and the React Native
// libraries resolve to a module that throws on evaluation. On top of that, every read of `document`, `window` or
// `localStorage` is recorded, and no read may come from app code.
//
// Node evidence only: Hermes on a device worklet runtime is not exercised here.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';

const FORBIDDEN = ['react-native', 'uniwind', 'react-native-reanimated', 'react-native-gesture-handler', 'react-native-webgpu', 'expo', 'expo-router', 'react'];

const hooks = `
const FORBIDDEN = ${JSON.stringify(FORBIDDEN)};
const forbidden = (s) => FORBIDDEN.some((name) => s === name || s.startsWith(name + '/'));
export async function resolve(specifier, context, next) {
  if (specifier === 'react-native-worklets') {
    return { url: 'data:text/javascript,' + encodeURIComponent('export const scheduleOnRN = (fn, ...args) => fn(...args);'), shortCircuit: true };
  }
  if (forbidden(specifier)) {
    const message = specifier + ' evaluated on a worklet runtime (imported from ' + (context.parentURL ?? '?') + ')';
    return { url: 'data:text/javascript,' + encodeURIComponent('throw new Error(' + JSON.stringify(message) + ');'), shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } });
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`);

const g = globalThis as Record<string, unknown>;
g.__RUNTIME_KIND = 3;
g.__fbBatchedBridgeConfig = new Proxy({}, {
  get() {
    throw new Error('[Worklets] Accessing __fbBatchedBridgeConfig is not allowed on Worklet Runtimes. Perhaps you tried to access a Turbo Module?');
  },
});
// Every read of a DOM global is recorded with the frame that made it. three's own `typeof window` and
// `typeof self` guards read them too, so the check is on where a read comes from: nothing under packages/app.
const domReads: { name: string; caller: string }[] = [];
const APP_DIR = new URL('../../../', import.meta.url).pathname;
for (const name of ['document', 'window', 'localStorage']) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      const frames = (new Error().stack ?? '').split('\n').slice(2);
      const caller = frames.find((f) => !f.includes('node:internal')) ?? '';
      domReads.push({ name, caller });
      return undefined;
    },
  });
}
const appDomReads = () => domReads.filter((r) => r.caller.includes(APP_DIR) && !r.caller.includes('worklet-runtime.test.ts'));

test('the harness records DOM reads and rejects react-native', async () => {
  const before = domReads.length;
  assert.equal(g.document, undefined);
  assert.equal(domReads.length, before + 1);
  assert.match(domReads.at(-1)!.caller, /worklet-runtime\.test\.ts/);
  const probe = `data:text/javascript,${encodeURIComponent("import 'react-native';")}`;
  await assert.rejects(import(probe), /react-native evaluated on a worklet runtime/);
});

test('the pure geometry module loads and builds every kind with no DOM', async () => {
  const geo = await import('./lofted-car.ts');
  for (const kind of ['sedan', 'taxi', 'van', 'bus'] as const) {
    const data = geo.buildVehicleGeometryData(kind);
    assert.ok(data.triangles > 4000, `${kind}: ${data.triangles} triangles`);
  }
  assert.deepEqual(appDomReads(), []);
});

test('the lofted actor graph loads without react-native and builds a lofted taxi on three/webgpu', async () => {
  const [{ createVehicleActor }, THREE] = await Promise.all([import('./vehicle-actor.ts'), import('three/webgpu')]);
  await import('./vehicle-headlights.ts');
  await import('./lofted-car-material.ts');
  await import('./vehicle-physical-constants.ts');
  const actor = createVehicleActor({ read: () => null, physical: true, vd: false, tier: 'phone' })(THREE);
  const group = actor.object as InstanceType<typeof THREE.Group>;
  const taxi = group.getObjectByName('living-city:vehicles:taxi:near') as InstanceType<typeof THREE.InstancedMesh>;
  assert.ok(taxi?.isInstancedMesh, 'a lofted taxi mesh exists');
  assert.ok((taxi.geometry.index?.count ?? 0) / 3 > 4000);
  actor.update({ delta: 1 / 60, time: 0, reducedMotion: false });
  actor.dispose();
  // The vd lane's baked bodies (vd-car-mesh.ts, vd-car-material.ts) load through the same graph.
  const vd = createVehicleActor({ read: () => null, physical: true, vd: true, tier: 'phone' })(THREE);
  // A plain Mesh over an InstancedBufferGeometry (world/vd-instanced.ts), not an InstancedMesh.
  const cab = (vd.object as InstanceType<typeof THREE.Group>).getObjectByName('living-city:vehicles:taxi:near-vd-taxinv200') as InstanceType<typeof THREE.Mesh>;
  assert.ok(cab?.isMesh && (cab.geometry as { isInstancedBufferGeometry?: boolean }).isInstancedBufferGeometry, 'the baked cab mesh exists');
  assert.ok((cab.geometry.index?.count ?? 0) / 3 > 4000);
  vd.update({ delta: 1 / 60, time: 0, reducedMotion: false });
  vd.dispose();
  assert.deepEqual(appDomReads(), [], 'no app module touched a DOM global');
});
