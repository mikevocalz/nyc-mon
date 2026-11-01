import { describe, expect, it } from 'vitest';
import { toMonViewModel } from './contract.ts';

describe('MCP care pause adaptation', () => {
  const care = { energy: 0.7, fullness: 0.6, social: 0.5, activity: 'awake' };
  const read = (extra: Record<string, unknown>) => toMonViewModel({
    mon: { monId: 'mon-1', speciesId: 'dex-002' }, care: { ...care, ...extra },
  })?.care;

  it('defaults legacy CareView results to unpaused', () => {
    expect(read({})?.pause).toBeNull();
    expect(read({ pause: null })?.pause).toBeNull();
  });

  it('preserves the official pause from a core CareState', () => {
    expect(read({ pause: { since: 1234 } })?.pause).toEqual({ since: 1234 });
    expect(read({ pause: { since: 0 } })?.pause).toEqual({ since: 0 });
  });

  it('does not construct invalid pause timestamps from untrusted tool results', () => {
    for (const since of [-1, 1.5, NaN, Infinity, '1234', null]) {
      expect(read({ pause: { since } })?.pause).toBeNull();
    }
    expect(read({ pause: true })?.pause).toBeNull();
  });
});
