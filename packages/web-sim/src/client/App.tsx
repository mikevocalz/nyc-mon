import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Anthropic from '@anthropic-ai/sdk';
import { UnauthorizedError, type Tool } from '@modelcontextprotocol/client';
import { runAgentTurn } from '../shared/agentLoop.ts';
import { SimOAuthProvider, parseCallback, resolveAuthState, type AuthState } from '../shared/auth.ts';
import { mcpToolsToClaude, type ConversionResult } from '../shared/toolSpec.ts';
import { Badge, Banner, BrandWordmark, Button, Card, ErrorMessage, SolidPanel, Switch, TextField, useInstanceStore, useStore } from '@acme/ui';
import type { StoreApi } from 'zustand/vanilla';
import { xrTypeRamp } from '@acme/theme';
import { Form, Header, Heading, Paragraph, Section } from '@acme/ui/html';
import { MonModel3D } from '@acme/ui/three/mon';
import { Text, View } from '@acme/ui/tw';
import { AppView, type DisplayMode } from './AppView.tsx';
import { captionText, spokenText } from './caption.ts';
import { DevPanel } from './DevPanel.tsx';
import { judgeStage } from './judgeStatus.ts';
import { SignInRequired, beginSignIn, completeSignIn, connectMcp, listAllTools, type McpSession } from './mcp.ts';
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
import { IDLE, nextConversation, openEar, type ConversationEvent, type ConversationMode, type Ear } from './handsFree.ts';
import { monSpeechPort } from './monSpeechPort.ts';
import { createSentenceSplitter } from './sentenceStream.ts';
import { loadVoice, sameVoice, saveVoice, stickyVoice, type RememberedVoice } from './sessionVoice.ts';
import { canListen, canSpeak, listen, setSessionVoice, stopSpeaking } from './speech.ts';
import { addSpeechCueListener, emitSpeechCue } from './speechCues.ts';
import { createSpeechQueue, type SpeechQueue } from './speechQueue.ts';
import { useSetters } from './state.ts';
import { currentScheme, type Scheme } from './theme.ts';
import { createAuthorize, noAuthorize, sdkRefresh } from './freshToken.ts';
import { createTurnToolCaller, hintedToolNames, latestMonState, withMonState, withPresenceLine } from './turnTools.ts';
import { currentViewUri, freshViewFor, liveViewUri } from './viewUri.ts';
import { isEcho, isFiller, liveMicUrl, openLiveMic, type LiveMic } from './liveMic.ts';

export interface PublicConfig {
  readonly mcpUrl: string;
  readonly sandboxOrigin: string;
  readonly authMode: 'oauth' | 'dev-bypass';
  readonly clientId: string;
  readonly devMode: boolean;
  readonly modelBackend: 'bedrock' | 'mock';
  readonly modelLabel: string;
  /** /api/asr is up: the mic streams to NVIDIA Parakeet, echo-cancelled (liveMic.ts). */
  readonly liveMic?: boolean;
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
  /** The mic is open for the person (not the barge-in watch while the Mon talks). */
  listening: boolean;
  heard: string;
  /** Hands-free conversation mode: idle, listening, thinking, speaking. */
  talkMode: ConversationMode;
  /** The sentence the Mon is saying right now (raw; the caption cleans it). */
  speaking: string;
  /** The Caller's Mon card from the quiet get_mon_status: shown when no turn has a view up. */
  standing: Extract<TranscriptItem, { kind: 'tool' }> | null;
  activeViewId: string | null;
  activeToolTitle: string | null;
  displayMode: DisplayMode;
  scheme: Scheme;
  readAloud: boolean;
  time: string;
  /** Dev panel: '' is the Caller, otherwise the familiar person the simulator says is speaking. */
  speakerId: string;
  speakerName: string;
}

const SUGGESTIONS = ['How’s my Mon doing?', 'Are you hungry?', 'Who’s here right now?'];
const CALLBACK_PATH = '/oauth/callback';
/** Same clip order as the MCP Mon card (mcp-server MonView MON_MODELS[3]). */
const LIL_RATTI_CLIPS = ['up_idle', 'up_breathe', 'quad_idle_sniff'] as const;

function toolTitle(tool: Tool | undefined, name: string): string {
  return tool?.annotations?.title ?? tool?.title ?? name.replace(/_/g, ' ');
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
    listening: false,
    heard: '',
    talkMode: 'idle',
    speaking: '',
    standing: null,
    activeViewId: [...initial.items].reverse().find((i) => i.kind === 'tool' && i.resourceUri)?.id ?? null,
    activeToolTitle: null,
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
    speakerId: '',
    speakerName: '',
  }));
  // The fast-changing strings (what the mic hears, the reply streaming in, the
  // sentence being spoken) are read by <LiveCaption> alone. App follows only
  // whether each is empty: every App render restyles the whole page (about
  // 17 ms measured), and one per interim word cost the 3D Mon a frame each time.
  const items = useStore(store, (s) => s.items);
  const auth = useStore(store, (s) => s.auth);
  const conn = useStore(store, (s) => s.conn);
  const busy = useStore(store, (s) => s.busy);
  const draft = useStore(store, (s) => s.draft);
  const listening = useStore(store, (s) => s.listening);
  const talkMode = useStore(store, (s) => s.talkMode);
  const standing = useStore(store, (s) => s.standing);
  const activeViewId = useStore(store, (s) => s.activeViewId);
  const activeToolTitle = useStore(store, (s) => s.activeToolTitle);
  const displayMode = useStore(store, (s) => s.displayMode);
  const scheme = useStore(store, (s) => s.scheme);
  const readAloud = useStore(store, (s) => s.readAloud);
  const time = useStore(store, (s) => s.time);
  const speakerId = useStore(store, (s) => s.speakerId);
  const hasHeard = useStore(store, (s) => s.heard.trim() !== '');
  const hasLive = useStore(store, (s) => s.live !== '');
  const hasSpeaking = useStore(store, (s) => s.speaking !== '');

  const {
    items: setItems,
    auth: setAuth,
    conn: setConn,
    busy: setBusy,
    live: setLive,
    draft: setDraft,
    listening: setListening,
    heard: setHeard,
    talkMode: setTalkMode,
    speaking: setSpeaking,
    standing: setStanding,
    activeViewId: setActiveViewId,
    activeToolTitle: setActiveToolTitle,
    displayMode: setDisplayMode,
    scheme: setScheme,
    readAloud: setReadAloud,
    time: setTime,
    speakerId: setSpeakerId,
    speakerName: setSpeakerName,
  } = useSetters(store);
  const historyRef = useRef<Anthropic.MessageParam[]>(initial.history);
  const abortRef = useRef<AbortController | null>(null);
  // /api/model and /api/tts carry the MCP access token, refreshed before it lapses (freshToken.ts).
  const authorize = useMemo(
    () =>
      config.authMode === 'oauth'
        ? createAuthorize({
            store: provider,
            refresh: sdkRefresh(config.mcpUrl, provider),
            onSignedOut: () => setAuth({ kind: 'signed-out' }),
          })
        : noAuthorize,
    [config.authMode, config.mcpUrl, provider, setAuth],
  );
  const model = useMemo(() => httpModelClient('/api/model', fetch, authorize), [authorize]);

  // ---- The Mon's voice: one voice for the whole conversation (sessionVoice.ts).
  const voiceRef = useRef<RememberedVoice | null>(null);
  const learnVoice = useCallback(
    (from: readonly TranscriptItem[]) => {
      const next = stickyVoice(voiceRef.current, from);
      if (sameVoice(next, voiceRef.current)) return;
      voiceRef.current = next;
      saveVoice(local, next);
      setSessionVoice(next?.voice);
    },
    [local],
  );
  // On load: the stored voice, else whatever the restored transcript says.
  useEffect(() => {
    voiceRef.current = stickyVoice(loadVoice(local), initial.items);
    saveVoice(local, voiceRef.current);
    setSessionVoice(voiceRef.current?.voice);
  }, [initial.items, local]);

  // ---- Hands-free conversation (handsFree.ts) and sentence-streamed speech (speechQueue.ts).
  const convRef = useRef(IDLE);
  const earRef = useRef<Ear | null>(null);
  const queueRef = useRef<SpeechQueue | null>(null);
  const speakingRef = useRef('');
  const audioStartRef = useRef(0);
  const bargedRef = useRef(false);
  // ---- Live mic (liveMic.ts): one echo-cancelled stream for the whole voice session.
  const liveMicRef = useRef<LiveMic | null>(null);
  const liveOpeningRef = useRef(false);
  const noSpeechRef = useRef<number | null>(null);
  /** The latest interim text, for "Done talking" before the recognizer's final arrives. */
  const heardRef = useRef('');
  /** Everything the Mon has queued to say this turn: what an echo would sound like. */
  const replyTextRef = useRef('');
  /** An utterance that arrived while the cut-off turn was still unwinding. */
  const pendingUtteranceRef = useRef<string | null>(null);
  /** What the person said last, so more said before the Mon answers joins it. */
  const lastUtteranceRef = useRef('');
  /** performance.now() marks for the current turn, for the latency log. */
  const marksRef = useRef<{ speechEnd: number; firstText?: number; firstSentence?: number; firstAudio?: number } | null>(null);

  const dispatch = useCallback(
    (e: ConversationEvent) => {
      convRef.current = nextConversation(convRef.current, e);
      setTalkMode(convRef.current.mode);
      return convRef.current;
    },
    [setTalkMode],
  );

  const closeEar = useCallback(() => {
    earRef.current?.close();
    earRef.current = null;
    setListening(false);
  }, [setListening]);

  const stopVoice = useCallback(() => {
    queueRef.current?.cancel();
    queueRef.current = null;
    stopSpeaking();
    speakingRef.current = '';
    setSpeaking('');
  }, [setSpeaking]);

  // The Mon looks and listens while the microphone is open (up_look_listen in the view).
  useEffect(() => {
    emitSpeechCue({ kind: 'listen', id: 'mic', on: listening });
  }, [listening]);

  // The first audible moment of each clip: drives the latency log.
  useEffect(
    () =>
      addSpeechCueListener((cue) => {
        if (cue.kind !== 'start') return;
        audioStartRef.current = performance.now();
        const m = marksRef.current;
        if (m && m.firstAudio === undefined) {
          m.firstAudio = audioStartRef.current;
          logLatency(m);
        }
      }),
    [],
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
  }, [items, hasLive]);

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
      .then(() => {
        setAuth(resolveAuthState(config.authMode, provider));
        // Signed in again: the "sign-in expired" notice is history, not the caption.
        setItems((prev) => prev.filter((i) => !(i.kind === 'notice' && i.text === SIGN_IN_EXPIRED)));
      })
      .catch((err: unknown) => setAuth({ kind: 'error', message: err instanceof Error ? err.message : String(err) }));
  }, [config.authMode, config.mcpUrl, provider, setAuth, setItems]);

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

  /**
   * "Try card again": the server may have been rebuilt since it listed its
   * tools, and view URIs change with every build. Re-list the tools so the card
   * resolves against the server as it is now; reconnect if the old session is gone.
   */
  const refreshTools = useCallback(async () => {
    const current = store.getState().conn;
    if (current.kind !== 'connected') return;
    try {
      const tools = await listAllTools(current.session.client);
      setConn({ kind: 'connected', session: { ...current.session, tools }, conversion: mcpToolsToClaude(tools) });
    } catch {
      await connect();
    }
  }, [connect, setConn, store]);

  /** The newest tool call that opens a card; an older one still re-listing never takes the display from it. */
  const latestViewRef = useRef<string | null>(null);
  /** The mic, open for one utterance (only while the Mon is quiet). */
  const sendRef = useRef<(text: string, source: 'voice' | 'typed') => Promise<void>>(async () => {});
  const clearNoSpeech = useCallback(() => {
    if (noSpeechRef.current !== null) window.clearTimeout(noSpeechRef.current);
    noSpeechRef.current = null;
  }, []);
  const closeLiveMic = useCallback(() => {
    clearNoSpeech();
    liveMicRef.current?.close();
    liveMicRef.current = null;
    liveOpeningRef.current = false;
  }, [clearNoSpeech]);

  /** The person talked over the Mon (or over its thinking): stop it and listen. */
  const bargeIn = useCallback(() => {
    bargedRef.current = true;
    abortRef.current?.abort();
    stopVoice();
    dispatch({ type: 'barge-in' });
    setListening(true);
  }, [dispatch, setListening, stopVoice]);

  const deliverUtterance = useCallback(
    (said: string) => {
      clearNoSpeech();
      lastUtteranceRef.current = said;
      heardRef.current = '';
      setHeard('');
      setListening(false);
      marksRef.current = { speechEnd: performance.now() };
      performance.mark('mon:end-of-speech');
      dispatch({ type: 'utterance' });
      // A cut-off turn is still unwinding (busy): its finally sends this one.
      if (store.getState().busy) pendingUtteranceRef.current = said;
      else void sendRef.current(said, 'voice');
    },
    [clearNoSpeech, dispatch, setHeard, setListening, store],
  );

  const startLiveMic = useCallback(async () => {
    if (liveMicRef.current || liveOpeningRef.current) return;
    liveOpeningRef.current = true;
    let token: string | undefined;
    try {
      await authorize(async (t) => {
        token = t;
        return new Response(null, { status: 204 });
      });
      const mic = await openLiveMic({
        url: liveMicUrl(window.location),
        token,
        handlers: {
          onInterim: (text) => {
            const mode = convRef.current.mode;
            if (mode === 'listening') {
              clearNoSpeech();
              heardRef.current = text;
              setHeard(text);
            } else if ((mode === 'speaking' || mode === 'thinking') && text.split(/\s+/).length >= 2 && !isEcho(text, replyTextRef.current)) {
              bargeIn();
              heardRef.current = text;
              setHeard(text);
            }
          },
          onFinal: (text) => {
            if (isFiller(text)) return;
            const mode = convRef.current.mode;
            let said = text;
            if (mode === 'speaking' || mode === 'thinking') {
              if (isEcho(text, replyTextRef.current)) return;
              // Still thinking, nothing said yet: the person kept talking, so it is one turn.
              if (mode === 'thinking' && !replyTextRef.current.trim()) said = `${lastUtteranceRef.current} ${text}`.trim();
              bargeIn();
            }
            if (convRef.current.mode === 'listening') deliverUtterance(said);
          },
          onError: (m) => {
            closeLiveMic();
            setListening(false);
            dispatch({ type: 'stop' });
            notice(m, 'error');
          },
        },
      });
      liveOpeningRef.current = false;
      // The session ended while the mic was opening.
      if (convRef.current.mode === 'idle') mic.close();
      else liveMicRef.current = mic;
    } catch {
      liveOpeningRef.current = false;
      setListening(false);
      dispatch({ type: 'stop' });
      notice('The microphone is off or blocked. Allow it for this page, then tap Talk.', 'error');
    }
  }, [authorize, bargeIn, clearNoSpeech, closeLiveMic, deliverUtterance, dispatch, notice, setHeard, setListening]);

  const useLiveMic = config.liveMic === true && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const openMic = useCallback(
    () => {
      if (useLiveMic) {
        void startLiveMic();
        heardRef.current = '';
        setHeard('');
        setListening(true);
        clearNoSpeech();
        // No speech in the follow-up window ends the session, as on an Echo.
        noSpeechRef.current = window.setTimeout(() => {
          if (convRef.current.mode !== 'listening' || heardRef.current) return;
          closeLiveMic();
          setListening(false);
          dispatch({ type: 'silent' });
        }, LIVE_NO_SPEECH_MS);
        return;
      }
      earRef.current?.close();
      const ear = openEar({
        listen,
        onInterim: setHeard,
        onUtterance: (said, endedAt) => {
          earRef.current = null;
          setListening(false);
          marksRef.current = { speechEnd: endedAt };
          performance.mark('mon:end-of-speech');
          dispatch({ type: 'utterance' });
          void sendRef.current(said, 'voice');
        },
        onSilent: () => {
          earRef.current = null;
          setListening(false);
          setHeard('');
          dispatch({ type: 'silent' });
        },
        onError: (m) => {
          earRef.current = null;
          setListening(false);
          dispatch({ type: 'stop' });
          notice(m, 'error');
        },
      });
      earRef.current = ear;
      setListening(!!ear);
    },
    [clearNoSpeech, closeLiveMic, dispatch, notice, setHeard, setListening, startLiveMic, useLiveMic],
  );

  const send = useCallback(
    async (raw: string, source: 'voice' | 'typed' = 'typed') => {
      const text = raw.trim();
      // The store, not the render's `busy`: a cut-in can call this before React re-renders.
      if (!text || store.getState().busy || conn.kind !== 'connected') return;
      stopVoice();
      if (source === 'typed') {
        closeEar();
        closeLiveMic();
        marksRef.current = { speechEnd: performance.now() };
        dispatch({ type: 'typed' });
      }
      bargedRef.current = false;
      replyTextRef.current = '';
      setDraft('');
      setHeard('');
      setBusy(true);
      setLive('');
      setActiveToolTitle(null);
      push({ kind: 'user', id: newId('u'), text, at: Date.now() });

      // Speak each sentence as soon as it is complete; the next is fetched while one plays.
      const splitter = createSentenceSplitter();
      const queue = readAloud
        ? createSpeechQueue({
            port: monSpeechPort({ voice: () => voiceRef.current?.voice, authorize }),
            onSentence: (sentence, index) => {
              speakingRef.current = sentence;
              setSpeaking(sentence);
              if (audioStartRef.current < (marksRef.current?.speechEnd ?? 0)) audioStartRef.current = performance.now();
              // The mic stays shut while the Mon talks: Web Speech has no echo
              // cancellation, so it heard the Mon through the speakers and sent
              // that back as the person's turn. Talk cuts in instead.
              if (index === 0 && convRef.current.mode === 'thinking') dispatch({ type: 'reply-audio' });
            },
          })
        : null;
      queueRef.current = queue;
      let spokeAny = false;
      const say = (sentences: string[]) => {
        for (const raw of sentences) {
          // Quote marks are never spoken (and never captioned): the voice gets the words only.
          const s = spokenText(raw);
          if (!s) continue;
          if (marksRef.current && marksRef.current.firstSentence === undefined) marksRef.current.firstSentence = performance.now();
          spokeAny = true;
          replyTextRef.current += ` ${s}`;
          queue?.push(s);
        }
      };
      const finishSpeech = () => {
        queue?.end();
        const afterReply = () => {
          if (queueRef.current !== queue && queue !== null) return; // a newer turn or a barge-in owns the voice now
          queueRef.current = null;
          speakingRef.current = '';
          setSpeaking('');
          closeEar();
          const next = dispatch({ type: 'reply-done' });
          // Let the speakers fall silent before the mic opens, or it catches the last word.
          if (next.mode === 'listening') {
            window.setTimeout(() => {
              if (convRef.current.mode === 'listening' && !earRef.current) openMic();
            }, MIC_SETTLE_MS);
          }
        };
        if (queue) void queue.done.then((outcome) => outcome === 'finished' && afterReply());
        else afterReply();
      };

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
          // The card's fresh state rides along, so small talk needs no check_on_mon step first.
          userText: withMonState(
            withPresenceLine(text, store.getState().speakerName),
            latestMonState(store.getState().items, store.getState().standing, Date.now()),
          ),
          signal: abort.signal,
          mcp: createTurnToolCaller({
            client: s.client,
            signal: abort.signal,
            speakerId: store.getState().speakerId,
            hintedTools: hintedToolNames(s.tools),
          }),
          onEvent: (e) => {
            if (e.type === 'text') {
              if (marksRef.current && marksRef.current.firstText === undefined) marksRef.current.firstText = performance.now();
              setActiveToolTitle(null);
              setLive((prev) => prev + e.delta);
              say(splitter.push(e.delta));
            }
            if (e.type === 'step-done') {
              setLive('');
              // "Let me check." plays while the tool runs instead of waiting for the end of the turn.
              say(splitter.flush());
            }
            if (e.type === 'tool-start') setActiveToolTitle(toolTitle(toolsByName.get(e.name), e.name));
            if (e.type === 'tool-result') {
              const tool = toolsByName.get(e.name);
              const uri = liveViewUri(tool, e.result);
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
              // A result that carries the Mon updates the sticky voice before its reply is spoken.
              learnVoice(store.getState().items);
              if (uri) {
                // Re-list first: a server rebuilt behind this page names its views by a new hash (freshViewFor).
                latestViewRef.current = id;
                const held = store.getState().conn;
                const cached = held.kind === 'connected' && held.session.client === s.client ? held.session.tools : s.tools;
                void freshViewFor({ listTools: () => listAllTools(s.client), cached, toolName: e.name, result: e.result }).then((fresh) => {
                  const now = store.getState().conn;
                  if (fresh.changed && now.kind === 'connected' && now.session.client === s.client) {
                    const tools = [...fresh.tools];
                    setConn({ kind: 'connected', session: { ...now.session, tools }, conversion: mcpToolsToClaude(tools) });
                  }
                  // A later card took the display while this one re-listed: it stays in the transcript only.
                  if (latestViewRef.current !== id || !fresh.uri) return;
                  setActiveViewId(id);
                  setDisplayMode('inline');
                });
              }
            }
          },
        });
        historyRef.current = turn.history;
        const reply =
          turn.outcome === 'refused'
            ? 'I can’t help with that one. Ask me something else about your Mon.'
            : turn.reply.trim() || (turn.outcome === 'step-limit' ? 'That took too many steps. Ask again more simply.' : '');
        say(splitter.flush());
        // A canned line (refusal, step limit) was never streamed: speak it now.
        if (reply && !spokeAny) say([reply]);
        if (reply) push({ kind: 'mon', id: newId('m'), text: reply, at: Date.now() });
        if (turn.outcome === 'truncated') notice('The reply was cut off before a tool call finished. Ask again.', 'error');
        finishSpeech();
      } catch (err) {
        // A barge-in already stopped the voice and opened the mic; anything else ends the session.
        if (!bargedRef.current) {
          stopVoice();
          closeEar();
          dispatch({ type: 'stop' });
        }
        if (bargedRef.current) {
          /* the person cut in: no notice */
        } else if (abort.signal.aborted) {
          notice('Stopped.', 'info');
        } else if ((err instanceof UnauthorizedError || err instanceof ModelAuthExpiredError)) {
          provider.invalidateCredentials('tokens');
          setAuth({ kind: 'signed-out' });
          setConn({ kind: 'idle' });
          notice(SIGN_IN_EXPIRED, 'error');
        } else if (err instanceof ModelTurnError) {
          notice(err.message, 'error');
        } else {
          notice(`Something broke mid-reply: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      } finally {
        setLive('');
        setActiveToolTitle(null);
        setBusy(false);
        abortRef.current = null;
      }
    },
    [authorize, conn, model, store, notice, provider, push, readAloud, toolsByName, closeEar, closeLiveMic, dispatch, learnVoice, openMic, stopVoice, setActiveToolTitle, setActiveViewId, setAuth, setBusy, setConn, setDisplayMode, setDraft, setHeard, setLive, setSpeaking],
  );
  useEffect(() => {
    sendRef.current = send;
  }, [send]);
  // The person cut in while the old turn was unwinding: send what they said once it has.
  useEffect(() => {
    const said = pendingUtteranceRef.current;
    if (busy || said === null) return;
    pendingUtteranceRef.current = null;
    void send(said, 'voice');
  }, [busy, send]);

  /** Talk: opens a hands-free session; mid-reply it cuts the Mon off; while listening it ends the utterance now. */
  function talk() {
    if (listening) {
      if (useLiveMic) {
        // Done talking: what was heard so far is the utterance.
        if (heardRef.current) deliverUtterance(heardRef.current);
        return;
      }
      earRef.current?.finish();
      return;
    }
    if (convRef.current.mode === 'thinking' || convRef.current.mode === 'speaking') {
      bargedRef.current = true;
      abortRef.current?.abort();
      stopVoice();
    }
    dispatch({ type: 'talk' });
    openMic();
  }
  /** Stop: ends the reply, the voice and the session. */
  function stopAll() {
    abortRef.current?.abort();
    stopVoice();
    closeEar();
    closeLiveMic();
    dispatch({ type: 'stop' });
  }

  /**
   * The standing display: voice-first, so the screen always shows the Caller's
   * Mon. On connect and after New conversation, one quiet get_mon_status (no
   * transcript line) supplies its card and the Mon's voice before the first
   * reply. A later tool with its own view replaces the card; one without a
   * view leaves it up.
   */
  const probedRef = useRef(false);
  const probeMon = useCallback(
    (s: McpSession) => {
      const tool = s.tools.find((t) => t.name === 'get_mon_status');
      if (!tool) return;
      probedRef.current = true;
      s.client
        .callTool({ name: 'get_mon_status', arguments: {} })
        .then((result) => {
          const item: Extract<TranscriptItem, { kind: 'tool' }> = {
            kind: 'tool',
            id: newId('standing'),
            name: tool.name,
            title: toolTitle(tool, tool.name),
            input: {},
            result,
            resourceUri: liveViewUri(tool, result) ?? null,
            at: Date.now(),
          };
          learnVoice([item]);
          if (!result.isError && item.resourceUri) setStanding(item);
        })
        .catch(() => {
          probedRef.current = false;
        });
    },
    [learnVoice, setStanding],
  );
  useEffect(() => {
    if (conn.kind === 'connected' && !probedRef.current) probeMon(conn.session);
  }, [conn, probeMon]);

  // Leaving the page or the session: nothing keeps listening or talking.
  useEffect(() => () => {
    earRef.current?.close();
    queueRef.current?.cancel();
  }, []);

  function toggleTheme() {
    const next: Scheme = scheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setScheme(next);
  }

  function newConversation() {
    stopAll();
    // The Mon stays on screen: fetch its card again for the empty conversation.
    if (session) probeMon(session);
    historyRef.current = [];
    clearSession(local);
    setItems([]);
    setActiveViewId(null);
    setActiveToolTitle(null);
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
  const lastReply = lastMon?.kind === 'mon' ? lastMon.text : '';
  const activeView =
    items.find((i): i is Extract<TranscriptItem, { kind: 'tool' }> => i.id === activeViewId && i.kind === 'tool') ?? standing ?? undefined;
  // Never the URI saved with the item: it names a view from the server build that made it.
  const activeViewUri = activeView ? currentViewUri(activeView, toolsByName) : null;
  const voiceIn = useLiveMic || canListen();
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
  const stageInput = { authKind: auth.kind, connectionKind: conn.kind, listening, busy, activeToolTitle, lastReply };
  // Kind, label and tone only depend on whether the strings are empty; LiveCaption fills the headline.
  const stage = judgeStage({ ...stageInput, heard: hasHeard ? ' ' : '', live: hasLive ? ' ' : '' });

  // Voice is the way in. Typing is for testers (dev mode) or a browser with no speech recognition.
  const typing = config.devMode || !voiceIn;
  // Without the log on screen, a notice (an error, "Stopped.") has to reach the caption or it's lost.
  const lastItem = items.at(-1);
  const lastNotice = lastItem?.kind === 'notice' ? lastItem.text : null;
  // Is there any caption at all (LiveCaption has the words)?
  const caption = listening || hasSpeaking || stage.kind !== 'ready' || lastNotice !== null || lastReply !== '';
  // The state badge: Listening / Thinking / Speaking while a conversation is under way.
  const badge =
    talkMode === 'speaking' && !listening && stage.kind !== 'acting'
      ? { label: 'Speaking', tone: 'info' as const }
      : stage.kind === 'ready'
        ? talkMode === 'speaking'
          ? { label: 'Speaking', tone: 'info' as const }
          : null
        : { label: stage.label, tone: stage.tone };
  const typingPanel = (
    <SolidPanel surface="page" depth="lg">
      <Section aria-labelledby="typing-title" className="gap-4 px-5 py-6">
        <Heading level={2} id="typing-title" className="my-0 font-display text-xl leading-tight text-text">
          {config.devMode ? 'Type instead' : 'Type to your Mon'}
        </Heading>
        {voiceIn ? null : (
          <Paragraph className="my-0 text-sm text-text-secondary">This browser can’t hear you, so type what you’d say.</Paragraph>
        )}
        <Form onSubmit={() => void send(draft)}>
          <View className="gap-3">
            <TextField
              surface="daylit"
              label="Message to your Mon"
              placeholder={listening ? 'Listening…' : 'Type to your Mon'}
              value={listening ? '' : draft}
              onChangeText={setDraft}
              onSubmitEditing={() => void send(draft)}
              disabled={!canTalk || !!listening}
            />
            <View className="flex-row">
              <Button variant="outline" title="Send" disabled={!draft.trim() || !canTalk || busy} onPress={() => void send(draft)} />
            </View>
          </View>
        </Form>
        {items.length === 0 && canTalk ? (
          <View aria-label="Try saying" role="group" className="flex-row flex-wrap gap-2">
            {SUGGESTIONS.map((sug) => (
              <Button key={sug} variant="outline" size="sm" title={sug} disabled={busy} onPress={() => void send(sug)} />
            ))}
          </View>
        ) : null}
        <View role="log" aria-label="Conversation" className="max-h-96 gap-3 overflow-y-auto pb-1">
          {items.map((item) => (
            <LogItem
              key={item.id}
              item={item}
              active={item.id === activeViewId}
              hasView={item.kind === 'tool' && currentViewUri(item, toolsByName) !== null}
              onShow={() => {
                setActiveViewId(item.id);
                setDisplayMode('inline');
              }}
            />
          ))}
        </View>
      </Section>
    </SolidPanel>
  );

  function startSignIn() {
    setAuth({ kind: 'signing-in' });
    beginSignIn(config.mcpUrl, provider).catch((err: unknown) =>
      setAuth({ kind: 'error', message: `Sign-in couldn’t start: ${err instanceof Error ? err.message : String(err)}` }),
    );
  }

  return (
    // One screen, like the device it stands in for: the page never scrolls.
    // h-dvh is the ceiling and overflow-hidden holds it; each column below
    // takes min-h-0 so it shrinks to the space instead of measuring content.
    <View className="h-dvh w-full overflow-hidden bg-bg">
      <Section aria-labelledby="sim-title" className="mx-auto flex h-full w-full max-w-screen-xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Header className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <View className="flex-row items-center gap-4">
            <BrandWordmark height={28} />
            <Heading level={1} id="sim-title" className="my-0 font-display text-xl leading-tight text-text">
              Talk to your Mon
            </Heading>
          </View>
          <View className="min-w-0 flex-row flex-wrap items-center justify-end gap-3">
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

        <View className="min-h-0 flex-1 gap-6 lg:flex-row">
          <View className="min-h-0 min-w-0 flex-1 gap-3">
            <SolidPanel surface="page" depth="lg" fill>
              <View
                aria-label="Smart display"
                role="region"
                data-judge-state={stage.kind}
                className="relative h-full w-full overflow-hidden"
              >
                {/* The row keeps a badge's height with or without one (an invisible one stands
                    in): a badge that came and went resized the 3D view under it by 7 px each
                    turn, and the Mon jumped. */}
                <View className="flex-row items-center justify-between gap-3 px-5 pt-4">
                  <Text className="text-xr-caption text-text-muted">{time}</Text>
                  <View className="flex-row flex-wrap items-center justify-end gap-2">
                    {conn.kind === 'connected' ? null : <Badge label={connLabel} tone={connTone} />}
                    {signedIn ? (
                      <View role="status" aria-live="polite" aria-atomic="true">
                        {/* Ready needs no badge; the display shows state only while it changes. */}
                        {badge ? (
                          <Badge label={badge.label} tone={badge.tone} />
                        ) : (
                          <View aria-hidden style={{ opacity: 0 }}>
                            <Badge label="Ready" tone="info" />
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>
                </View>

                {!signedIn ? (
                  <View className="flex-1 items-center justify-center gap-6 px-5 py-6 md:flex-row md:px-10">
                    <SignedOutMon />
                    <View className="max-w-xl gap-3">
                      <Card variant="notch" district="midtown" title="Meet your Mon here" description="Sign in with your NYC-MON account. The add-on is for adults 18 and over." />
                      <ErrorMessage message={auth.kind === 'error' ? auth.message : undefined} />
                      <View className="flex-row">
                        <Button variant="cta" title="Sign in" loading={auth.kind === 'signing-in'} onPress={startSignIn} />
                      </View>
                    </View>
                  </View>
                ) : (
                  <>
                    {/* Alexa+ speaks the reply; the screen belongs to the add-on's view. */}
                    {/* The view brings its own padding; the display adds only the side inset. */}
                    <View className="min-h-0 flex-1 px-3">
                      {activeView && activeViewUri && session ? (
                        <View className={fullscreen ? 'absolute inset-0 z-10 bg-surface-raised p-4' : 'min-h-0 flex-1'}>
                          <AppView
                            key={activeView.id}
                            client={session.client}
                            tool={toolsByName.get(activeView.name)}
                            tools={session.tools}
                            toolName={activeView.name}
                            title={activeView.title}
                            resourceUri={activeViewUri}
                            onRetry={refreshTools}
                            soundOn={readAloud}
                            input={activeView.input}
                            result={activeView.result}
                            sandboxOrigin={config.sandboxOrigin}
                            displayMode={displayMode}
                            scheme={scheme}
                            onDisplayModeChange={setDisplayMode}
                            onViewMessage={(t) => (typing ? setDraft(t) : void send(t))}
                          />
                        </View>
                      ) : conn.kind === 'failed' ? (
                        <View className="flex-1 justify-center gap-2">
                          <Banner tone="danger" title="Can’t reach the NYC-MON server" description={conn.message} />
                          <View className="flex-row">
                            <Button variant="outline" size="sm" title="Retry" onPress={() => void connect()} />
                          </View>
                        </View>
                      ) : canTalk && !caption ? (
                        <View className="flex-1 items-center justify-center">
                          <Text className="text-center text-xr-body text-text-secondary">
                            {voiceIn ? 'Tap Talk and ask about your Mon.' : 'Type a message to ask about your Mon.'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {/* On-screen captions, as on an Echo Show: the latest line only. Two
                        lines are always reserved: a caption that grew and shrank resized
                        the view above it, and the Mon jumped with every sentence. */}
                    <View aria-live="polite" aria-atomic="true" className="px-5 pb-3 pt-1" style={{ height: CAPTION_HEIGHT }}>
                      <LiveCaption store={store} stageInput={stageInput} notice={lastNotice} />
                    </View>
                  </>
                )}
              </View>
            </SolidPanel>

            {signedIn ? (
              <View className="flex-row flex-wrap items-center justify-center gap-3">
                <Button
                  variant="cta"
                  title={listening ? 'Done talking' : talkMode === 'idle' ? 'Talk' : 'Talk over'}
                  accessibilityHint={
                    voiceIn
                      ? listening
                        ? 'Sends what you said.'
                        : talkMode === 'idle'
                          ? 'Starts a conversation. Just talk; the Mon answers when you pause, then listens for a follow-up.'
                          : 'Stops the Mon and listens to you.'
                      : 'Voice input isn’t available in this browser. Type instead.'
                  }
                  disabled={!voiceIn || !canTalk}
                  onPress={talk}
                />
                {busy || talkMode !== 'idle' ? <Button variant="outline" title="Stop" onPress={stopAll} /> : null}
              </View>
            ) : null}
            {signedIn && typing && !config.devMode ? typingPanel : null}
            <Text className="text-center text-xr-caption text-text-muted">
              {config.modelLabel}
              {auth.kind === 'dev-bypass' ? '. Dev sign-in bypass is on.' : '.'}
            </Text>
          </View>

          {config.devMode ? (
            // Tester tools, not the device: this column scrolls inside itself so the page doesn't.
            <View className="min-h-0 w-full gap-6 overflow-y-auto lg:w-80">
              <DevPanel
                client={session?.client ?? null}
                injectTool={toolsByName.get('inject_presence_event')}
                conversion={conn.kind === 'connected' ? conn.conversion : null}
                onNotice={notice}
                speakerId={speakerId}
                onSpeakerChange={(id, name) => {
                  setSpeakerId(id);
                  setSpeakerName(name);
                }}
              />
              {signedIn ? typingPanel : null}
            </View>
          ) : null}
        </View>
      </Section>
    </View>
  );
}

/** Lil' Ratti on the signed-out display, from the same-origin /mons route (server/main.ts). Hidden if the GLB fails, leaving the card. */
function SignedOutMon() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <MonModel3D url="/mons/lil-ratti.glb" clips={LIL_RATTI_CLIPS} width={260} height={325} label="Lil' Ratti" onError={() => setFailed(true)} />;
}

function LogItem({ item, active, hasView, onShow }: { item: TranscriptItem; active: boolean; hasView: boolean; onShow: () => void }) {
  switch (item.kind) {
    case 'user':
      return (
        <View className="items-end">
          <Text className="text-xr-body text-text-muted">{item.text}</Text>
        </View>
      );
    case 'mon':
      return <Text className="text-xr-body text-text">{captionText(item.text)}</Text>;
    case 'tool':
      return (
        <View className="flex-row flex-wrap items-center gap-3">
          <Badge label={item.result.isError ? `${item.title} didn’t go through` : item.title} tone={item.result.isError ? 'danger' : 'info'} />
          {hasView && !active ? <Button variant="ghost" size="sm" title="Show card" onPress={onShow} /> : null}
        </View>
      );
    case 'notice':
      return <Banner tone={item.tone === 'error' ? 'danger' : 'info'} title={captionText(item.text)} />;
  }
}

/**
 * One line per turn in the console, and the same numbers on `window.__monLatency`
 * for a headless run: end of the person's speech to the first audible Mon audio.
 */
/** Two xr-body lines plus the caption row's padding (pt-1, pb-3). */
const CAPTION_HEIGHT = 2 * xrTypeRamp['xr-body'].lineHeightPt + 16;

/** A follow-up window with no speech ends the voice session (live mic). */
const LIVE_NO_SPEECH_MS = 8000;

/** Pause between the end of the Mon's audio and the mic opening. */
const MIC_SETTLE_MS = 350;

const SIGN_IN_EXPIRED = 'Your sign-in expired. Sign in again to keep talking.';

function logLatency(m: { speechEnd: number; firstText?: number; firstSentence?: number; firstAudio?: number }) {
  const rel = (t: number | undefined) => (t === undefined ? null : Math.round(t - m.speechEnd));
  const row = { firstTextMs: rel(m.firstText), firstSentenceMs: rel(m.firstSentence), firstAudioMs: rel(m.firstAudio) };
  try {
    performance.mark('mon:first-audio');
    performance.measure('mon:end-of-speech→first-audio', { start: m.speechEnd, end: m.firstAudio ?? performance.now() });
  } catch {
    /* older browsers: the console line still has the numbers */
  }
  const w = globalThis as { __monLatency?: unknown[] };
  (w.__monLatency ??= []).push(row);
  console.info(`[mon latency] end of speech → first audio ${row.firstAudioMs} ms (first text ${row.firstTextMs} ms, first sentence ${row.firstSentenceMs} ms)`);
}

/**
 * The caption line: what the mic hears, the reply streaming in, or the
 * sentence being spoken. The only reader of those fast strings, so a new word
 * re-renders this line and not the page (see App's store subscription).
 */
function LiveCaption({
  store,
  stageInput,
  notice,
}: {
  store: StoreApi<AppState>;
  stageInput: Omit<Parameters<typeof judgeStage>[0], 'heard' | 'live'>;
  notice: string | null;
}) {
  const heard = useStore(store, (s) => s.heard);
  const live = useStore(store, (s) => s.live);
  const speaking = useStore(store, (s) => s.speaking);
  const stage = judgeStage({ ...stageInput, heard, live });
  // While the Mon talks, the caption is the sentence it is saying (the latest line only, as on an Echo Show).
  const raw = stageInput.listening ? stage.headline : speaking || (stage.kind !== 'ready' ? stage.headline : (notice ?? stageInput.lastReply));
  if (!raw) return null;
  // Stage directions (*chuckle*) are performed by the voice and "Callah" reads as Caller: captions show only the words.
  return (
    <Text numberOfLines={2} className="text-center text-xr-body text-text">
      {captionText(raw)}
    </Text>
  );
}
