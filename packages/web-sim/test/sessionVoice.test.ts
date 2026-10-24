import { describe, expect, it } from 'vitest';
import { memoryStore, type TranscriptItem } from '../src/client/session.ts';
import { latestMonVoice, loadVoice, sameVoice, saveVoice, stickyVoice } from '../src/client/sessionVoice.ts';

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
const ratti = (stage = 'Baby', mood?: string) => ({ mon: { monId: 'mon-1', voice: { lineageId: 'dex-001/male/1', stage } }, ...(mood ? { mood } : {}) });

describe('sticky Mon voice', () => {
  it('learns the voice and the Mon it belongs to from a tool result', () => {
    expect(latestMonVoice([tool('a', ratti('Baby', 'content'))])).toEqual({
      monId: 'mon-1',
      voice: { lineageId: 'dex-001/male/1', stage: 'Baby', mood: 'content' },
    });
  });

  it('keeps the remembered voice for a reply with no Mon result yet', () => {
    const remembered = latestMonVoice([tool('a', ratti())]);
    expect(stickyVoice(remembered, [])).toEqual(remembered);
    expect(stickyVoice(remembered, [{ kind: 'user', id: 'u', text: 'hi', at: 0 }])).toEqual(remembered);
  });

  it('never drops to no voice once one is known, even if a later result has none', () => {
    const remembered = latestMonVoice([tool('a', ratti())]);
    expect(stickyVoice(remembered, [tool('b', { mon: { monId: 'mon-1', voice: null } })])).toEqual(remembered);
    expect(stickyVoice(remembered, [tool('b', { mon: { monId: 'mon-1', voice: { lineageId: 3 } } })])).toEqual(remembered);
  });

  it('follows the same Mon as it grows and changes mood', () => {
    const remembered = latestMonVoice([tool('a', ratti('Baby'))]);
    expect(stickyVoice(remembered, [tool('b', ratti('Small', 'asleep'))])?.voice).toEqual({
      lineageId: 'dex-001/male/1',
      stage: 'Small',
      mood: 'asleep',
    });
  });

  it('switches when a different Mon answers', () => {
    const remembered = latestMonVoice([tool('a', ratti())]);
    const other = { mon: { monId: 'mon-2', voice: { lineageId: 'dex-001/female/3', stage: 'Small' } } };
    expect(stickyVoice(remembered, [tool('b', other)])).toEqual({ monId: 'mon-2', voice: { lineageId: 'dex-001/female/3', stage: 'Small' } });
  });

  it('persists across a reload and rejects a tampered entry', () => {
    const store = memoryStore();
    const v = latestMonVoice([tool('a', ratti('Baby', 'content'))]);
    saveVoice(store, v);
    expect(loadVoice(store)).toEqual(v);
    store.setItem('nyc-mon-sim.voice.v1', JSON.stringify({ monId: 'mon-1', voice: { lineageId: 'x', stage: 'Teen' } }));
    expect(loadVoice(store)).toBeNull();
    store.setItem('nyc-mon-sim.voice.v1', '{not json');
    expect(loadVoice(store)).toBeNull();
    saveVoice(store, null);
    expect(loadVoice(store)).toBeNull();
  });

  it('compares voices by Mon, lineage, stage and mood', () => {
    const a = latestMonVoice([tool('a', ratti('Baby'))]);
    expect(sameVoice(a, latestMonVoice([tool('b', ratti('Baby'))]))).toBe(true);
    expect(sameVoice(a, latestMonVoice([tool('b', ratti('Small'))]))).toBe(false);
    expect(sameVoice(a, null)).toBe(false);
  });
});
