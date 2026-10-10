import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SANDBOX_ATTRIBUTE, buildViewCsp, parseCspParam, sandboxUrl, sanitizeCspSources } from '../src/shared/csp.ts';
import { sandboxDocument, sandboxHeaders } from '../server/sandbox.ts';

const directives = (csp: string) => Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0], d]));

describe('view CSP', () => {
  it('is restrictive when the resource declares nothing', () => {
    const d = directives(buildViewCsp(undefined));
    expect(d['default-src']).toBe("default-src 'none'");
    expect(d['connect-src']).toBe("connect-src 'none'");
    expect(d['frame-src']).toBe("frame-src 'none'");
    expect(d['object-src']).toBe("object-src 'none'");
    expect(d['base-uri']).toBe("base-uri 'self'");
    expect(d['script-src']).not.toContain('unsafe-eval');
  });

  it('allows exactly the declared origins in the matching directives', () => {
    const d = directives(
      buildViewCsp({
        connectDomains: ['https://api.nyc-mon.example'],
        resourceDomains: ['https://cdn.nyc-mon.example'],
        frameDomains: ['https://player.example'],
      }),
    );
    expect(d['connect-src']).toBe('connect-src https://api.nyc-mon.example');
    expect(d['img-src']).toContain('https://cdn.nyc-mon.example');
    expect(d['script-src']).toContain('https://cdn.nyc-mon.example');
    expect(d['frame-src']).toBe('frame-src https://player.example');
    expect(d['connect-src']).not.toContain('cdn.nyc-mon.example');
  });

  it('drops entries that would inject directives or keywords', () => {
    expect(
      sanitizeCspSources([
        "https://ok.example",
        "https://evil.example; script-src *",
        "'unsafe-eval'",
        '*',
        'data:',
        'https://a.example https://b.example',
        'javascript:alert(1)',
        'https://*.cdn.example',
        'https://*.com',
        'http://tracker.example',
        'ws://tracker.example',
        'https://intranet',
        'http://localhost:8788',
        42,
      ]),
    ).toEqual(['https://ok.example', 'https://*.cdn.example', 'http://localhost:8788']);
  });

  it('parses the ?csp param defensively', () => {
    expect(parseCspParam(null)).toBeUndefined();
    expect(parseCspParam('{not json')).toBeUndefined();
    expect(parseCspParam(JSON.stringify({ connectDomains: ['https://x.example', "'self'"] }))).toEqual({
      connectDomains: ['https://x.example'],
      resourceDomains: undefined,
      frameDomains: undefined,
      baseUriDomains: undefined,
    });
  });
});

describe('sandbox proxy', () => {
  const HOST = 'http://localhost:5180';

  it('ships the CSP as a header and only lets the simulator frame it', () => {
    const csp = encodeURIComponent(JSON.stringify({ connectDomains: ['https://api.example'] }));
    const h = sandboxHeaders(`?csp=${csp}`, HOST);
    expect(h['content-security-policy']).toContain('connect-src https://api.example');
    expect(h['content-security-policy']).toContain(`frame-ancestors ${HOST}`);
    expect(h['cache-control']).toBe('no-store');
  });

  it('uses the spec sandbox flags and nothing that escapes the frame', () => {
    expect(SANDBOX_ATTRIBUTE.split(' ').sort()).toEqual(['allow-forms', 'allow-same-origin', 'allow-scripts']);
    expect(SANDBOX_ATTRIBUTE).not.toMatch(/allow-top-navigation|allow-popups-to-escape|allow-modals/);
    const html = readFileSync(resolve(import.meta.dirname, '../sandbox/proxy.html'), 'utf8');
    expect(html).toContain(`setAttribute('sandbox', '${SANDBOX_ATTRIBUTE}')`);
  });

  it('pins postMessage to the host origin it was served for', () => {
    const doc = sandboxDocument(HOST);
    expect(doc).toContain(`var HOST_ORIGIN = "${HOST}";`);
    expect(doc).not.toContain('__HOST_ORIGIN__');
    expect(doc).not.toMatch(/postMessage\([^)]*'\*'\)/);
  });

  it('builds the sandbox URL on the sandbox origin with the CSP attached', () => {
    const url = new URL(sandboxUrl('http://localhost:5181', { connectDomains: ['https://api.example'] }));
    expect(url.origin).toBe('http://localhost:5181');
    expect(url.pathname).toBe('/sandbox');
    expect(JSON.parse(url.searchParams.get('csp')!)).toEqual({ connectDomains: ['https://api.example'] });
    expect(new URL(sandboxUrl('http://localhost:5181', undefined)).search).toBe('');
  });
});
