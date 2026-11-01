import { describe, expect, it } from 'vitest';
import { readinessEnvironmentProblems } from './readinessEnvironment.ts';

const production = {
  NODE_ENV: 'production',
  AUTH_ISSUER: 'https://auth.nyc-mon.test',
  AUTH_JWKS_URL: 'https://auth.nyc-mon.test/payload-api/auth/jwks',
  MCP_RESOURCE_URI: 'https://mcp.nyc-mon.test/mcp',
  MCP_ALLOWED_ORIGINS: 'https://sim.nyc-mon.test',
  V1_BASE_URL: 'https://auth.nyc-mon.test',
  V1_MCP_SERVICE_KEY: 'synthetic-service-key-01234567890123456789',
  SIM_PUBLIC_ORIGIN: 'https://sim.nyc-mon.test',
  SIM_SANDBOX_ORIGIN: 'https://sandbox.nyc-mon.test',
  SIM_MCP_URL: 'https://mcp.nyc-mon.test/mcp',
  SIM_AUTH_MODE: 'oauth',
  SIM_MODEL_BACKEND: 'bedrock',
  AWS_REGION: 'us-east-1',
  OAUTH_ALEXA_CLIENT_SECRET: 'synthetic-alexa-secret-01234567890123456789',
  OAUTH_ALEXA_REDIRECT_URIS: 'https://alexa.nyc-mon.test/callback',
  OAUTH_SIM_REDIRECT_URIS: 'https://sim.nyc-mon.test/oauth/callback',
};

describe('offline production environment contract (synthetic values only)', () => {
  it('accepts aligned HTTPS, OAuth, Bedrock and origin relationships', () => {
    expect(readinessEnvironmentProblems(production)).toEqual([]);
  });
  for (const [key, value] of [
    ['NODE_ENV', 'development'], ['SIM_AUTH_MODE', 'dev-bypass'], ['OAUTH_DEV_BYPASS', '1'],
    ['SIM_MODEL_BACKEND', 'mock'], ['AWS_REGION', ''], ['V1_MCP_SERVICE_KEY', ''],
    ['AUTH_JWKS_URL', ''], ['SIM_PUBLIC_ORIGIN', 'https://'], ['SIM_SANDBOX_ORIGIN', 'not-a-url'],
    ['MCP_ALLOWED_ORIGINS', 'not-an-origin'], ['MCP_ALLOWED_ORIGINS', '*'],
    ['SIM_MCP_URL', 'https://other.nyc-mon.test/mcp'],
    ['AUTH_ISSUER', 'https://auth.nyc-mon.test/path'],
    ['OAUTH_ALEXA_CLIENT_SECRET', ''], ['OAUTH_SIM_REDIRECT_URIS', 'https://other.nyc-mon.test/oauth/callback'],
    ['SIM_SANDBOX_ORIGIN', production.SIM_PUBLIC_ORIGIN], ['SIM_PUBLIC_ORIGIN', 'http://sim.nyc-mon.test'],
  ] as const) {
    it(`rejects the incomplete or unsafe ${key} fixture`, () => {
      expect(readinessEnvironmentProblems({ ...production, [key]: value })).not.toEqual([]);
    });
  }
  it('returns field labels rather than credentials or supplied values', () => {
    const secret = 'do-not-include-this-value';
    const result = readinessEnvironmentProblems({ ...production, OAUTH_ALEXA_CLIENT_SECRET: secret });
    expect(result).toContain('OAUTH_ALEXA_CLIENT');
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
