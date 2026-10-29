import { describe, expect, it } from 'vitest';
import { idempotencyKeyPrefix } from '../deletion.ts';

describe('idempotencyKeyPrefix', () => {
  it('matches the stored key format and never another Caller whose id starts the same', () => {
    const prefix = idempotencyKeyPrefix('4');
    expect('caller:4|POST /v1/eggs|abc'.startsWith(prefix)).toBe(true);
    expect('caller:41|POST /v1/eggs|abc'.startsWith(prefix)).toBe(false);
    expect('anonymous|POST /v1/eggs|abc'.startsWith(prefix)).toBe(false);
  });
});
