import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

/**
 * Node HTTP <-> fetch Request/Response for nvidia-main.ts, kept apart because
 * nvidia-main.ts starts a server on import.
 *
 * Cancellation matters here: when the page aborts /api/model (the Caller
 * talked over the Mon), the socket closes, `sendResponse` cancels the body
 * reader, and the model handler aborts the Nebius request it is waiting on.
 */
export function nodeRequest(req: IncomingMessage, publicOrigin: string): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Readable.toWeb(req);
  const controller = new AbortController();
  req.on('aborted', () => controller.abort());
  return new Request(new URL(req.url ?? '/', publicOrigin), {
    method: req.method, headers, signal: controller.signal,
    ...(body ? { body, duplex: 'half' } : {}),
  } as RequestInit);
}

export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) { res.end(); return; }
  const reader = response.body.getReader();
  res.on('close', () => { void reader.cancel().catch(() => {}); });
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      res.write(part.value);
    }
  } catch {
    // The reader was cancelled because the page went away; nothing to send.
  } finally {
    reader.releaseLock();
    res.end();
  }
}

/**
 * Rate-limit key for /api/asr upgrades. Behind Render's proxy every socket
 * comes from the proxy, so the first X-Forwarded-For hop is the Caller.
 */
export function asrClientKey(req: { headers: IncomingMessage['headers']; socket: { remoteAddress?: string | undefined } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}
