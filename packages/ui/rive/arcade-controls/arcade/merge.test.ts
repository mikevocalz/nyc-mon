import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
// merge.mjs is plain JS; the assertions below are about its text output.
// @ts-expect-error untyped sibling script
import { generate, renumber, stageArtboards } from './merge.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = ['stick.rml', 'cluster.rml', 'pill.rml'] as const;

describe('merge.mjs', () => {
  it('renumbers every id segment, including dash-separated sourcePathIds', () => {
    assert.equal(
      renumber('<DataBindContext sourcePathIds="0:40-0:45-0:53" converterId="0:120"/>', '1'),
      '<DataBindContext sourcePathIds="1:40-1:45-1:53" converterId="1:120"/>',
    );
    // Ids from another document prefix, or a longer number ending in 0, stay.
    assert.equal(renumber('id="10:20" ref="2:9" id="0:20"', '1'), 'id="10:20" ref="2:9" id="1:20"');
  });

  it('injects a stage position where an artboard lacks one', () => {
    const { text, right } = stageArtboards('<Artboard width="100" name="A" id="1:2">', 60);
    assert.match(text, /<Artboard x="60" y="0" width="100"/);
    assert.equal(right, 160);
  });

  it('offsets an artboard that already carries a stage position', () => {
    const { text, right } = stageArtboards('<Artboard x="200" y="0" width="72" name="B" id="1:702">', 332);
    assert.match(text, /<Artboard x="532" y="0"/);
    assert.equal(right, 604);
  });

  it('regeneration reproduces the committed inputs byte-for-byte', () => {
    const outputs = generate() as { out: string; text: string }[];
    assert.deepEqual(outputs.map((o) => o.out), [...DOCS]);
    for (const { out, text } of outputs) {
      assert.equal(readFileSync(join(HERE, out), 'utf8'), text, `${out} is stale — run \`node merge.mjs\``);
    }
  });

  it('keeps every object id inside its own document prefix', () => {
    const outputs = generate() as { out: string; text: string }[];
    for (const [i, { out, text }] of outputs.entries()) {
      const doc = String(i + 1);
      const stray = new Set(
        [...text.matchAll(/(?<![0-9A-Za-z:])(\d+):(\d+)/g)]
          .filter((m) => m[1] !== doc)
          .map((m) => `${m[1]}:`),
      );
      // The only foreign prefix allowed is a deduped asset reference (the font).
      stray.delete('2:');
      assert.deepEqual([...stray], [], `${out} has unrenumbered ids`);
    }
  });

  it('declares the Space Grotesk font exactly once', () => {
    const outputs = generate() as { out: string; text: string }[];
    const decls = outputs.flatMap((o) => [...o.text.matchAll(/<FontAsset\b/g)]);
    assert.equal(decls.length, 1);
    const cluster = outputs.find((o) => o.out === 'cluster.rml');
    assert.ok(cluster);
    const canonical = /id="(\d+:\d+)"/.exec(cluster.text.match(/<FontAsset\b[^>]*\/>/)?.[0] ?? '')?.[1];
    assert.ok(canonical, 'cluster.rml must declare the font');
    // Every font id reference in the merged doc resolves to it.
    const refs = outputs.flatMap((o) => [...o.text.matchAll(/\bfontAssetId="(\d+:\d+)"/g)].map((m) => m[1]));
    assert.ok(refs.length > 0, 'expected fontId references');
    for (const ref of refs) assert.equal(ref, canonical);
  });

  it('stages the five artboards so none overlap', () => {
    const outputs = generate() as { out: string; text: string }[];
    const boxes = outputs.flatMap((o) =>
      [...o.text.matchAll(/<Artboard\b[^>]*>/g)].map((m) => ({
        name: /name="([^"]+)"/.exec(m[0])?.[1],
        x: Number(/\bx="([-\d.]+)"/.exec(m[0])?.[1] ?? NaN),
        w: Number(/\bwidth="([\d.]+)"/.exec(m[0])?.[1]),
      })),
    );
    assert.deepEqual(
      boxes.map((b) => b.name).sort(),
      ['ArcadeButton', 'LeftStick', 'RightSix', 'StartStop', 'Thumbpad'],
    );
    for (const b of boxes) assert.ok(Number.isFinite(b.x), `${b.name} needs a stage x`);
    const sorted = [...boxes].sort((a, b) => a.x - b.x);
    for (const [i, box] of sorted.entries()) {
      const prev = sorted[i - 1];
      if (prev) assert.ok(box.x >= prev.x + prev.w, `${box.name} overlaps ${prev.name}`);
    }
  });
});
