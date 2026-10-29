import assert from 'node:assert/strict';
import { test } from 'node:test';
import { glbFraction, glbProgressStore, readWithProgress, reportGlbProgress } from './load-progress.ts';

function streamed(chunks: readonly Uint8Array[], length: number | null): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  return new Response(body, { headers: length === null ? {} : { 'content-length': String(length) } });
}

test('a streamed body reports each chunk against Content-Length and joins the bytes in order', async () => {
  const seen: [number, number | null][] = [];
  const buffer = await readWithProgress(streamed([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])], 5), (l, t) => seen.push([l, t]));
  assert.deepEqual([...new Uint8Array(buffer)], [1, 2, 3, 4, 5]);
  assert.deepEqual(seen, [[0, 5], [2, 5], [5, 5]]);
});

test('no Content-Length stays indeterminate until done', async () => {
  const seen: (number | null)[] = [];
  await readWithProgress(streamed([new Uint8Array([9])], null), (_l, t) => seen.push(t));
  assert.ok(seen.every((t) => t === null));
  assert.equal(glbFraction({ loaded: 1, total: null, done: false }), undefined);
});

test('glbFraction: known size gives 0..1, done is 1, unknown key is undefined', () => {
  reportGlbProgress('baby', { loaded: 13, total: 26, done: false });
  assert.equal(glbFraction(glbProgressStore.getState().baby), 0.5);
  reportGlbProgress('baby', { loaded: 26, total: 26, done: true });
  assert.equal(glbFraction(glbProgressStore.getState().baby), 1);
  assert.equal(glbFraction(glbProgressStore.getState().other), undefined);
});
