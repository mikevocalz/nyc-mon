import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
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

describe('sandbox origin separation', () => {
  const HOST = 'http://localhost:5180';
  const SANDBOX = 'http://localhost:5181';

  it("keeps frame-ancestors pinned to the host even when the view's CSP tries to add its own", () => {
    const hostile = encodeURIComponent(
      JSON.stringify({ connectDomains: ['https://ok.example; frame-ancestors *'], frameDomains: ["'self'", '*'], resourceDomains: ['https://x.example frame-ancestors'] }),
    );
    const csp = sandboxHeaders(`?csp=${hostile}`, HOST)['content-security-policy']!;
    expect(csp.match(/frame-ancestors/g)).toHaveLength(1);
    expect(csp.endsWith(`frame-ancestors ${HOST}`)).toBe(true);
    expect(csp).not.toContain('*');
    expect(directives(csp)['connect-src']).toBe("connect-src 'none'");
  });

  /**
   * Runs the real proxy.html script against fake window objects, so the
   * relay rules are tested as shipped: who may talk to whom, and on what
   * origin each message goes out.
   */
  function runProxy(options: { topReadable?: boolean } = {}) {
    const html = sandboxDocument(HOST);
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (script === undefined) throw new Error('proxy script missing');
    const toParent: { data: unknown; target: string }[] = [];
    const toInner: { data: unknown; target: string }[] = [];
    const attrs: Record<string, string> = {};
    let written: string | undefined;
    const innerWindow = { postMessage: (data: unknown, target: string) => toInner.push({ data, target }) };
    const parent = { postMessage: (data: unknown, target: string) => toParent.push({ data, target }) };
    const listeners: ((event: { data: unknown; origin: string; source: unknown }) => void)[] = [];
    const top = options.topReadable === true ? { document: {} } : Object.defineProperty({}, 'document', { get: () => { throw new Error('cross-origin'); } });
    const inner = {
      contentWindow: innerWindow,
      contentDocument: { open() {}, write(h: string) { written = h; }, close() {} },
      setAttribute: (k: string, v: string) => { attrs[k] = v; },
    };
    const win: Record<string, unknown> = {
      location: { origin: SANDBOX },
      parent,
      top,
      addEventListener: (type: string, fn: (typeof listeners)[number]) => { if (type === 'message') listeners.push(fn); },
    };
    win.self = win;
    const document = { createElement: () => inner, body: { appendChild() {} } };
    runInNewContext(script, { window: win, document });
    const send = (data: unknown, origin: string, source: unknown) => listeners.forEach((fn) => fn({ data, origin, source }));
    return { toParent, toInner, attrs, written: () => written, send, parent, innerWindow };
  }

  it('refuses to start when it can read the host page', () => {
    expect(() => runProxy({ topReadable: true })).toThrow(/isolation is broken/);
  });

  it('announces itself only to the host origin, never to *', () => {
    const p = runProxy();
    expect(p.toParent).toEqual([{ data: { jsonrpc: '2.0', method: 'ui/notifications/sandbox-proxy-ready', params: {} }, target: HOST }]);
  });

  it('drops parent messages from any origin but the host, so a foreign page cannot inject HTML', () => {
    const p = runProxy();
    const inject = { jsonrpc: '2.0', method: 'ui/notifications/sandbox-resource-ready', params: { html: '<script>steal()</script>', sandbox: 'allow-scripts allow-top-navigation' } };
    for (const origin of ['https://evil.example', SANDBOX, 'null']) p.send(inject, origin, p.parent);
    p.send({ jsonrpc: '2.0', id: 1, method: 'tools/call' }, 'https://evil.example', p.parent);
    expect(p.written()).toBeUndefined();
    expect(p.attrs.sandbox).toBe(SANDBOX_ATTRIBUTE);
    expect(p.toInner).toHaveLength(0);
  });

  it('relays host messages to the view on the sandbox origin and stops sandbox-* notifications', () => {
    const p = runProxy();
    p.send({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-resource-ready', params: { html: '<p>Mon</p>' } }, HOST, p.parent);
    expect(p.written()).toBe('<p>Mon</p>');
    p.send({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-anything', params: {} }, HOST, p.parent);
    p.send({ jsonrpc: '2.0', id: 7, result: {} }, HOST, p.parent);
    expect(p.toInner).toEqual([{ data: { jsonrpc: '2.0', id: 7, result: {} }, target: SANDBOX }]);
  });

  it('forwards view messages to the host only, and drops ones from other sources or origins', () => {
    const p = runProxy();
    const before = p.toParent.length;
    p.send({ jsonrpc: '2.0', id: 1, method: 'tools/call' }, SANDBOX, p.innerWindow);
    p.send({ jsonrpc: '2.0', id: 2, method: 'tools/call' }, 'null', p.innerWindow);
    p.send({ jsonrpc: '2.0', id: 3, method: 'tools/call' }, SANDBOX, { postMessage() {} });
    expect(p.toParent.slice(before)).toEqual([{ data: { jsonrpc: '2.0', id: 1, method: 'tools/call' }, target: HOST }]);
  });
});
