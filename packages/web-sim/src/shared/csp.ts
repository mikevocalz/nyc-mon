import type { McpUiResourceCsp } from '@modelcontextprotocol/ext-apps/app-bridge';

/**
 * Content Security Policy for one MCP Apps view, built from the resource's
 * `_meta.ui.csp` (MCP Apps spec 2026-01-26, "Content Security Policy
 * Enforcement"). Only declared origins are allowed; with no declaration the
 * view gets no network at all. The policy goes out as an HTTP header on the
 * sandbox document, which the view's HTML cannot override.
 */

/** Sandbox attribute for both iframes (spec: the sandbox needs scripts + same-origin on its own origin). */
export const SANDBOX_ATTRIBUTE = 'allow-scripts allow-same-origin allow-forms';

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/i;

/**
 * Keep only entries that are plain origins. Dropped: anything that could break
 * out of a directive (`;`, quotes, whitespace), keywords ('unsafe-eval', `*`,
 * `data:`), cleartext http/ws except on loopback, and wildcards that would
 * cover a whole top-level domain (`https://*.com`).
 */
export function sanitizeCspSources(sources: readonly unknown[] | undefined): string[] {
  if (!sources) return [];
  const out: string[] = [];
  for (const s of sources) {
    if (typeof s !== 'string') continue;
    if (/[;,\s'"]/.test(s)) continue;
    const m = /^(https|wss|http|ws):\/\/(\*\.)?((?:[a-z0-9-]+\.)*[a-z0-9-]+|\[::1\])(:\d{1,5})?$/i.exec(s);
    if (!m) continue;
    const [, scheme, wildcard, host] = m;
    const cleartext = scheme === 'http' || scheme === 'ws';
    if (cleartext && !LOOPBACK.test(host ?? '')) continue;
    // A wildcard needs at least two labels after it: *.cdn.example, never *.com.
    if (wildcard && (host ?? '').split('.').length < 2) continue;
    if (!wildcard && !LOOPBACK.test(host ?? '') && !(host ?? '').includes('.')) continue;
    out.push(s);
  }
  return out;
}

export function buildViewCsp(csp: McpUiResourceCsp | undefined): string {
  const resources = sanitizeCspSources(csp?.resourceDomains).join(' ');
  const connect = sanitizeCspSources(csp?.connectDomains).join(' ');
  const frames = sanitizeCspSources(csp?.frameDomains).join(' ');
  const bases = sanitizeCspSources(csp?.baseUriDomains).join(' ');
  const withSources = (head: string, extra: string) => (extra ? `${head} ${extra}` : head);

  return [
    "default-src 'none'",
    withSources("script-src 'self' 'unsafe-inline' blob:", resources),
    withSources("style-src 'self' 'unsafe-inline'", resources),
    withSources("img-src 'self' data: blob:", resources),
    withSources("font-src 'self' data:", resources),
    withSources("media-src 'self' data: blob:", resources),
    // 'none' when nothing is declared: the spec's restrictive default.
    connect ? `connect-src ${connect}` : "connect-src 'none'",
    withSources("worker-src 'self' blob:", resources),
    frames ? `frame-src ${frames}` : "frame-src 'none'",
    "object-src 'none'",
    bases ? `base-uri ${bases}` : "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

/** Parse the `csp` query parameter the host puts on the sandbox URL. */
export function parseCspParam(raw: string | null): McpUiResourceCsp | undefined {
  if (!raw || raw.length > 4096) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return undefined;
    const v = value as Record<string, unknown>;
    const pick = (k: string) => (Array.isArray(v[k]) ? sanitizeCspSources(v[k] as unknown[]) : undefined);
    return {
      connectDomains: pick('connectDomains'),
      resourceDomains: pick('resourceDomains'),
      frameDomains: pick('frameDomains'),
      baseUriDomains: pick('baseUriDomains'),
    };
  } catch {
    return undefined;
  }
}

/** The sandbox proxy URL for one view, with its CSP attached for the server to apply. */
export function sandboxUrl(sandboxOrigin: string, csp: McpUiResourceCsp | undefined): string {
  const url = new URL('/sandbox', sandboxOrigin);
  if (csp) url.searchParams.set('csp', JSON.stringify(csp));
  return url.href;
}
