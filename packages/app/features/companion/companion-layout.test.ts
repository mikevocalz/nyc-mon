import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMPANION_MIN, hostFolds, planCompanion, stageFrameFor } from './companion-layout.ts';

describe('planCompanion', () => {
  it('keeps a phone on the device alone, portrait and landscape', () => {
    assert.deepEqual(planCompanion({ enabled: false, width: 390, height: 844 }), { kind: 'single' });
    assert.deepEqual(planCompanion({ enabled: false, width: 932, height: 430 }), { kind: 'single' });
  });

  it('waits for the first measure', () => {
    assert.deepEqual(planCompanion({ enabled: true, width: null, height: null }), { kind: 'single' });
  });

  it('iPad landscape beside a rail: the pane left, the device right', () => {
    const plan = planCompanion({ enabled: true, width: 1114, height: 834 });
    assert.equal(plan.kind, 'row');
    if (plan.kind !== 'row') return;
    assert.ok(plan.paneWidth >= COMPANION_MIN.paneWidth && plan.paneWidth <= 480);
    assert.ok(1114 - plan.paneWidth - plan.gap >= COMPANION_MIN.deviceWidth);
  });

  it('iPad portrait: the device band on top, larger than the pane under it', () => {
    const plan = planCompanion({ enabled: true, width: 754, height: 1194 });
    assert.equal(plan.kind, 'column');
    if (plan.kind !== 'column') return;
    assert.ok(plan.stageHeight > 1194 - plan.stageHeight - plan.gap);
    assert.ok(1194 - plan.stageHeight - plan.gap >= COMPANION_MIN.paneHeight);
  });

  it('a spanned Duo splits at the hinge, never across it', () => {
    const plan = planCompanion({
      enabled: true, width: 1080, height: 696, folds: [{ orientation: 'vertical', x: 540, y: 0, width: 34, height: 696 }],
    });
    assert.deepEqual(plan, { kind: 'row', paneWidth: 540, gap: 34 });
    const frame = stageFrameFor(plan, 1080, 696);
    assert.equal(frame.x, 574);
    assert.equal(frame.width, 506);
  });

  it('a zero-width fold is still a boundary', () => {
    const plan = planCompanion({
      enabled: true, width: 1080, height: 696, folds: [{ orientation: 'vertical', x: 540, y: 0, width: 0, height: 696 }],
    });
    assert.deepEqual(plan, { kind: 'row', paneWidth: 540, gap: 0 });
  });

  it('tabletop: the device above the fold, the pane below', () => {
    const plan = planCompanion({
      enabled: true, width: 720, height: 1114, folds: [{ orientation: 'horizontal', x: 0, y: 540, width: 720, height: 34 }],
    });
    assert.deepEqual(plan, { kind: 'column', stageHeight: 540, gap: 34 });
  });

  it('a fold that leaves either side too small falls back to the device alone', () => {
    const plan = planCompanion({
      enabled: true, width: 900, height: 600, folds: [{ orientation: 'vertical', x: 200, y: 0, width: 0, height: 600 }],
    });
    assert.deepEqual(plan, { kind: 'single' });
  });

  it('too short a window keeps the device alone instead of squeezing it', () => {
    assert.deepEqual(planCompanion({ enabled: true, width: 600, height: 500 }), { kind: 'single' });
    assert.deepEqual(planCompanion({ enabled: true, width: 500, height: 520 }), { kind: 'single' });
  });

  it('every row and column plan leaves both regions at their minimums (sweep)', () => {
    for (let w = 600; w <= 1600; w += 37) {
      for (let h = 500; h <= 1400; h += 41) {
        const plan = planCompanion({ enabled: true, width: w, height: h });
        if (plan.kind === 'row') {
          assert.ok(plan.paneWidth >= COMPANION_MIN.paneWidth, `${w}x${h}`);
          assert.ok(w - plan.paneWidth - plan.gap >= COMPANION_MIN.deviceWidth, `${w}x${h}`);
        } else if (plan.kind === 'column') {
          assert.ok(plan.stageHeight >= COMPANION_MIN.stageHeight, `${w}x${h}`);
          assert.ok(h - plan.stageHeight - plan.gap >= COMPANION_MIN.paneHeight, `${w}x${h}`);
        }
      }
    }
  });
});

describe('hostFolds', () => {
  it('moves folds into the host and drops ones outside it', () => {
    const folds = hostFolds(
      [
        { orientation: 'vertical', x: 600, y: 0, width: 20, height: 800 },
        { orientation: 'vertical', x: 1300, y: 0, width: 20, height: 800 },
      ],
      { x: 100, y: 40 },
      { width: 1000, height: 760 },
    );
    assert.equal(folds.length, 1);
    assert.equal(folds[0]?.x, 500);
    assert.equal(folds[0]?.y, -40);
  });
});
