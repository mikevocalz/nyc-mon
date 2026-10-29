import { describe, expect, it } from 'vitest';
import { countFreshWrites } from '../game.ts';

describe('PUT /v1/mons/:id/care applied count', () => {
  const w = (deviceId: string, seq: number) => ({ deviceId, seq });

  it('counts only writes above the device seq the server already applied', () => {
    expect(countFreshWrites([w('a', 3), w('a', 4), w('a', 5)], { a: 4 })).toBe(1);
    expect(countFreshWrites([w('a', 1)], {})).toBe(1);
  });

  it('counts a write duplicated in one batch once, and devices apart', () => {
    expect(countFreshWrites([w('a', 2), w('a', 2), w('b', 2)], { b: 2 })).toBe(1);
  });
});
