import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildViewCsp, parseCspParam } from '../src/shared/csp.ts';

/**
 * The MCP Apps sandbox proxy, served on its own origin. The view's CSP rides on
 * the URL (`?csp=<json>`) and goes out here as an HTTP header, which the view's
 * HTML can't loosen; the inner iframe the proxy writes inherits it.
 * `frame-ancestors` pins the proxy to the simulator page.
 */

const PROXY_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../sandbox/proxy.html');

export function sandboxHeaders(search: string, hostOrigin: string): Record<string, string> {
  const csp = parseCspParam(new URLSearchParams(search).get('csp'));
  return {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': `${buildViewCsp(csp)}; frame-ancestors ${hostOrigin}`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
}

export function sandboxDocument(hostOrigin: string): string {
  // JSON.stringify keeps the injected origin a well-formed JS string literal.
  return readFileSync(PROXY_PATH, 'utf8').replace("'__HOST_ORIGIN__'", JSON.stringify(hostOrigin));
}
