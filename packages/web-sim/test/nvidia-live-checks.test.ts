import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { PROVIDER_PROOF_MAX_TOKENS, providerProofAnswered } from '../scripts/nvidia-live-checks.ts';

const msg = (model: string, text: string) => ({ model, content: [{ type: 'text', text, citations: null }] }) as Pick<Anthropic.Message, 'model' | 'content'>;

describe('provider-only live proof', () => {
  it('leaves a reasoning model room to answer the greeting', () => {
    expect(PROVIDER_PROOF_MAX_TOKENS).toBeGreaterThanOrEqual(2048);
    expect(PROVIDER_PROOF_MAX_TOKENS).toBeLessThanOrEqual(16000);
  });
  it('accepts an alias of the requested NVIDIA model with real text', () => {
    expect(providerProofAnswered(msg('nvidia/nemotron-3.5-lightning', 'Hello!'), 'nvidia/Nemotron-3_5-Lightning')).toBe(true);
  });
  it('rejects another model or a blank answer', () => {
    expect(providerProofAnswered(msg('nvidia/nemotron-3-super-120b-a12b', 'Hello!'), 'nvidia/Nemotron-3_5-Lightning')).toBe(false);
    expect(providerProofAnswered(msg('nvidia/Nemotron-3_5-Lightning', '  '), 'nvidia/Nemotron-3_5-Lightning')).toBe(false);
  });
});
