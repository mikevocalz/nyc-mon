import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createKeyEventFilter, isEditableTarget, type KeyEventLike } from './web-key-filter.ts';

const ev = (over: Partial<KeyEventLike>): KeyEventLike => ({
  type: 'keydown', code: 'KeyW', repeat: false, ctrlKey: false, metaKey: false, altKey: false, editableTarget: false, ...over,
});

describe('M6: the web keyboard filter', () => {
  it('typing into an input does not drive the game', () => {
    const f = createKeyEventFilter();
    assert.equal(f.decide(ev({ code: 'KeyJ', editableTarget: true })).forward, false);
  });

  it('Cmd/Ctrl/Alt chords keep their browser meaning', () => {
    const f = createKeyEventFilter();
    assert.equal(f.decide(ev({ code: 'KeyK', metaKey: true })).forward, false);
    assert.equal(f.decide(ev({ code: 'KeyK', ctrlKey: true })).forward, false);
    assert.equal(f.decide(ev({ code: 'ArrowLeft', altKey: true })).forward, false);
  });

  it('mapped codes are forwarded with preventDefault; unmapped ones are left to the page', () => {
    const f = createKeyEventFilter();
    assert.deepEqual(f.decide(ev({ code: 'ArrowDown' })), { forward: true, preventDefault: true });
    assert.deepEqual(f.decide(ev({ code: 'Space' })), { forward: false, preventDefault: false });
    assert.equal(f.decide(ev({ code: 'KeyW', repeat: true })).forward, false);
  });

  it('a key up always follows its forwarded down, even with a modifier held by then', () => {
    const f = createKeyEventFilter();
    f.decide(ev({ code: 'KeyD' }));
    assert.equal(f.decide(ev({ type: 'keyup', code: 'KeyD', ctrlKey: true })).forward, true);
    assert.equal(f.decide(ev({ type: 'keyup', code: 'KeyD' })).forward, false, 'no second up');
    assert.equal(f.decide(ev({ type: 'keyup', code: 'KeyA' })).forward, false, 'no up without a down');
  });

  it('recognises editable targets', () => {
    assert.equal(isEditableTarget({ tagName: 'input' }), true);
    assert.equal(isEditableTarget({ tagName: 'TEXTAREA' }), true);
    assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
    assert.equal(isEditableTarget({ tagName: 'BUTTON' }), false);
    assert.equal(isEditableTarget(null), false);
  });
});

describe('Shift runs on the web too', () => {
  it('Shift is forwarded without preventDefault, and its up follows', () => {
    const f = createKeyEventFilter();
    assert.deepEqual(f.decide(ev({ code: 'ShiftLeft' })), { forward: true, preventDefault: false });
    assert.deepEqual(f.decide(ev({ type: 'keyup', code: 'ShiftLeft' })), { forward: true, preventDefault: false });
    assert.equal(f.decide(ev({ code: 'ShiftRight', editableTarget: true })).forward, false);
  });
});
