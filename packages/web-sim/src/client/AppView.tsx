import { useEffect, useEffectEvent, useRef } from 'react';
import type { CallToolResult, Client, Tool } from '@modelcontextprotocol/client';
import { AppBridge, PostMessageTransport, isToolVisibilityModelOnly, type McpUiResourceCsp } from '@modelcontextprotocol/ext-apps/app-bridge';
import { Button, useInstanceStore, useStore } from '@acme/ui';
import { SPEECH_CONTEXT_KEY, type MonSpeechCue } from '@acme/ui/three/mon/lipsync';
import { Paragraph } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { HOST_ONLY_TOOLS } from '../shared/toolSpec.ts';
import { sandboxUrl } from '../shared/csp.ts';
import { MCP_APP_MIME } from './mcp.ts';
import { hostStyleVariables, type Scheme } from './theme.ts';
import { useSetters } from './state.ts';
import { ViewFrame } from './ViewFrame.tsx';
import { addSpeechCueListener, currentSpeechCue, listeningNow } from './speechCues.ts';
import { createHostHatchSound, isFreshHatch, pageAudioContext, parseHatchStart } from './hatchSound.ts';
import { setSpeechDuck } from './speech.ts';

/**
 * Hosts one MCP Apps view (spec 2026-01-26): reads the ui:// resource, loads
 * the sandbox proxy on its own origin with the view's CSP, connects an
 * AppBridge over postMessage, then sends the tool input and result. Tool calls
 * and resource reads from the view go through the bridge to the MCP server.
 * Inline and fullscreen are the same iframe; the frame only changes size, so
 * the view keeps its state.
 */

export type DisplayMode = 'inline' | 'fullscreen';

export interface AppViewProps {
  readonly client: Client;
  readonly tool: Tool | undefined;
  /** Every tool the server listed, to check what a view may call. */
  readonly tools: readonly Tool[];
  readonly toolName: string;
  readonly title: string;
  readonly resourceUri: string;
  readonly input: Record<string, unknown>;
  readonly result: CallToolResult;
  readonly sandboxOrigin: string;
  readonly displayMode: DisplayMode;
  readonly scheme: Scheme;
  readonly onDisplayModeChange: (mode: DisplayMode) => void;
  /** A view proposed text for the conversation (ui/message); the person sends it. */
  readonly onViewMessage: (text: string) => void;
  /**
   * Called before "Try card again" reloads the view, so the host can re-list
   * the server's tools. A rebuilt server serves its views under new URIs; the
   * retry then loads whatever resourceUri the host passes next.
   */
  readonly onRetry?: () => Promise<void>;
  /** "Read replies aloud": with it off the host plays no hatch sound either. */
  readonly soundOn?: boolean;
}

interface LoadedResource {
  readonly html: string;
  readonly csp: McpUiResourceCsp | undefined;
  readonly permissions: Record<string, unknown> | undefined;
}

async function readView(client: Client, uri: string): Promise<LoadedResource> {
  const res = await client.readResource({ uri });
  const content = res.contents[0];
  if (!content) throw new Error('The view is empty.');
  const mime = content.mimeType ?? '';
  if (!mime.startsWith('text/html')) throw new Error(`Unsupported view type ${mime || 'unknown'}.`);
  if (mime !== MCP_APP_MIME) throw new Error(`The view's type is ${mime}, not ${MCP_APP_MIME}.`);
  const html =
    'text' in content && typeof content.text === 'string'
      ? content.text
      : 'blob' in content && typeof content.blob === 'string'
        ? new TextDecoder().decode(Uint8Array.from(atob(content.blob), (c) => c.charCodeAt(0)))
        : '';
  if (!html) throw new Error('The view is empty.');
  const ui = (content._meta as { ui?: { csp?: McpUiResourceCsp; permissions?: Record<string, unknown> } } | undefined)?.ui;
  return { html, csp: ui?.csp, permissions: ui?.permissions };
}


export function AppView(props: AppViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  // src: the sandbox proxy URL. available: the display slot's height, sent as
  // maxHeight so an inline view fills the display without overflowing it.
  const store = useInstanceStore<{
    src: string | null;
    available: number;
    status: 'loading' | 'ready' | 'error';
    error: string;
    attempt: number;
  }>(() => ({ src: null, available: 0, status: 'loading', error: '', attempt: 0 }));
  const { src, available, status, error, attempt } = useStore(store);
  const {
    src: setSrc,
    available: setAvailable,
    status: setStatus,
    error: setError,
    attempt: setAttempt,
  } = useSetters(store);
  // The bridge's handlers live as long as the view; these read the props of
  // the latest render, not the render that created the bridge.
  const requestDisplayMode = useEffectEvent((next: DisplayMode) => props.onDisplayModeChange(next));
  const reportViewMessage = useEffectEvent((text: string) => props.onViewMessage(text));
  const ownsResource = useEffectEvent((uri: string) => uri === props.resourceUri);
  const findTool = useEffectEvent((name: string) => props.tools.find((t) => t.name === name));
  const soundOn = useEffectEvent(() => props.soundOn ?? true);
  const isHatchResult = useEffectEvent(() => isFreshHatch(props.toolName, props.result));

  useEffect(() => {
    let disposed = false;
    const iframe = iframeRef.current;
    if (!iframe) return;
    setStatus('loading');
    // The hatch's sound, when the view cannot play it (hatchSound.ts).
    const hatchSound = createHostHatchSound({
      audio: pageAudioContext,
      soundOn,
      reducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
      duckSpeech: setSpeechDuck,
    });
    if (isHatchResult()) hatchSound.arm();

    (async () => {
      const view = await readView(props.client, props.resourceUri);
      if (disposed) return;

      const proxyReady = new Promise<void>((resolve) => {
        const onMessage = (e: MessageEvent) => {
          if (e.source === iframe.contentWindow && (e.data as { method?: string })?.method === 'ui/notifications/sandbox-proxy-ready') {
            window.removeEventListener('message', onMessage);
            resolve();
          }
        };
        window.addEventListener('message', onMessage);
      });
      // A fresh proxy document per load: a repeated effect run (StrictMode, a
      // reconnect) would otherwise keep the old document and never hear its
      // one-shot ready message.
      const url = new URL(sandboxUrl(props.sandboxOrigin, view.csp));
      url.searchParams.set('load', Math.random().toString(36).slice(2));
      setSrc(url.href);
      await proxyReady;
      if (disposed || !iframe.contentWindow) return;

      const caps = props.client.getServerCapabilities();
      const bridge = new AppBridge(
        props.client,
        { name: 'nyc-mon-simulator', version: '0.1.0' },
        { openLinks: {}, serverTools: caps?.tools, serverResources: caps?.resources, message: { text: {} }, logging: {} },
        {
          hostContext: {
            theme: props.scheme,
            platform: 'web',
            displayMode: props.displayMode,
            availableDisplayModes: ['inline', 'fullscreen'],
            ...(store.getState().available > 0 ? { maxHeight: store.getState().available } : {}),
            styles: { variables: hostStyleVariables(props.scheme) },
            ...(props.tool ? { toolInfo: { tool: props.tool } } : {}),
          } as never,
        },
      );
      bridgeRef.current = bridge;

      bridge.onrequestdisplaymode = async ({ mode }) => {
        const next: DisplayMode = mode === 'fullscreen' ? 'fullscreen' : 'inline';
        requestDisplayMode(next);
        return { mode: next };
      };
      bridge.onopenlink = async ({ url }) => {
        if (/^https:\/\//.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
        return {};
      };
      bridge.onmessage = async ({ content }) => {
        const text = (content ?? [])
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join(' ')
          .trim();
        if (text) reportViewMessage(text.slice(0, 500));
        return {};
      };
      bridge.onupdatemodelcontext = async () => ({});
      // The view says when its hatch starts and whether it plays the sound itself.
      bridge.addEventListener('loggingmessage', (params) => {
        const report = parseHatchStart(params);
        if (report && !disposed) void hatchSound.onViewStart(report);
      });
      // A view reads only its own resource, not every resource on the server.
      bridge.onreadresource = async (params) => {
        if (!ownsResource(params.uri)) throw new Error('This view can only read its own resource.');
        return props.client.readResource(params);
      };
      // A view may call app-visible tools only: never the dev presence hook,
      // never a tool the server marked model-only (MCP Apps visibility).
      bridge.oncalltool = async (params) => {
        const target = findTool(params.name);
        if (!target || HOST_ONLY_TOOLS.has(params.name) || isToolVisibilityModelOnly(target)) {
          return { content: [{ type: 'text', text: `This view can't call ${params.name}.` }], isError: true };
        }
        const result = await props.client.callTool(params);
        // The Hatch button: the view had the tap, so it normally plays; the host covers it if it cannot.
        if (isFreshHatch(params.name, result as never)) hatchSound.arm();
        return result as never;
      };

      const initialized = new Promise<void>((resolve) => {
        bridge.oninitialized = () => resolve();
      });
      await bridge.connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow));
      await bridge.sendSandboxResourceReady({ html: view.html, csp: view.csp, permissions: view.permissions as never });
      await initialized;
      if (disposed) return;
      await bridge.sendToolInput({ arguments: props.input });
      await bridge.sendToolResult(props.result as never);
      setStatus('ready');
    })().catch((err: unknown) => {
      if (disposed) return;
      console.error('[web-sim] view failed', err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    });

    return () => {
      disposed = true;
      hatchSound.dispose();
      const bridge = bridgeRef.current;
      bridgeRef.current = null;
      if (bridge) {
        void bridge.teardownResource({}).catch(() => {}).finally(() => void bridge.close());
      }
    };
    // The view is keyed by tool call; a new call mounts a new AppView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.client, props.resourceUri, props.sandboxOrigin, attempt]);

  // The slot around the frame is the display's free space; report it as it changes.
  useEffect(() => {
    const el = iframeRef.current?.parentElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setAvailable(Math.floor(entry?.contentRect.height ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setAvailable]);

  useEffect(() => {
    if (available > 0) void bridgeRef.current?.sendHostContextChange({ maxHeight: available } as never);
  }, [available]);

  useEffect(() => {
    void bridgeRef.current?.sendHostContextChange({ displayMode: props.displayMode });
  }, [props.displayMode]);

  // The Mon's voice, as one cue per utterance through the host context's
  // extension room (McpUiHostContext allows extra keys). The view aligns the
  // mouth to the audio from the cue's elapsedMs; no per-frame messages.
  // A view that becomes ready mid-sentence gets that sentence's cue then.
  useEffect(() => {
    if (status !== 'ready') return;
    const send = (cue: MonSpeechCue) =>
      void Promise.resolve(bridgeRef.current?.sendHostContextChange({ [SPEECH_CONTEXT_KEY]: cue } as never)).catch(() => {});
    const now = currentSpeechCue();
    if (now) send(now);
    if (listeningNow()) send({ kind: 'listen', id: 'mic', on: true });
    return addSpeechCueListener(send);
  }, [status]);

  useEffect(() => {
    void bridgeRef.current?.sendHostContextChange({
      theme: props.scheme,
      styles: { variables: hostStyleVariables(props.scheme) },
    } as never);
  }, [props.scheme]);

  return (
    <View className="relative min-h-0 flex-1 overflow-hidden">
      {status === 'error' ? (
        <View className="gap-3 p-4">
          <Paragraph role="alert" className="my-0 text-sm text-danger">
            This card didn’t load: {error}
          </Paragraph>
          <View className="flex-row">
            <Button
              variant="outline"
              size="sm"
              title="Try card again"
              onPress={() => {
                setError('');
                setStatus('loading');
                void (props.onRetry?.() ?? Promise.resolve())
                  .catch(() => {})
                  .finally(() => setAttempt((value) => value + 1));
              }}
            />
          </View>
        </View>
      ) : null}
      <ViewFrame
        ref={iframeRef}
        title={props.title}
        src={src ?? undefined}
        hidden={status === 'error'}
        status={status}
        // The view fits whatever height it is given (MonView), so the frame fills its slot and nothing scrolls.
        style={{ height: '100%' }}
      />
      {status === 'loading' ? <Paragraph className="my-0 p-4 text-sm text-text-secondary">Loading view…</Paragraph> : null}
    </View>
  );
}
