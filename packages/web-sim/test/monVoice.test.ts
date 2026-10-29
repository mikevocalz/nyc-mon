import { describe, expect, it } from 'vitest';
import type { TranscriptItem } from '../src/client/session.ts';
import { currentMonVoice, gatedLine, liveVoiceStage } from '../src/client/monVoice.ts';
import { babbleInventory } from '@acme/content/voice';
import { BABY_TALK_MS, isBabble } from '@acme/core';

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

describe('gatedLine and liveVoiceStage (Decision 32)', () => {
  const egg = { lineageId: 'dex-001/male/1', stage: 'Egg', voiceStage: 'baby-talk' } as const;
  it('babbles a line for an Egg, leaves empty lines and unknown voices alone', () => {
    expect(isBabble(gatedLine('Hello Callah', egg), babbleInventory({ lineageId: egg.lineageId }, 'Egg'))).toBe(true);
    expect(gatedLine('', egg)).toBe('');
    expect(gatedLine('Hello Callah', undefined)).toBe('Hello Callah');
    expect(gatedLine('Hello Callah', { lineageId: 'dex-001/male/1', stage: 'Small', voiceStage: 'full' })).toBe('Hello Callah');
  });
  it('ends a Baby’s first day by its hatch time, and never gives an Egg words', () => {
    const baby = { lineageId: 'dex-001/male/1', stage: 'Baby', voiceStage: 'baby-talk' } as const;
    expect(liveVoiceStage(baby, 0, BABY_TALK_MS - 1)).toBe('baby-talk');
    expect(liveVoiceStage(baby, 0, BABY_TALK_MS)).toBe('limited');
    expect(liveVoiceStage(baby, undefined, 0)).toBe('baby-talk');
    expect(liveVoiceStage({ ...egg, voiceStage: 'full' }, undefined, 0)).toBe('baby-talk');
    expect(liveVoiceStage(undefined, 0, 0)).toBeUndefined();
  });
});
