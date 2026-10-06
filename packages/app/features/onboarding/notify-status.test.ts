import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { notifyOffActionFor, notifyOffStatusItem } from './notify-status.ts';

describe('notifyOffActionFor', () => {
  it('re-asks when the Caller never saw the OS prompt', () => {
    assert.equal(notifyOffActionFor('not-now'), 'ask');
    assert.equal(notifyOffActionFor('schedule-failed'), 'ask');
  });

  it('only Settings can reverse a real denial', () => {
    assert.equal(notifyOffActionFor('denied'), 'settings');
  });
});

describe('notifyOffStatusItem', () => {
  it('carries the Turn on action after Not now', () => {
    let asked = 0;
    const item = notifyOffStatusItem({ state: 'not-now', onAsk: () => asked++ });
    assert.equal(item.id, 'notify-off');
    assert.equal(item.action?.label, 'Turn on');
    item.action?.onPress();
    assert.equal(asked, 1);
  });

  it('carries Open Settings after a denial, never Turn on', () => {
    let opened = 0;
    const item = notifyOffStatusItem({ state: 'denied', onOpenSettings: () => opened++ });
    assert.equal(item.action?.label, 'Open Settings');
    item.action?.onPress();
    assert.equal(opened, 1);
  });

  it('renders the schedule-failure line and still offers Turn on', () => {
    const item = notifyOffStatusItem({ state: 'schedule-failed', onAsk: () => {} });
    assert.equal(item.label, "We couldn't set the notification. Open the app to check on your egg.");
    assert.equal(item.action?.label, 'Turn on');
  });

  it('renders a bare line where no host handler exists (web)', () => {
    const item = notifyOffStatusItem({ state: 'denied' });
    assert.equal(item.action, undefined);
  });
});
