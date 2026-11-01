import assert from 'node:assert/strict';
import { it } from 'node:test';
import { NO_OWNER, mustReleaseOnDisable } from './touch-ownership.ts';

it('M4: a thumb resting in the dead zone still owns the control and must be released on disable', () => {
  // The old AnalogStick test was `direction !== 'none' || engaged`, both false here.
  const deadZoneThumb = { ownerPointerId: 3, direction: 'none', engaged: false };
  assert.equal(mustReleaseOnDisable(deadZoneThumb.ownerPointerId), true);
  assert.equal(mustReleaseOnDisable(NO_OWNER), false);
});
