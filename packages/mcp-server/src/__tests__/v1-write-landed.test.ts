import { describe, expect, it } from 'vitest';
import { createInitialCareState } from '@acme/core';
import { writeLanded } from '../data/v1.ts';

describe('writeLanded pause and resume confirmation', () => {
  const at = 1_000;
  const care = createInitialCareState('mon-test', at);

  it('confirms pause only with this intent timestamp', () => {
    expect(writeLanded({ ...care, pause: { since: at } }, { kind: 'pause' }, at)).toBe(true);
    expect(writeLanded({ ...care, pause: { since: at - 1 } }, { kind: 'pause' }, at)).toBe(false);
    expect(writeLanded(care, { kind: 'pause' }, at)).toBe(false);
  });

  it('does not mistake an unpaused reread for proof of a resume', () => {
    expect(writeLanded(care, { kind: 'resume' }, at)).toBe(false);
    expect(writeLanded({ ...care, pause: { since: at } }, { kind: 'resume' }, at)).toBe(false);
  });
});
