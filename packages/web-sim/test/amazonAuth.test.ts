import { afterEach, describe, expect, it, vi } from 'vitest';
import { signOutAmazon, startAmazonSignIn } from '../src/client/amazonAuth.ts';

afterEach(() => vi.unstubAllGlobals());

describe('Amazon sign-in', () => {
  it('does not report sign-out success when the session server rejects it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(signOutAmazon('http://localhost:5174')).rejects.toThrow('Sign-out failed');
  });
  it('uses Better Auth social sign-in and follows the returned authorization URL', async () => {
    const assign = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      url: 'https://www.amazon.com/ap/oa?state=test-state',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { assign } });

    await startAmazonSignIn('http://localhost:5174', 'http://localhost:5180/');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5174/payload-api/auth/sign-in/social', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'amazon', callbackURL: 'http://localhost:5180/', errorCallbackURL: 'http://localhost:5180/' }),
    });
    expect(assign).toHaveBeenCalledWith('https://www.amazon.com/ap/oa?state=test-state');
  });

  it('shows server errors without navigating', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Provider unavailable' }), { status: 400 })));
    await expect(startAmazonSignIn('http://localhost:5174', 'http://localhost:5180/')).rejects.toThrow('Provider unavailable');
    expect(assign).not.toHaveBeenCalled();
  });
});
