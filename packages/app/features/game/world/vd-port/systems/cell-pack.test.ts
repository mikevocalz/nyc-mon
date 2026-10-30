// The shared VGC1 envelope: rejection paths plus the positionFrame contract every pack honours.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PACK_KIND, PACK_MAGIC, openPack, packString } from './cell-pack.ts';
import { readSystemCells } from './load-from-disk.test-support.ts';

function pack(kind: number, payload: Uint8Array, cx = 0, cz = 0): Uint8Array {
  const head = new DataView(new ArrayBuffer(30));
  for (let i = 0; i < 4; i++) head.setUint8(i, PACK_MAGIC.charCodeAt(i));
  head.setUint8(4, 1);
  head.setUint8(5, kind);
  head.setInt16(6, cx, true);
  head.setInt16(8, cz, true);
  head.setUint16(10, 0, true);
  head.setFloat64(12, cx * 128 + 64, true);
  head.setFloat64(20, cz * 128 + 64, true);
  head.setUint16(28, 0, true);
  const out = new Uint8Array(30 + payload.length);
  out.set(new Uint8Array(head.buffer), 0);
  out.set(payload, 30);
  return out;
}

describe('cell-pack envelope', () => {
  it('rejects a truncated pack, bad magic, a wrong version and a foreign kind', () => {
    assert.throws(() => openPack(new Uint8Array(12)), /envelope/);
    const bad = pack(1, new Uint8Array(0));
    bad[0] = 0x58;
    assert.throws(() => openPack(bad), /magic/);
    const old = pack(1, new Uint8Array(0));
    old[4] = 9;
    assert.throws(() => openPack(old), /version/);
    const foreign = pack(PACK_KIND.labels, new Uint8Array(0));
    assert.throws(() => openPack(foreign, PACK_KIND.colliders), /kind 5, expected 1/);
  });

  it('reads the head and frame of a real pack: kind, key and the cell centre', () => {
    const cells = readSystemCells('colliders');
    assert.ok(cells.size > 0, 'the emitters have run (tooling/city/vd-port/write-systems-manifest.mjs)');
    const [key, bytes] = [...cells.entries()][0]!;
    const { head } = openPack(bytes);
    const [cx, cz] = key.split('_').map(Number) as [number, number];
    assert.equal(head.kind, PACK_KIND.colliders);
    assert.equal(head.cx, cx);
    assert.equal(head.cz, cz);
    assert.equal(head.key, key);
    assert.equal(head.positionFrame.x, cx * 128 + 64);
    assert.equal(head.positionFrame.z, cz * 128 + 64);
  });

  it('decodes the string table and honours the 0xffff absent marker', () => {
    const strings = [...'ab'].map((c) => c.charCodeAt(0));
    // two strings: 'a', 'bc'
    const payload = new Uint8Array([1, 0, strings[0]!, 2, 0, 98, 99]);
    const head30 = new DataView(new ArrayBuffer(30));
    for (let i = 0; i < 4; i++) head30.setUint8(i, PACK_MAGIC.charCodeAt(i));
    head30.setUint8(4, 1);
    head30.setUint8(5, 1);
    head30.setUint16(28, 2, true);
    const bytes = new Uint8Array(30 + payload.length);
    bytes.set(new Uint8Array(head30.buffer), 0);
    bytes.set(payload, 30);
    const { head } = openPack(bytes);
    assert.deepEqual(head.strings, ['a', 'bc']);
    assert.equal(packString(head, 0xffff), undefined);
    assert.equal(packString(head, 1), 'bc');
  });
});
