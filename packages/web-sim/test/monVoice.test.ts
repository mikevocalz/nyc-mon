import { describe, expect, it } from 'vitest';
import type { TranscriptItem } from '../src/client/session.ts';
import { currentMonVoice } from '../src/client/monVoice.ts';

const tool = (id: string, structuredContent: unknown): TranscriptItem => ({
  kind: 'tool',
  id,
  name: 'get_mon_status',
  title: 'Mon status',
  input: {},
  result: { content: [], structuredContent } as never,
  resourceUri: null,
  at: 0,
});

describe('currentMonVoice', () => {
  it('takes the voice from the latest tool result that carries a Mon', () => {
    const items: TranscriptItem[] = [
      tool('a', { mon: { voice: { lineageId: 'dex-001/male/1', stage: 'Baby' } } }),
      { kind: 'mon', id: 'm', text: 'hi', at: 0 },
      tool('b', { mon: { voice: { lineageId: 'dex-001/male/1', stage: 'Small' } } }),
      tool('c', { people: [] }),
    ];
    expect(currentMonVoice(items)).toEqual({ lineageId: 'dex-001/male/1', stage: 'Small' });
  });

  it('is undefined with no Mon result, a null voice, or a malformed one', () => {
    expect(currentMonVoice([])).toBeUndefined();
    expect(currentMonVoice([tool('a', { mon: { voice: null } })])).toBeUndefined();
    expect(currentMonVoice([tool('a', { mon: { voice: { lineageId: 3, stage: 'Baby' } } })])).toBeUndefined();
    expect(currentMonVoice([tool('a', { mon: { voice: { lineageId: 'x', stage: 'Teen' } } })])).toBeUndefined();
  });

  it('stops at the latest Mon result even when its voice is null, so a stale voice is not reused', () => {
    const items = [tool('a', { mon: { voice: { lineageId: 'dex-001/male/1', stage: 'Baby' } } }), tool('b', { mon: { voice: null } })];
    expect(currentMonVoice(items)).toBeUndefined();
  });

  it("carries the result's mood when it is a known one", () => {
    const voice = { lineageId: 'dex-001/female/3', stage: 'Small' };
    expect(currentMonVoice([tool('a', { mon: { voice }, mood: 'asleep' })])).toEqual({ ...voice, mood: 'asleep' });
    expect(currentMonVoice([tool('a', { mon: { voice }, mood: 'grumpy' })])).toEqual(voice);
    expect(currentMonVoice([tool('a', { mon: { voice } })])).toEqual(voice);
  });
});
