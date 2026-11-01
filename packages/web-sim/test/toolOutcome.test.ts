import { describe, expect, it } from 'vitest';
import { toolOutcome } from '../src/shared/toolOutcome.ts';

describe('observable MCP action outcomes', () => {
  it('does not label a normal care decline as an applied action', () => {
    expect(toolOutcome({ structuredContent: { applied: false, declinedBecause: 'asleep' } })).toBe('declined');
  });
  it.each([
    [{ structuredContent: { applied: true } }, 'applied'],
    [{ isError: true, structuredContent: { applied: true } }, 'failed'],
    [{ structuredContent: { ok: false, applied: true } }, 'failed'],
    [{ structuredContent: { mon: { stage: 'Baby' } } }, 'returned'],
    [{ content: [{ type: 'text', text: 'status data' }] }, 'returned'],
    [{ structuredContent: { applied: 'true' } }, 'unverified'],
    [null, 'unverified'],
  ] as const)('reports only what the result proves: %j → %s', (result, expected) => {
    expect(toolOutcome(result)).toBe(expected);
  });

});
