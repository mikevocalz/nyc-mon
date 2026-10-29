import { describe, expect, it } from 'vitest';
import { brokenSaveKey, createEmptySave, keepsAsLastGood, lastGoodKey, readLastGood } from '../save/index.ts';

const good = JSON.stringify(createEmptySave('device-a', 1_000));

describe('last-good save snapshot (M22)', () => {
  it('keys the copy and the broken save beside the save key', () => {
    expect(lastGoodKey('nyc-mon-save')).toBe('nyc-mon-save:last-good');
    expect(brokenSaveKey('nyc-mon-save')).toBe('nyc-mon-save:broken');
  });

  it('reads a missing copy as none', () => {
    expect(readLastGood(undefined)).toEqual({ status: 'none' });
  });

  it('reads an intact copy as available, parsed to the current save', () => {
    const snap = readLastGood(good);
    expect(snap.status).toBe('available');
    if (snap.status === 'available') expect(snap.save.queue.deviceId).toBe('device-a');
  });

  it('reports a damaged copy with the loader reason instead of throwing', () => {
    expect(readLastGood('{not json')).toEqual({ status: 'unreadable', reason: 'corrupt' });
    expect(readLastGood(JSON.stringify({ version: 99 }))).toEqual({ status: 'unreadable', reason: 'future-version' });
    expect(readLastGood(JSON.stringify({ version: 3 }))).toEqual({ status: 'unreadable', reason: 'invalid' });
  });

  it('keeps a write as last good only when storage returns the same bytes', () => {
    expect(keepsAsLastGood(good, good)).toBe(true);
    expect(keepsAsLastGood(good, undefined)).toBe(false);
    expect(keepsAsLastGood(good, good.slice(0, 10))).toBe(false);
  });
});
