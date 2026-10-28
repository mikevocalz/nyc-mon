import type Anthropic from '@anthropic-ai/sdk';
import type { ModelClient, ModelTurnRequest } from '../shared/agentLoop.ts';
import { AuthExpiredError, bearer, noAuthorize, type Authorize } from './freshToken.ts';

/** Raised with a message meant for the screen. */
export class ModelTurnError extends Error {
  override readonly name = 'ModelTurnError';
  readonly retry: boolean;
  constructor(message: string, retry: boolean) {
    super(message);
    this.retry = retry;
  }
}

/** A 401 from /api/model requires a new OAuth sign-in, not a model retry. */
export class ModelAuthExpiredError extends Error {
  override readonly name = 'ModelAuthExpiredError';
  constructor() { super('Your sign-in expired. Sign in again to keep talking.'); }
}

type WireEvent =
  | { type: 'text'; delta: string }
  | { type: 'message'; message: Anthropic.Message }
  | { type: 'error'; message: string; retry: boolean };

/** Parse SSE frames out of a growing buffer; returns the unconsumed tail. */
export function drainSse(buffer: string, onEvent: (e: WireEvent) => void): string {
  let rest = buffer;
  for (let idx = rest.indexOf('\n\n'); idx !== -1; idx = rest.indexOf('\n\n')) {
    const frame = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    const data = frame
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6))
      .join('\n');
    if (!data) continue;
    let event: WireEvent;
    try {
      event = JSON.parse(data) as WireEvent;
    } catch {
      // A garbled frame becomes a visible error, never a thrown parse error.
      event = { type: 'error', message: 'The reply came back garbled. Try again.', retry: true };
    }
    onEvent(event);
  }
  return rest;
}

/** The browser half of /api/model. */
/**
 * The browser half of /api/model. `authorize` (freshToken.ts) supplies the
 * person's MCP access token in OAuth mode, refreshed when it is about to lapse
 * and retried once on a 401; the server checks it before spending a model turn.
 */
export function httpModelClient(endpoint = '/api/model', fetchFn: typeof fetch = fetch, authorize: Authorize = noAuthorize): ModelClient {
  return {
    async streamTurn(req: ModelTurnRequest, onText, signal) {
      let res: Response;
      try {
        res = await authorize((token) =>
          fetchFn(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...bearer(token) },
            body: JSON.stringify({ messages: req.messages, tools: req.tools }),
            signal,
          }),
        );
      } catch (err) {
        if (err instanceof AuthExpiredError) throw new ModelAuthExpiredError();
        throw err;
      }
      if (res.status === 401) throw new ModelAuthExpiredError();
      if (!res.ok || !res.body) {
        let message = 'The simulator server didn’t answer. Check that it’s running.';
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error && body.error.includes(' ')) message = body.error;
        } catch {
          /* keep the default */
        }
        throw new ModelTurnError(message, res.status === 429 || res.status >= 500);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      let final: Anthropic.Message | null = null;
      let failure: ModelTurnError | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = drainSse(buffer + value, (e) => {
          if (e.type === 'text') onText(e.delta);
          else if (e.type === 'message') final = e.message;
          else failure = new ModelTurnError(e.message, e.retry);
        });
      }
      if (failure) throw failure;
      if (!final) throw new ModelTurnError('The reply was cut off. Try again.', true);
      return final;
    },
  };
}
