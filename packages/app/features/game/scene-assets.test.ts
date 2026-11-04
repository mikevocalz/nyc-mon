import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregatePreparationAssets, awaitPreparationAssets } from './scene-preparation.ts';
import { createMaterialPageBank } from './world/vd-port/blocks/material-pages.ts';
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('START assets delay publication and final stream priming; future work is not implicitly awaited', async () => {
  const required = deferred<void>(), future = deferred<void>(); let primed = 0, returned = false;
  const prepared = { ready: aggregatePreparationAssets([required.promise]), finishAssets: () => { primed++; }, future: future.promise };
  const result = awaitPreparationAssets(prepared).then(value => { returned = true; return value; });
  await Promise.resolve(); assert.equal(returned, false); assert.equal(primed, 0);
  required.resolve(); assert.equal(await result, prepared); assert.equal(primed, 1); assert.equal(returned, true);
});

test('asset rejection propagates and disposes the owned scene rather than publishing a substitute', async () => {
  const required = deferred<void>(); let disposed = 0, primed = 0;
  const error = new Error('authored page hash failed');
  const result = awaitPreparationAssets({ ready: aggregatePreparationAssets([required.promise]), dispose: () => { disposed++; }, finishAssets: () => { primed++; } });
  required.reject(error); await assert.rejects(result, cause => cause === error); assert.equal(disposed, 1); assert.equal(primed, 0);
});

test('abort disposes immediately while an actual page bank owns and destroys a late page', async () => {
  const incoming = deferred<{ bytes: number; dispose(): void }>(); let pageDisposed = 0, sceneDisposed = 0, primed = 0;
  const bank = createMaterialPageBank({ limitBytes: 16, pages: [{ id: 'START', bytes: 16 }], load: () => incoming.promise });
  const lease = bank.lease(['START']); const readiness = lease.prefetch().then(landed => { if (!landed) throw new Error('page cancelled'); });
  const c = new AbortController(); const result = awaitPreparationAssets({ ready: aggregatePreparationAssets([readiness]), finishAssets: () => { primed++; }, dispose: () => { sceneDisposed++; bank.dispose(); } }, c.signal);
  await Promise.resolve(); c.abort(); await assert.rejects(result, { name: 'AbortError' });
  assert.equal(sceneDisposed, 1); assert.equal(bank.bytes, 0); assert.equal(primed, 0);
  incoming.resolve({ bytes: 16, dispose: () => { pageDisposed++; } });
  await readiness.catch(() => {}); assert.equal(pageDisposed, 1); assert.equal(primed, 0);
});

test('already-aborted ownership and failed final attachment are cleaned up exactly once', async () => {
  const c = new AbortController(); c.abort(); let disposed = 0;
  await assert.rejects(awaitPreparationAssets({ dispose: () => { disposed++; } }, c.signal), { name: 'AbortError' }); assert.equal(disposed, 1);
  await assert.rejects(awaitPreparationAssets({ finishAssets: () => { throw new Error('attach failed'); }, dispose: () => { disposed++; } }), /attach failed/); assert.equal(disposed, 2);
});

test('cancelled setup does not finish rejection until its active native compilation has drained',async()=>{
 const required=deferred<void>(),drain=deferred<void>(),abort=new AbortController();let closed=false,finished=false;
 const pending=awaitPreparationAssets({ready:required.promise,dispose(){closed=true;return drain.promise;}},abort.signal);
 void pending.catch(()=>{finished=true;});abort.abort();await Promise.resolve();await Promise.resolve();
 assert.equal(closed,true);assert.equal(finished,false);drain.resolve();await assert.rejects(pending,{name:'AbortError'});
});
