import { useCallback, useEffect, useMemo, useRef } from 'react';
import type Anthropic from '@anthropic-ai/sdk';
import { UnauthorizedError, type CallToolResult, type Tool } from '@modelcontextprotocol/client';
import { getToolUiResourceUri } from '@modelcontextprotocol/ext-apps/app-bridge';
import { runAgentTurn } from '../shared/agentLoop.ts';
import { SimOAuthProvider, parseCallback, resolveAuthState, type AuthState } from '../shared/auth.ts';
import { mcpToolsToClaude, type ConversionResult } from '../shared/toolSpec.ts';
import { Badge, Banner, BrandWordmark, Button, Card, ErrorMessage, SolidPanel, Switch, TextField, useInstanceStore, useStore } from '@acme/ui';
import { Form, Header, Heading, Paragraph, Section } from '@acme/ui/html';
import { Text, View } from '@acme/ui/tw';
import { AppView, type DisplayMode } from './AppView.tsx';
import { DevPanel } from './DevPanel.tsx';
import { GridBand, GridBandBoundary } from './GridBand.tsx';
import { SignInRequired, beginSignIn, completeSignIn, connectMcp, type McpSession } from './mcp.ts';
import { ModelAuthExpiredError, ModelTurnError, httpModelClient } from './modelClient.ts';
import {
  clearSession,
  historyForNextTurn,
  loadSession,
  newId,
  memoryStore,
  safeStorage,
  saveSession,
  type TranscriptItem,
} from './session.ts';
import { canListen, canSpeak, listen, speak, stopSpeaking, type Listening } from './speech.ts';
import { useSetters } from './state.ts';
import { currentScheme, type Scheme } from './theme.ts';

export interface PublicConfig {
  readonly mcpUrl: string;
  readonly sandboxOrigin: string;
  readonly authMode: 'oauth' | 'dev-bypass';
  readonly clientId: string;
  readonly devMode: boolean;
  readonly modelBackend: 'bedrock' | 'mock';
  readonly modelLabel: string;
}

type Connection =
  | { readonly kind: 'idle' }
  | { readonly kind: 'connecting' }
  | { readonly kind: 'connected'; readonly session: McpSession; readonly conversion: ConversionResult }
  | { readonly kind: 'failed'; readonly message: string };

interface AppState {
  items: TranscriptItem[];
  auth: AuthState;
  conn: Connection;
  busy: boolean;
  live: string;
  draft: string;
  listening: Listening | null;
  heard: string;
  activeViewId: string | null;
  displayMode: DisplayMode;
  scheme: Scheme;
  readAloud: boolean;
  time: string;
}

const SUGGESTIONS = ['How’s my Mon doing?', 'Are you hungry?', 'Who’s here right now?'];
const CALLBACK_PATH = '/oauth/callback';

function toolTitle(tool: Tool | undefined, name: string): string {
  return tool?.annotations?.title ?? tool?.title ?? name.replace(/_/g, ' ');
}

function resultUiUri(result: CallToolResult): string | null {
  const ui = (result._meta as { ui?: { resourceUri?: unknown } } | undefined)?.ui;
  return typeof ui?.resourceUri === 'string' ? ui.resourceUri : null;
}

function clock(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function App({ config }: { config: PublicConfig }) {
  const local = useMemo(() => safeStorage('local'), []);
  const sessionStore = useMemo(() => safeStorage('session'), []);
  const provider = useMemo(
    () =>
      new SimOAuthProvider({
        clientId: config.clientId,
        store: sessionStore ?? memoryStore(),
        redirectUrl: new URL(CALLBACK_PATH, window.location.origin).href,
        navigate: (url) => window.location.assign(url.href),
      }),
    [config.clientId, sessionStore],
  );

  const initial = useMemo(() => loadSession(local), [local]);
  const store = useInstanceStore<AppState>(() => ({
    items: initial.items,
    auth: resolveAuthState(config.authMode, provider),
    conn: { kind: 'idle' },
    busy: false,
    live: '',
    draft: '',
    listening: null,
    heard: '',
    activeViewId: [...initial.items].reverse().find((i) => i.kind === 'tool' && i.resourceUri)?.id ?? null,
    displayMode: 'inline',
    scheme: currentScheme(),
    readAloud: (() => {
      try {
        return local?.getItem('nyc-mon-sim.read-aloud') !== '0';
      } catch {
        return true;
      }
    })(),
    time: clock(),
  }));
  const { items, auth, conn, busy, live, draft, listening, heard, activeViewId, displayMode, scheme, readAloud, time } = useStore(store);
  const {
    items: setItems,
    auth: setAuth,
    conn: setConn,
    busy: setBusy,
    live: setLive,
    draft: setDraft,
    listening: setListening,
    heard: setHeard,
    activeViewId: setActiveViewId,
    displayMode: setDisplayMode,
    scheme: setScheme,
    readAloud: setReadAloud,
    time: setTime,
  } = useSetters(store);
  const historyRef = useRef<Anthropic.MessageParam[]>(initial.history);
  const abortRef = useRef<AbortController | null>(null);
  const model = useMemo(
    () =>
      httpModelClient('/api/model', fetch, () =>
        config.authMode === 'oauth' ? (provider.tokens() as { access_token?: string } | undefined)?.access_token : undefined,
      ),
    [config.authMode, provider],
  );

  const push = useCallback((item: TranscriptItem) => setItems((prev) => [...prev, item]), [setItems]);
  const notice = useCallback(
    (text: string, tone: 'info' | 'error') => push({ kind: 'notice', id: newId('n'), text, tone, at: Date.now() }),
    [push],
  );

  // Persist the transcript and history after every change.
  useEffect(() => {
    saveSession(local, { version: 1, items, history: historyRef.current, savedAt: Date.now() });
  }, [items, local]);

  useEffect(() => {
    const t = window.setInterval(() => setTime(clock()), 15_000);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => setScheme(currentScheme());
    mq.addEventListener('change', onScheme);
    return () => {
      window.clearInterval(t);
      mq.removeEventListener('change', onScheme);
    };
  }, [setScheme, setTime]);

  // Keep the newest transcript line in view. The log is a layout View, found in the DOM.
  useEffect(() => {
    const log = document.querySelector<HTMLElement>('[role="log"]');
    if (log) log.scrollTop = log.scrollHeight;
  }, [items, live]);

  // OAuth redirect back from the authorization server.
  useEffect(() => {
    if (window.location.pathname !== CALLBACK_PATH) return;
    const parsed = parseCallback(window.location.search);
    window.history.replaceState(null, '', '/');
    if (!parsed.ok) {
      setAuth({ kind: 'error', message: parsed.message });
      return;
    }
    if (!provider.consumeState(parsed.state)) {
      setAuth({ kind: 'error', message: 'That sign-in link is stale or came from another tab. Sign in again.' });
      return;
    }
    setAuth({ kind: 'signing-in' });
    completeSignIn(config.mcpUrl, provider, parsed.code, parsed.iss)
      .then(() => setAuth(resolveAuthState(config.authMode, provider)))
      .catch((err: unknown) => setAuth({ kind: 'error', message: err instanceof Error ? err.message : String(err) }));
  }, [config.authMode, config.mcpUrl, provider, setAuth]);

  const connect = useCallback(async () => {
    setConn({ kind: 'connecting' });
    try {
      const session = await connectMcp({ url: config.mcpUrl, mode: config.authMode, provider });
      setConn({ kind: 'connected', session, conversion: mcpToolsToClaude(session.tools) });
    } catch (err) {
      if (err instanceof SignInRequired) {
        provider.invalidateCredentials('tokens');
        setAuth({ kind: 'signed-out' });
        setConn({ kind: 'idle' });
        return;
      }
      setConn({
        kind: 'failed',
        message: `Can’t reach the NYC-MON server at ${new URL(config.mcpUrl).host}. Check that it’s running, then retry.`,
      });
    }
  }, [config.authMode, config.mcpUrl, provider, setAuth, setConn]);

  useEffect(() => {
    if ((auth.kind === 'dev-bypass' || auth.kind === 'signed-in') && conn.kind === 'idle') void connect();
  }, [auth.kind, conn.kind, connect]);

  const session = conn.kind === 'connected' ? conn.session : null;
  const toolsByName = useMemo(() => new Map((session?.tools ?? []).map((t) => [t.name, t])), [session]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy || conn.kind !== 'connected') return;
      stopSpeaking();
      setDraft('');
      setHeard('');
      setBusy(true);
      setLive('');
      push({ kind: 'user', id: newId('u'), text, at: Date.now() });

      const { history, restarted } = historyForNextTurn(historyRef.current);
      if (restarted) notice('Long conversation: the Mon starts a fresh thread. Its state on the server is unchanged.', 'info');
      const abort = new AbortController();
      abortRef.current = abort;
      const { session: s, conversion } = conn;
      try {
        const turn = await runAgentTurn({
          model,
          tools: conversion.tools,
          history,
          userText: text,
          signal: abort.signal,
          mcp: { callTool: (name, args) => s.client.callTool({ name, arguments: args }) as Promise<CallToolResult> },
          onEvent: (e) => {
            if (e.type === 'text') setLive((prev) => prev + e.delta);
            if (e.type === 'step-done') setLive('');
            if (e.type === 'tool-result') {
              const tool = toolsByName.get(e.name);
              const uri = (tool ? getToolUiResourceUri(tool) : undefined) ?? resultUiUri(e.result);
              const id = newId('t');
              push({
                kind: 'tool',
                id,
                name: e.name,
                title: toolTitle(tool, e.name),
                input: e.input,
                result: e.result,
                resourceUri: uri ?? null,
                at: Date.now(),
              });
              if (uri) {
                setActiveViewId(id);
                setDisplayMode('inline');
              }
            }
          },
        });
        historyRef.current = turn.history;
        const reply =
          turn.outcome === 'refused'
            ? 'I can’t help with that one. Ask me something else about your Mon.'
            : turn.reply.trim() || (turn.outcome === 'step-limit' ? 'That took too many steps. Ask again more simply.' : '');
        if (reply) {
          push({ kind: 'mon', id: newId('m'), text: reply, at: Date.now() });
          if (readAloud) speak(reply);
        }
        if (turn.outcome === 'truncated') notice('The reply was cut off before a tool call finished. Ask again.', 'error');
      } catch (err) {
        if (abort.signal.aborted) {
          notice('Stopped.', 'info');
        } else if ((err instanceof UnauthorizedError || err instanceof ModelAuthExpiredError)) {
          provider.invalidateCredentials('tokens');
          setAuth({ kind: 'signed-out' });
          setConn({ kind: 'idle' });
          notice('Your sign-in expired. Sign in again to keep talking.', 'error');
        } else if (err instanceof ModelTurnError) {
          notice(err.message, 'error');
        } else {
          notice(`Something broke mid-reply: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      } finally {
        setLive('');
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, conn, model, notice, provider, push, readAloud, toolsByName, setActiveViewId, setAuth, setBusy, setConn, setDisplayMode, setDraft, setHeard, setLive],
  );

  function startListening() {
    if (listening || busy) return;
    stopSpeaking();
    const l = listen({
      onInterim: setHeard,
      onFinal: (t) => void send(t),
      onError: (m) => notice(m, 'error'),
    });
    setListening(l);
  }
  function stopListening() {
    listening?.finish();
    setListening(null);
  }

  function toggleTheme() {
    const next: Scheme = scheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setScheme(next);
  }

  function newConversation() {
    abortRef.current?.abort();
    stopSpeaking();
    historyRef.current = [];
    clearSession(local);
    setItems([]);
    setActiveViewId(null);
    setDisplayMode('inline');
  }

  function signOut() {
    provider.signOut();
    newConversation();
    void session?.close();
    setConn({ kind: 'idle' });
    setAuth({ kind: 'signed-out' });
  }

  useEffect(() => {
    if (displayMode !== 'fullscreen') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDisplayMode('inline');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [displayMode, setDisplayMode]);

  const lastMon = [...items].reverse().find((i) => i.kind === 'mon');
  const headline = live || (busy ? '' : lastMon?.kind === 'mon' ? lastMon.text : '');
  const activeView = items.find((i): i is Extract<TranscriptItem, { kind: 'tool' }> => i.id === activeViewId && i.kind === 'tool');
  const voiceIn = canListen();
  const signedIn = auth.kind === 'dev-bypass' || auth.kind === 'signed-in';

  const connLabel =
    conn.kind === 'connected'
      ? 'Connected'
      : conn.kind === 'connecting'
        ? 'Connecting'
        : conn.kind === 'failed'
          ? 'Offline'
          : 'Signed out';
  const connTone = conn.kind === 'connected' ? 'success' : conn.kind === 'failed' ? 'danger' : 'neutral';
  const canTalk = conn.kind === 'connected';
  const fullscreen = displayMode === 'fullscreen';

  function startSignIn() {
    setAuth({ kind: 'signing-in' });
    beginSignIn(config.mcpUrl, provider).catch((err: unknown) =>
      setAuth({ kind: 'error', message: `Sign-in couldn’t start: ${err instanceof Error ? err.message : String(err)}` }),
    );
  }

  return (
    <View className="w-full flex-1 bg-bg">
      <Section aria-labelledby="sim-title" className="mx-auto w-full max-w-screen-xl gap-8 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <Header className="flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <View className="max-w-2xl gap-3">
            <BrandWordmark height={40} />
            <Heading level={1} id="sim-title" className="my-0 font-display text-3xl leading-tight text-text md:text-4xl">
              Talk to your Mon
            </Heading>
            <Paragraph className="my-0 text-base leading-7 text-text-secondary md:text-lg md:leading-8">
              A smart display running the NYC-MON add-on. Say or type something; your Mon answers out loud.
            </Paragraph>
          </View>
          <View className="flex-row flex-wrap items-center gap-3">
            {canSpeak() ? (
              <View className="w-60">
                <Switch
                  label="Read replies aloud"
                  value={readAloud}
                  onChange={(next) => {
                    setReadAloud(next);
                    if (!next) stopSpeaking();
                    try {
                      local?.setItem('nyc-mon-sim.read-aloud', next ? '1' : '0');
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </View>
            ) : null}
            <Button variant="ghost" size="sm" title={scheme === 'dark' ? 'Daylight' : 'Night'} onPress={toggleTheme} />
            <Button variant="ghost" size="sm" title="New conversation" onPress={newConversation} disabled={items.length === 0} />
            {auth.kind === 'signed-in' ? <Button variant="ghost" size="sm" title="Sign out" onPress={signOut} /> : null}
          </View>
        </Header>

        <View className="gap-6 lg:flex-row lg:items-start">
          <View className="min-w-0 flex-1 gap-3">
            <SolidPanel surface="page" depth="lg">
              <View
                aria-label="Smart display"
                role="region"
                className="relative min-h-[560px] w-full overflow-hidden md:aspect-[16/10] md:min-h-0"
              >
                <View className="flex-row items-center justify-between px-5 pt-4">
                  <Text className="text-xr-caption text-text-muted">{time}</Text>
                  <Badge label={connLabel} tone={connTone} />
                </View>

                {!signedIn ? (
                  <View className="flex-1 justify-center px-5 py-6 md:px-10">
                    <View className="max-w-xl gap-3">
                      <Card variant="notch" district="midtown" title="Meet your Mon here" description="Sign in with your NYC-MON account. The add-on is for adults 18 and over." />
                      <ErrorMessage message={auth.kind === 'error' ? auth.message : undefined} />
                      <View className="flex-row">
                        <Button variant="cta" title="Sign in" loading={auth.kind === 'signing-in'} onPress={startSignIn} />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="min-h-0 flex-1 gap-4 px-5 py-4 md:flex-row">
                    <View className="min-h-0 flex-1 gap-3 md:basis-1/2">
                      <Card variant="notch" district="midtown">
                        <Text aria-live="polite" className="text-xr-body text-text">
                          {headline || (busy ? 'Your Mon is thinking…' : 'Say or type something to your Mon.')}
                        </Text>
                      </Card>
                      {items.length === 0 && canTalk ? (
                        <View aria-label="Try saying" role="group" className="flex-row flex-wrap gap-2">
                          {SUGGESTIONS.map((sug) => (
                            <Button key={sug} variant="outline" size="sm" title={sug} disabled={busy} onPress={() => void send(sug)} />
                          ))}
                        </View>
                      ) : null}
                      <View role="log" aria-label="Conversation" className="min-h-0 flex-1 gap-3 overflow-y-auto pb-1">
                        {/* The latest reply is already in the card above; list it only once. */}
                        {items.filter((item) => !(item.kind === 'mon' && item.id === lastMon?.id && !live)).map((item) => (
                          <LogItem
                            key={item.id}
                            item={item}
                            active={item.id === activeViewId}
                            onShow={() => {
                              setActiveViewId(item.id);
                              setDisplayMode('inline');
                            }}
                          />
                        ))}
                      </View>
                      {conn.kind === 'failed' ? (
                        <View className="gap-2">
                          <Banner tone="danger" title="Can’t reach the NYC-MON server" description={conn.message} />
                          <View className="flex-row">
                            <Button variant="outline" size="sm" title="Retry" onPress={() => void connect()} />
                          </View>
                        </View>
                      ) : null}
                    </View>

                    <View
                      className={fullscreen ? 'absolute inset-0 z-10 gap-3 bg-surface-raised p-4' : 'min-h-[280px] gap-3 md:min-h-0 md:basis-1/2'}
                    >
                      {activeView && activeView.resourceUri && session ? (
                        <>
                          <View className="flex-row items-center justify-between gap-3">
                            <Badge label={activeView.title} tone="info" />
                            <Button
                              variant="outline"
                              size="sm"
                              title={fullscreen ? 'Exit full screen' : 'Full screen'}
                              onPress={() => setDisplayMode(fullscreen ? 'inline' : 'fullscreen')}
                            />
                          </View>
                          <AppView
                            key={activeView.id}
                            client={session.client}
                            tool={toolsByName.get(activeView.name)}
                            tools={session.tools}
                            toolName={activeView.name}
                            title={activeView.title}
                            resourceUri={activeView.resourceUri}
                            input={activeView.input}
                            result={activeView.result}
                            sandboxOrigin={config.sandboxOrigin}
                            displayMode={displayMode}
                            scheme={scheme}
                            onDisplayModeChange={setDisplayMode}
                            onViewMessage={(t) => setDraft(t)}
                          />
                        </>
                      ) : (
                        <Card variant="notch" district="downtown" title="Your Mon’s card" description="Ask how your Mon is doing and its card shows up here." />
                      )}
                    </View>
                  </View>
                )}

                {signedIn ? (
                  <Form onSubmit={() => void send(draft)}>
                    <View className="gap-3 px-5 pb-5 pt-2 md:flex-row md:items-end">
                      <View className="min-w-0 md:flex-1">
                        <TextField
                          surface="daylit"
                          label="Message to your Mon"
                          placeholder={listening ? 'Listening…' : 'Type to your Mon'}
                          value={listening ? heard : draft}
                          onChangeText={setDraft}
                          onSubmitEditing={() => void send(draft)}
                          disabled={!canTalk || !!listening}
                        />
                      </View>
                      <View className="flex-row flex-wrap gap-3">
                        {busy ? (
                          <Button variant="outline" title="Stop" onPress={() => abortRef.current?.abort()} />
                        ) : (
                          <Button variant="outline" title="Send" disabled={!draft.trim() || !canTalk} onPress={() => void send(draft)} />
                        )}
                        <Button
                          variant="cta"
                          title={listening ? 'Done talking' : 'Talk'}
                          accessibilityHint={
                            voiceIn
                              ? listening
                                ? 'Sends what you said.'
                                : 'Starts listening. Tap again when you finish.'
                              : 'Voice input isn’t available in this browser. Type instead.'
                          }
                          disabled={!voiceIn || !canTalk || busy}
                          onPress={listening ? stopListening : startListening}
                        />
                      </View>
                    </View>
                  </Form>
                ) : null}
              </View>
            </SolidPanel>
            <Text className="text-center text-xr-caption text-text-muted">
              {config.modelLabel}
              {auth.kind === 'dev-bypass' ? '. Dev sign-in bypass is on.' : '.'}
            </Text>
          </View>

          {config.devMode ? (
            <View className="w-full lg:w-80">
              <DevPanel
                client={session?.client ?? null}
                injectTool={toolsByName.get('inject_presence_event')}
                conversion={conn.kind === 'connected' ? conn.conversion : null}
                onNotice={notice}
              />
            </View>
          ) : null}
        </View>
      </Section>
      {/* The site's grid floor, as on the home page: a full-bleed band of its own. */}
      <GridBandBoundary>
        <GridBand />
      </GridBandBoundary>
    </View>
  );
}

function LogItem({ item, active, onShow }: { item: TranscriptItem; active: boolean; onShow: () => void }) {
  switch (item.kind) {
    case 'user':
      return (
        <View className="items-end">
          <Text className="text-xr-body text-text-muted">{item.text}</Text>
        </View>
      );
    case 'mon':
      return <Text className="text-xr-body text-text">{item.text}</Text>;
    case 'tool':
      return (
        <View className="flex-row flex-wrap items-center gap-3">
          <Badge label={item.result.isError ? `${item.title} didn’t go through` : item.title} tone={item.result.isError ? 'danger' : 'info'} />
          {item.resourceUri && !active ? <Button variant="ghost" size="sm" title="Show card" onPress={onShow} /> : null}
        </View>
      );
    case 'notice':
      return <Banner tone={item.tone === 'error' ? 'danger' : 'info'} title={item.text} />;
  }
}
