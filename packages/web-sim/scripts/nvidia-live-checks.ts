import type Anthropic from '@anthropic-ai/sdk';
import { sameNvidiaModel } from '../server/nebius.ts';

/**
 * Output budget for the provider-only greeting. Nemotron 3.5 Lightning reasons
 * before it answers; 512 tokens could end the turn with no answer text.
 */
export const PROVIDER_PROOF_MAX_TOKENS = 2048;

/** The greeting counts only when the same NVIDIA model (or its alias) returned real text. */
export function providerProofAnswered(answer: Pick<Anthropic.Message, 'model' | 'content'>, requestedModel: string): boolean {
  return sameNvidiaModel(requestedModel, answer.model)
    && answer.content.some((block) => block.type === 'text' && block.text.trim().length > 0);
}
