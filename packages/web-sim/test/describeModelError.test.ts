import { describe, expect, it } from 'vitest';
import { describeModelError } from '../server/model.ts';
import { NebiusError } from '../server/nebius.ts';
import { CompanionMemoryError } from '../server/companion-memory-client.ts';

describe('describeModelError on the NVIDIA path', () => {
  it.each([
    [new NebiusError('TIMEOUT'), 'Nemotron on Nebius didn’t answer within 60 seconds. No other model answered instead. Try again.', true],
    [new NebiusError('HTTP', 429), 'Nebius is limiting requests right now. Wait a minute and try again.', true],
    [new NebiusError('HTTP', 502), 'Nebius returned an error (502). No other model was used. Try again.', true],
    [new NebiusError('HTTP'), 'Nebius returned an error. No other model was used. Try again.', true],
    [new NebiusError('RESPONSE'), 'Nebius sent a reply this page couldn’t use. No other model was used. Try again.', true],
    [new NebiusError('EMPTY'), 'Nemotron on Nebius finished without an answer. No other model answered instead. Try again.', true],
    [new NebiusError('FILTERED'), 'Nemotron on Nebius declined to answer that. Nothing was changed, and no other model answered instead.', false],
    [new NebiusError('INPUT'), 'This conversation couldn’t be sent to Nebius. Start a new conversation.', false],
    [new NebiusError('CONFIG'), 'This conversation couldn’t be sent to Nebius. Start a new conversation.', false],
    [new CompanionMemoryError(503), 'Your saved preferences couldn’t be checked, so nothing was sent to the model. Try again.', true],
    [new CompanionMemoryError(401), 'Your saved preferences couldn’t be checked, so nothing was sent to the model. Try again.', true],
  ] as const)('%s → honest copy', (err, message, retry) => {
    const described = describeModelError(err);
    expect(described).toEqual({ message, retry });
    expect(described.message).not.toMatch(/Bedrock|AWS|Amazon/);
  });

  it('leaves the Bedrock path unchanged for other errors', () => {
    expect(describeModelError(new Error('boom'))).toEqual({ message: 'The model call failed. Try again.', retry: true });
  });
});
