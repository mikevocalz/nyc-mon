import { useEffect, useRef } from 'react';
import type { CallToolResult, Client, Tool } from '@modelcontextprotocol/client';
import { AppBridge, PostMessageTransport, isToolVisibilityModelOnly, type McpUiResourceCsp } from '@modelcontextprotocol/ext-apps/app-bridge';
import { useInstanceStore, useStore } from '@acme/ui';
import { Paragraph } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { HOST_ONLY_TOOLS } from '../shared/toolSpec.ts';
import { sandboxUrl } from '../shared/csp.ts';
import { MCP_APP_MIME } from './mcp.ts';
import { hostStyleVariables, type Scheme } from './theme.ts';
import { useSetters } from './state.ts';
import { ViewFrame } from './ViewFrame.tsx';

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
  // src: the sandbox proxy URL. height: the content height the view reports
  // (ui/notifications/size-changed). available: the display's height, the cap.
  const store = useInstanceStore<{
    src: string | null;
    height: number;
    available: number;
    status: 'loading' | 'ready' | 'error';
    error: string;
  }>(() => ({ src: null, height: 320, available: 0, status: 'loading', error: '' }));
  const { src, height, available, status, error } = useStore(store);
  const { src: setSrc, height: setHeight, available: setAvailable, status: setStatus, error: setError } = useSetters(store);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let disposed = false;
    const iframe = iframeRef.current;
    if (!iframe) return;
    setStatus('loading');

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
        { openLinks: {}, serverTools: caps?.tools, serverResources: caps?.resources, message: { text: {} } },
        {
          hostContext: {
            theme: props.scheme,
            platform: 'web',
            displayMode: props.displayMode,
            availableDisplayModes: ['inline', 'fullscreen'],
            styles: { variables: hostStyleVariables(props.scheme) },
            ...(props.tool ? { toolInfo: { tool: props.tool } } : {}),
          } as never,
        },
      );
      bridgeRef.current = bridge;

      bridge.onrequestdisplaymode = async ({ mode }) => {
        const next: DisplayMode = mode === 'fullscreen' ? 'fullscreen' : 'inline';
        latest.current.onDisplayModeChange(next);
        return { mode: next };
      };
      bridge.onsizechange = ({ height: h }) => {
        if (typeof h === 'number' && h > 0) setHeight(Math.ceil(h));
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
        if (text) latest.current.onViewMessage(text.slice(0, 500));
        return {};
      };
      bridge.onupdatemodelcontext = async () => ({});
      // A view reads only its own resource, not every resource on the server.
      bridge.onreadresource = async (params) => {
        if (params.uri !== latest.current.resourceUri) throw new Error('This view can only read its own resource.');
        return props.client.readResource(params);
      };
      // A view may call app-visible tools only: never the dev presence hook,
      // never a tool the server marked model-only (MCP Apps visibility).
      bridge.oncalltool = async (params) => {
        const target = latest.current.tools.find((t) => t.name === params.name);
        if (!target || HOST_ONLY_TOOLS.has(params.name) || isToolVisibilityModelOnly(target)) {
          return { content: [{ type: 'text', text: `This view can't call ${params.name}.` }], isError: true };
        }
        return (await props.client.callTool(params)) as never;
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
      const bridge = bridgeRef.current;
      bridgeRef.current = null;
      if (bridge) {
        void bridge.teardownResource({}).catch(() => {}).finally(() => void bridge.close());
      }
    };
    // The view is keyed by tool call; a new call mounts a new AppView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.client, props.resourceUri, props.sandboxOrigin]);

  // Track the stage space so the inline frame never runs past the display.
  useEffect(() => {
    // The canvas is the display itself; the slot around the frame scrolls when
    // the view is taller than the space beside the reply.
    const el = (iframeRef.current?.closest('[aria-label="Smart display"]') as HTMLElement | null) ?? null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setAvailable(Math.floor(entry?.contentRect.height ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setAvailable]);

  useEffect(() => {
    void bridgeRef.current?.sendHostContextChange({ displayMode: props.displayMode });
  }, [props.displayMode]);

  useEffect(() => {
    void bridgeRef.current?.sendHostContextChange({
      theme: props.scheme,
      styles: { variables: hostStyleVariables(props.scheme) },
    } as never);
  }, [props.scheme]);

  return (
    <View className="relative min-h-0 flex-1 overflow-y-auto">
      {status === 'error' ? (
        <Paragraph role="alert" className="my-0 p-4 text-sm text-danger">
          This view didn’t load: {error}
        </Paragraph>
      ) : null}
      <ViewFrame
        ref={iframeRef}
        title={props.title}
        src={src ?? undefined}
        hidden={status === 'error'}
        status={status}
        style={{ height: props.displayMode === 'inline' ? (available > 0 ? Math.min(height, available) : height) : '100%' }}
      />
      {status === 'loading' ? <Paragraph className="my-0 p-4 text-sm text-text-secondary">Loading view…</Paragraph> : null}
    </View>
  );
}
