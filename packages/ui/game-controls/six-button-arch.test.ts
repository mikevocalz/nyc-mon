import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { BUTTON_IDS, type ButtonId } from './contract.ts';
import {
  SIX_BUTTON_BOX_DP,
  SIX_BUTTON_CENTRES_DP,
  SIX_BUTTON_MIN_TARGET_DP,
  SIX_BUTTON_ROW_GEOMETRY_DP,
  sixButtonArch,
  sixButtonCentresFromRows,
} from './six-button-arch.ts';

const SCALES = [0.8, 0.9, 1, 1.2, 1.4];
/** Rounding each centre to whole dp moves it up to √0.5 dp, so a difference of two centres can be off by up to √2. */
const ROUNDING_DP = Math.SQRT2 + 1e-9;
const REFERENCE = { x: [28, 121], y: [66, 69], z: [116, 28], a: [77, 160], b: [116, 107], c: [165, 66] };

/** Rotates a screen vector by +45° back into the row frame (+along index → ring, +y down). */
function toRowFrame(dx: number, dy: number): { along: number; across: number } {
  const c = Math.SQRT1_2;
  return { along: dx * c - dy * c, across: dx * c + dy * c };
}

describe('sixButtonArch', () => {
  it('reproduces the -45° table at scale 1.0 for the right hand', () => {
    const arch = sixButtonArch({ scale: 1, handedness: 'right' });
    const centres = Object.fromEntries(arch.slots.map((s) => [s.id, [s.x, s.y]]));
    assert.deepEqual(centres, REFERENCE);
    assert.equal(arch.diameterDp, 56);
    assert.equal(arch.widthDp, 193);
    assert.equal(arch.heightDp, 188);
  });

  it('commits exactly what the row derivation produces, box included', () => {
    const derived = sixButtonCentresFromRows();
    assert.deepEqual(derived.centres, SIX_BUTTON_CENTRES_DP);
    assert.equal(derived.width, SIX_BUTTON_BOX_DP.width);
    assert.equal(derived.height, SIX_BUTTON_BOX_DP.height);
  });

  it('runs each row along -45°: the arch rises 0 / 10 / 4 off the baseline and the pitch stays 64, within rounding', () => {
    const c = SIX_BUTTON_CENTRES_DP;
    for (const [index, middle, ring] of [['x', 'y', 'z'], ['a', 'b', 'c']] as const) {
      const toMiddle = toRowFrame(c[middle].x - c[index].x, c[middle].y - c[index].y);
      const toRing = toRowFrame(c[ring].x - c[index].x, c[ring].y - c[index].y);
      assert.ok(Math.abs(toMiddle.along - 64) <= ROUNDING_DP, `${index}→${middle} along ${toMiddle.along}`);
      assert.ok(Math.abs(toRing.along - 128) <= ROUNDING_DP, `${index}→${ring} along ${toRing.along}`);
      assert.ok(Math.abs(-toMiddle.across - 10) <= ROUNDING_DP, `${middle} crest ${-toMiddle.across}`);
      assert.ok(Math.abs(-toRing.across - 4) <= ROUNDING_DP, `${ring} rise ${-toRing.across}`);
      // Screen check: the ring column sits up and to the right of the index column.
      assert.ok(c[ring].x > c[index].x && c[ring].y < c[index].y, `${index}..${ring} rises to the upper right`);
    }
  });

  it('keeps lane A’s row pitch and thumbward stagger in the row frame', () => {
    const c = SIX_BUTTON_CENTRES_DP;
    const xa = toRowFrame(c.a.x - c.x.x, c.a.y - c.x.y);
    assert.ok(Math.abs(xa.across - SIX_BUTTON_ROW_GEOMETRY_DP.rowPitch) <= ROUNDING_DP, `row pitch ${xa.across}`);
    assert.ok(Math.abs(xa.along - SIX_BUTTON_ROW_GEOMETRY_DP.stagger) <= ROUNDING_DP, `stagger ${xa.along}`);
  });

  it('mirrors for the left hand: x\' = 193 − x, labels stay on their buttons, rows rise to the upper left', () => {
    const arch = sixButtonArch({ scale: 1, handedness: 'left' });
    const centres = Object.fromEntries(arch.slots.map((s) => [s.id, [s.x, s.y]]));
    assert.deepEqual(centres, { x: [165, 121], y: [127, 69], z: [77, 28], a: [116, 160], b: [77, 107], c: [28, 66] });
  });

  it('mirrors as an involution', () => {
    const right = sixButtonArch({ scale: 1.2, handedness: 'right' });
    const left = sixButtonArch({ scale: 1.2, handedness: 'left' });
    for (const slot of right.slots) {
      const mirrored = left.slots.find((s) => s.id === slot.id)!;
      assert.ok(Math.abs(right.widthDp - mirrored.x - slot.x) < 1e-9, slot.id);
      assert.equal(mirrored.y, slot.y);
    }
  });

  it('places all six ids once, top row X Y Z and bottom row A B C', () => {
    const arch = sixButtonArch({ scale: 1, handedness: 'right' });
    assert.deepEqual(arch.slots.map((s) => s.id), ['x', 'y', 'z', 'a', 'b', 'c']);
    assert.deepEqual([...BUTTON_IDS].sort(), arch.slots.map((s) => s.id).sort());
    assert.ok(arch.slots.filter((s) => s.row === 'top').every((s) => 'xyz'.includes(s.id)));
    assert.ok(arch.slots.filter((s) => s.row === 'bottom').every((s) => 'abc'.includes(s.id)));
  });

  it('keeps every cap at or over the 44 pt floor at every profile scale, including a clamped one', () => {
    for (const scale of SCALES) {
      const arch = sixButtonArch({ scale, handedness: 'right' });
      for (const slot of arch.slots) assert.ok(slot.diameterDp >= SIX_BUTTON_MIN_TARGET_DP, `scale ${scale}`);
    }
    assert.ok(sixButtonArch({ scale: 0.1, handedness: 'right' }).diameterDp >= SIX_BUTTON_MIN_TARGET_DP, 'clamped scale');
    assert.equal(sixButtonArch({ scale: Number.NaN, handedness: 'right' }).scale, 1);
  });

  it('never overlaps two caps and keeps about 8 dp along a row at scale 1', () => {
    for (const scale of SCALES) {
      const { slots } = sixButtonArch({ scale, handedness: 'right' });
      for (const a of slots) for (const b of slots) {
        if (a === b) continue;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(distance >= a.diameterDp - 1e-9, `${a.id}/${b.id} at scale ${scale}: ${distance}`);
      }
    }
    const one = sixButtonArch({ scale: 1, handedness: 'right' });
    for (const [p, q] of [['x', 'y'], ['y', 'z'], ['a', 'b'], ['b', 'c']] as const) {
      const a = one.slots.find((s) => s.id === p)!;
      const b = one.slots.find((s) => s.id === q)!;
      // §7 spaces neighbours 64.0–64.3 apart (8 dp gap); whole-dp rounding can take 0.4 of that.
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) - 56 >= 7.5, `${p} to ${q} gap`);
    }
  });

  it('fits every cap inside the reported box and touches all four edges (no slack)', () => {
    for (const handedness of ['left', 'right'] as const) for (const scale of SCALES) {
      const arch = sixButtonArch({ scale, handedness });
      for (const slot of arch.slots) {
        const r = slot.diameterDp / 2;
        assert.ok(slot.x - r >= -1e-9 && slot.x + r <= arch.widthDp + 1e-9, `${slot.id} x`);
        assert.ok(slot.y - r >= -1e-9 && slot.y + r <= arch.heightDp + 1e-9, `${slot.id} y`);
      }
    }
    const { slots, widthDp, heightDp } = sixButtonArch({ scale: 1, handedness: 'right' });
    assert.equal(Math.min(...slots.map((s) => s.x - 28)), 0);
    assert.equal(Math.min(...slots.map((s) => s.y - 28)), 0);
    assert.equal(Math.max(...slots.map((s) => s.x + 28)), widthDp);
    assert.equal(Math.max(...slots.map((s) => s.y + 28)), heightDp);
  });

  it('scales the whole cluster with the profile', () => {
    const large = sixButtonArch({ scale: 1.4, handedness: 'right' });
    assert.ok(Math.abs(large.widthDp - SIX_BUTTON_BOX_DP.width * 1.4) < 1e-9);
    assert.ok(Math.abs(large.heightDp - SIX_BUTTON_BOX_DP.height * 1.4) < 1e-9);
    assert.ok(Math.abs(large.diameterDp - 78.4) < 1e-9);
  });
});

describe('right-six/scene.rml', () => {
  const rml = readFileSync(new URL('../rive/arcade-controls/right-six/scene.rml', import.meta.url), 'utf8');
  /** The artboard adds this glow margin on every side of the hit box. */
  const MARGIN = 8;
  /** Each cap placement is a 64 × 64 nested artboard; its x/y is the top-left corner. */
  const HALF_PLACEMENT = 32;

  function attr(tag: string, name: string): number {
    const match = new RegExp(`\\b${name}="(-?[0-9.]+)"`).exec(tag);
    assert.ok(match, `${name} in ${tag}`);
    return Number(match[1]);
  }

  it('sizes the artboard to the box plus the glow margin', () => {
    const artboard = /<Artboard [^>]*name="RightSix"[^>]*>/.exec(rml)?.[0];
    assert.ok(artboard, 'RightSix artboard');
    assert.equal(attr(artboard, 'width'), SIX_BUTTON_BOX_DP.width + 2 * MARGIN);
    assert.equal(attr(artboard, 'height'), SIX_BUTTON_BOX_DP.height + 2 * MARGIN);
  });

  it('places every cap on the same centre as SIX_BUTTON_CENTRES_DP', () => {
    const cluster = /<Shape [^>]*name="Cluster"[^>]*>/.exec(rml)?.[0];
    assert.ok(cluster, 'Cluster shape');
    const originX = attr(cluster, 'x');
    const originY = attr(cluster, 'y');
    for (const id of BUTTON_IDS) {
      const tag = new RegExp(`<NestedArtboard [^>]*name="${id.toUpperCase()}"[^>]*>`).exec(rml)?.[0];
      assert.ok(tag, `placement ${id}`);
      const centre = {
        x: originX + attr(tag, 'x') + HALF_PLACEMENT - MARGIN,
        y: originY + attr(tag, 'y') + HALF_PLACEMENT - MARGIN,
      };
      assert.deepEqual(centre, SIX_BUTTON_CENTRES_DP[id as ButtonId], id);
    }
  });
});
