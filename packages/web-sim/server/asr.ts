import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

/**
 * Live speech-to-text for the simulator's mic: the page streams 16 kHz mono
 * PCM over a WebSocket, and this relays it to NVIDIA's hosted Parakeet
 * (Riva StreamingRecognize on NVCF) and sends back interim and final text.
 *
 * Why not the browser's Web Speech: it has no echo cancellation (it heard the
 * Mon through the speakers), and it heard "Callah" as "Carla" and "color".
 * The page records with getUserMedia's echo cancellation on, so the mic can
 * stay open while the Mon talks and the person can cut in; Parakeet takes a
 * word list, so the Mon's names come through.
 *
 * Protos: riva_asr, riva_audio and riva_common from github.com/nvidia-riva/common
 * (riva/proto, commit 268890b), vendored unmodified (MIT) into ./asr-proto.
 * Simulator only: on a real Echo, Alexa does the listening.
 */

export const ASR_URI = 'grpc.nvcf.nvidia.com:443';
/** NVCF function for parakeet-ctc-1.1b-asr (streaming). Verified live 2026-10-24. */
export const ASR_FUNCTION_ID = '1598d209-5e27-4d3c-8079-4751568b1081';
export const ASR_SAMPLE_RATE = 16_000;
/** Words Parakeet should favour: the Mon's names and how the Caller is addressed. */
export const ASR_PHRASES = ['Callah', 'Caller', "Lil' Ratti", 'Squeaklet', 'Metro Egg', 'Hood Ratti', 'Mon', 'NYC-MON', 'bet', 'say less', 'my G'];
/** Measured: without the boost Parakeet heard "Lil Ray" and "calls"; with it, "Lil' Ratti" and "Callah". */
const PHRASE_BOOST = 20;
/** One listening session at most this long; the page reconnects for the next. */
export const ASR_MAX_SESSION_MS = 10 * 60_000;
/** 100 ms of 16 kHz s16 is 3200 bytes; anything far past a second is not mic audio. */
const MAX_FRAME_BYTES = 64 * 1024;

export type AsrEvent = { type: 'ready' } | { type: 'interim' | 'final'; text: string } | { type: 'error'; message: string };

/** One recognition stream: write PCM, read events. Tests pass a fake. */
export interface AsrStream {
  write(pcm: Buffer): void;
  end(): void;
}
export type OpenAsrStream = (onEvent: (e: AsrEvent) => void) => AsrStream;

const PROTO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'asr-proto');

interface RecognizeResponse {
  results: { alternatives: { transcript: string }[]; is_final: boolean }[];
}

/** Riva StreamingRecognize over NVCF: TLS, bearer and function-id metadata. */
export function createParakeetStream(opts: { apiKey: string; functionId?: string }): OpenAsrStream {
  const def = protoLoader.loadSync('riva/proto/riva_asr.proto', { keepCase: true, longs: Number, enums: String, defaults: true, includeDirs: [PROTO_DIR] });
  const pkg = grpc.loadPackageDefinition(def) as unknown as {
    nvidia: { riva: { asr: { RivaSpeechRecognition: new (uri: string, creds: grpc.ChannelCredentials) => grpc.Client } } };
  };
  const client = new pkg.nvidia.riva.asr.RivaSpeechRecognition(ASR_URI, grpc.credentials.createSsl()) as unknown as {
    StreamingRecognize: (m: grpc.Metadata) => grpc.ClientDuplexStream<object, RecognizeResponse>;
  };
  return (onEvent) => {
    const metadata = new grpc.Metadata();
    metadata.set('function-id', opts.functionId ?? ASR_FUNCTION_ID);
    metadata.set('authorization', `Bearer ${opts.apiKey}`);
    const call = client.StreamingRecognize(metadata);
    let closed = false;
    call.on('data', (r: RecognizeResponse) => {
      for (const result of r.results) {
        const text = result.alternatives[0]?.transcript.trim() ?? '';
        if (text) onEvent({ type: result.is_final ? 'final' : 'interim', text });
      }
    });
    call.on('error', (err: grpc.ServiceError) => {
      // Cancelled is our own end(); anything else the page hears about.
      if (!closed && err.code !== grpc.status.CANCELLED) onEvent({ type: 'error', message: 'Speech recognition stopped. Tap Talk to try again.' });
    });
    call.write({
      streaming_config: {
        config: {
          encoding: 'LINEAR_PCM',
          sample_rate_hertz: ASR_SAMPLE_RATE,
          language_code: 'en-US',
          max_alternatives: 1,
          enable_automatic_punctuation: true,
          audio_channel_count: 1,
          speech_contexts: [{ phrases: ASR_PHRASES, boost: PHRASE_BOOST }],
        },
        interim_results: true,
      },
    });
    return {
      write: (pcm) => {
        if (!closed) call.write({ audio_content: pcm });
      },
      end: () => {
        if (closed) return;
        closed = true;
        call.end();
      },
    };
  };
}

export interface AsrSocketDeps {
  readonly open: OpenAsrStream;
  readonly allowedOrigin: string;
  /** Checks the first message's bearer token (the same check /api/model uses); absent in dev-bypass. */
  readonly auth?: (authorization: string | null) => Promise<unknown>;
  readonly rateLimit: (key: string) => boolean;
  readonly clientKey: (req: IncomingMessage) => string;
  readonly maxSessionMs?: number;
}

/**
 * `/api/asr` WebSocket. The page sends `{"type":"start","token":"…"}` first (a
 * browser WebSocket cannot set headers, and a token never goes in the URL),
 * waits for `{"type":"ready"}`, then sends binary PCM frames. The server sends
 * AsrEvent JSON back.
 */
export function createAsrSocket(deps: AsrSocketDeps) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });

  const serve = (ws: WebSocket) => {
    let stream: AsrStream | null = null;
    let starting = false;
    const send = (e: AsrEvent) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(e));
    };
    const limit = setTimeout(() => ws.close(1000, 'session limit'), deps.maxSessionMs ?? ASR_MAX_SESSION_MS);
    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        stream?.write(Buffer.isBuffer(data) ? data : Buffer.concat(data as Buffer[]));
        return;
      }
      if (stream || starting) return;
      starting = true;
      let token: unknown;
      try {
        token = (JSON.parse(String(data)) as { token?: unknown }).token;
      } catch {
        return void ws.close(1008, 'bad start');
      }
      const check = deps.auth ? deps.auth(typeof token === 'string' && token ? `Bearer ${token}` : null) : Promise.resolve();
      check.then(
        () => {
          if (ws.readyState !== ws.OPEN) return;
          stream = deps.open((e) => {
            send(e);
            if (e.type === 'error') ws.close(1011, 'recognizer error');
          });
          send({ type: 'ready' });
        },
        () => ws.close(1008, 'unauthorized'),
      );
    });
    ws.on('close', () => {
      clearTimeout(limit);
      stream?.end();
      stream = null;
    });
    ws.on('error', () => ws.close());
  };

  /** Hand an HTTP upgrade for /api/asr here; false when it is not ours. */
  return function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    if (new URL(req.url ?? '/', deps.allowedOrigin).pathname !== '/api/asr') return false;
    const reject = (status: string) => {
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
      return true;
    };
    // Same-origin pages only: a WebSocket is not covered by CORS.
    if (req.headers.origin !== deps.allowedOrigin) return reject('403 Forbidden');
    if (!deps.rateLimit(deps.clientKey(req))) return reject('429 Too Many Requests');
    wss.handleUpgrade(req, socket, head, serve);
    return true;
  };
}
