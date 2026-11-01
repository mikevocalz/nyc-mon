import { describe, expect, it } from 'vitest';
import { loadNvidiaEnv } from '../server/nvidia-env.ts';

const env = { NEBIUS_API_KEY: 'k', V1_MCP_SERVICE_KEY: 'v'.repeat(32) };

describe('NVIDIA output token budget', () => {
  it('defaults high enough to leave a reasoning model room to answer', () => {
    expect(loadNvidiaEnv(env).SIM_MAX_OUTPUT_TOKENS).toBe(4096);
  });
  it('stays bounded', () => {
    expect(loadNvidiaEnv({ ...env, SIM_MAX_OUTPUT_TOKENS: '16000' }).SIM_MAX_OUTPUT_TOKENS).toBe(16000);
    expect(() => loadNvidiaEnv({ ...env, SIM_MAX_OUTPUT_TOKENS: '16001' })).toThrow();
    expect(() => loadNvidiaEnv({ ...env, SIM_MAX_OUTPUT_TOKENS: '255' })).toThrow();
  });
});
