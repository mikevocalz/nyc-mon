import './rn-globals.ts';
import './globals.css';
import { useCallback, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { Banner, Button, Dialog, Switch, TextField, useInstanceStore, useStore } from '@acme/ui';
import { Details, Heading, List, ListItem, Main, Paragraph, Section, Summary, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { SimOAuthProvider, parseCallback, revokeRefreshToken } from '../shared/auth.ts';
import { runAgentTurn } from '../shared/agentLoop.ts';
import { mcpToolsToClaude } from '../shared/toolSpec.ts';
import { beginSignIn, completeSignIn, connectMcp } from './mcp.ts';
import { createAuthorize, bearer, sdkRefresh } from './freshToken.ts';
import { httpModelClient } from './modelClient.ts';
import { safeStorage } from './session.ts';
import { createTurnToolCaller } from './turnTools.ts';
import { createCompanionVoice } from './companionVoice.ts';
import { monSpeechPort } from './monSpeechPort.ts';
import { canListen, clearSessionVoice, listen, onPlayback, playbackStartedAt, setSessionVoice, stopSpeaking, type Listening } from './speech.ts';
import {
  appendLine, cutLine, errorMessage, expireSession, growLine, initialCompanionState, memoryErrorMessage, monLine, toolResultLine,
  type CompanionRuntime, type CompanionState, type Line,
} from './companionState.ts';
import { openEar, type ListenFn } from './handsFree.ts';
import { isFiller, liveMicUrl, openLiveMic, type LiveMic } from './liveMic.ts';
import { openMicPipeline, type MicPipeline } from './micPipeline.ts';
import { createVoiceController, type BargeInRecord, type EarHandlers, type VoiceController } from './voiceController.ts';
import { nextVoice, voiceAnnouncement, type VoiceEvent } from './voiceState.ts';
import { MemorySnapshotSchema } from '@acme/core/schemas';

const ConfigSchema = z.object({ mcpUrl:z.string().url(),clientId:z.string().min(1),issuer:z.string().url(),modelBackend:z.literal('nebius'),modelLabel:z.string(),
  asr:z.enum(['riva','browser']).default('browser') });
type Config = z.infer<typeof ConfigSchema>;
const toolsAllowed = new Set(['get_mon_status','check_on_mon','check_incubation','hatch_egg','talk_to_mon','feed_mon','rest_mon','wake_mon','play_with_mon']);
const NOTE_MAX = 500;
const PAGE = 'mx-auto w-full max-w-content-feed gap-6 px-4 py-6 md:px-6';
const TITLE = 'NYC-Mon Personal Companion';
/** One turn's timing, on window.__monTurns for a headless run to read (like the simulator's __monLatency). */
interface VoiceHandles {
  turn:TurnRecord|null;speakingLine:number|null;pendingStop:BargeInRecord|null;pipeline:MicPipeline|null;
  controller:VoiceController|null;
  runTurn:(question:string, source:'typed'|'voice', startedAt:number) => Promise<void>;
  finishTurn:(turn:TurnRecord, outcome:TurnRecord['outcome']) => void;
}
interface TurnRecord { source:'typed'|'voice';startedAt:number;firstAudioAt:number|null;doneAt:number|null;outcome:'pending'|'finished'|'interrupted'|'failed' }
function record(key:'__monTurns'|'__monBargeIns', row:Record<string,unknown>) {
  const w = globalThis as Record<string, unknown>;
  const rows = (w[key] ??= []) as unknown[];
  rows.push(row);
  if (rows.length > 200) rows.shift();
}
function talkTitle(phase: string): string {
  if (phase === 'listening') return 'Done talking';
  if (phase === 'thinking' || phase === 'speaking') return 'Cut in and talk';
  return 'Talk';
}
const BROWSER_VOICE_NOTE = 'Using your browser’s voice: the Mon’s voice is unavailable.';
const VOICE_UNAVAILABLE_NOTE = 'The Mon’s voice is unavailable right now. The reply is in the conversation below.';

function Companion({ config }: { config:Config }) {
  const store = useInstanceStore<CompanionState>(initialCompanionState);
  const state = useStore(store);
  // Per-mounted-page protocol handles, not UI state. Visible state stays in the instance store.
  const runtime = useInstanceStore<CompanionRuntime>(() => ({ session:null,history:[],abort:null }));
  const provider = useMemo(() => {
    const storage = safeStorage('session');
    // boot() checks storage before rendering; this stays as a guard.
    if (!storage) throw new Error('Session storage is required for secure sign-in.');
    return new SimOAuthProvider({ clientId:config.clientId,store:storage,
      redirectUrl:new URL('/nvidia.html',window.location.origin).href,navigate:(url) => window.location.assign(url.href) });
  },[config.clientId]);
  // The Mon's one voice: sticky lineage voice from tool results, spoken through the shared port to /api/tts (companionVoice.ts).
  // The browser's voice is only ever a labelled fallback: the status line says so whenever a sentence is not in the Mon's own voice.
  const voice = useMemo(() => createCompanionVoice({
    port:(current,authorize) => monSpeechPort({ voice:current,...(authorize ? { authorize } : {}),
      onFallback:(why) => store.setState({ status:why==='browser-voice' ? BROWSER_VOICE_NOTE : VOICE_UNAVAILABLE_NOTE }) }),
    stopAll:(opts) => { void stopSpeaking(opts); },
    setSessionVoice:(next) => { if (next) setSessionVoice(next); else clearSessionVoice(); } }),[store]);
  useEffect(() => () => { voice.stop(); },[voice]);
  const onSignedOut = useCallback(() => { voice.reset();expireSession(store,runtime); },[store,runtime,voice]);
  const authorize = useMemo(() => createAuthorize({ store:provider,refresh:sdkRefresh(config.mcpUrl,provider),onSignedOut }),[provider,config.mcpUrl,onSignedOut]);
  const model = useMemo(() => httpModelClient('/api/model',fetch,authorize),[authorize]);
  const showError = useCallback((error:unknown) => store.setState({ error:errorMessage(error),status:'' }),[store]);
  const push = useCallback((line:Omit<Line,'id'>) => store.setState((s) => appendLine(s,line)),[store]);

  // ---- Voice conversation: push-to-talk, conversation mode and barge-in (voiceController.ts).
  // Per-page voice handles, not UI state (like `runtime`).
  const handles = useInstanceStore<VoiceHandles>(() => ({ turn:null,speakingLine:null,pendingStop:null,pipeline:null,controller:null,
    runTurn:async () => {},finishTurn:() => {} }));
  const dispatchVoice = useCallback((event:VoiceEvent) => {
    store.setState((st) => ({ voice:nextVoice(st.voice,event) }));
    handles.getState().controller?.sync();
  },[store,handles]);
  const controller = useMemo(() => {
    const riva: ListenFn = (h) => {
      const pipeline = handles.getState().pipeline;
      if (!pipeline) return null;
      let mic: LiveMic | null = null;
      let cancelled = false;
      void (async () => {
        let token: string | undefined;
        await authorize(async (t) => { token = t; return new Response(null,{ status:204 }); });
        const opened = await openLiveMic({ url:liveMicUrl(window.location),token,
          source:{ onPcm:(fn) => pipeline.onPcm(fn),preroll:pipeline.preroll() },
          handlers:{ onInterim:h.onInterim,onFinal:h.onFinal,onError:h.onError } });
        if (cancelled) opened.close(); else mic = opened;
      })().catch(() => h.onError('NVIDIA speech recognition is unavailable. Type instead.'));
      const listening: Listening = { finish:() => {},cancel:() => { cancelled = true;mic?.close(); } };
      return listening;
    };
    const c = createVoiceController({
      state:() => store.getState().voice,
      dispatch:(event) => store.setState((st) => ({ voice:nextVoice(st.voice,event) })),
      openMic:async () => { const p = await openMicPipeline();handles.setState({ pipeline:p });
        return { onFrame:(fn) => p.onFrame(fn),close:() => { p.close();if (handles.getState().pipeline === p) handles.setState({ pipeline:null }); } }; },
      openEar:(h:EarHandlers,{ conversation }) => {
        const useRiva = store.getState().voice.asr === 'riva';
        if (!useRiva && !canListen()) return null;
        const ear = openEar({ listen:useRiva ? riva : listen,
          onInterim:h.onInterim,
          onUtterance:(text,endedAt) => { if (isFiller(text)) h.onSilent(); else h.onUtterance(text,endedAt); },
          onSilent:h.onSilent,onError:h.onError,
          noSpeechMs:conversation ? 15_000 : 8_000 });
        return ear;
      },
      stopVoice:(fadeMs) => voice.stop({ fadeMs }),
      abortTurn:() => {
        const { speakingLine:line,turn,finishTurn:finish } = handles.getState();
        if (line !== null) { store.setState((st) => ({ lines:cutLine(st.lines,line) }));handles.setState({ speakingLine:null }); }
        runtime.getState().abort?.abort();
        if (turn) finish(turn,'interrupted');
        store.setState({ busy:false,status:'' });
      },
      submit:(text,endedAt) => { void handles.getState().runTurn(text,'voice',endedAt); },
      playingSince:playbackStartedAt,
      onBargeIn:(r) => {
        if (r.phase === 'speaking') handles.setState({ pendingStop:r });
        else record('__monBargeIns',{ ...r,stoppedAt:null,latencyMs:null });
      },
    });
    return c;
  },[store,runtime,voice,authorize,handles]);
  useEffect(() => { handles.setState({ controller }); },[handles,controller]);
  useEffect(() => { handles.setState({ runTurn,finishTurn }); });
  useEffect(() => { store.setState((st) => ({ voice:nextVoice(st.voice,{ type:'asr',kind:config.asr }) })); },[store,config.asr]);
  useEffect(() => onPlayback((e) => {
    if (e.kind === 'start') {
      const turn = handles.getState().turn;
      if (turn && turn.firstAudioAt === null) turn.firstAudioAt = e.at;
      if (store.getState().voice.phase === 'thinking') dispatchVoice({ type:'reply-audio' });
      return;
    }
    const cut = handles.getState().pendingStop;
    if (cut) { handles.setState({ pendingStop:null });record('__monBargeIns',{ ...cut,stoppedAt:e.at,latencyMs:Math.round(e.at - cut.triggerAt) }); }
  }),[store,dispatchVoice,handles]);
  useEffect(() => () => controller.close(),[controller]);
  // Hold Space (outside a text field or button) to talk; release to finish.
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.closest('input,textarea,button,[role=button],[role=switch]') !== null || t.isContentEditable);
    const down = (e: KeyboardEvent) => { if (e.code !== 'Space' || e.repeat || typing(e.target) || !store.getState().connected) return; e.preventDefault();void controller.talk(); };
    const up = (e: KeyboardEvent) => { if (e.code !== 'Space' || typing(e.target)) return; controller.finish(); };
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);
    return () => { window.removeEventListener('keydown',down);window.removeEventListener('keyup',up); };
  },[controller,store]);

  const memoryRequest = useCallback(async (method:'GET'|'PUT'|'DELETE') => {
    if (store.getState().busy) return;
    const current=store.getState();
    if (method !== 'GET' && current.memory === null) { store.setState({ error:'Saved preferences haven’t loaded yet. Wait a moment, then try again.' });return; }
    store.setState({ busy:true,error:'' });
    const controller=new AbortController();runtime.setState({ abort:controller });
    try {
      const body=method==='PUT' ? { expectedRevision:current.memory?.revision,consent:current.consent,
        preferences:{ ...(current.memory?.preferences ?? { interests:[] }),approvedNote:current.note } }
        : method==='DELETE' ? { expectedRevision:current.memory?.revision } : undefined;
      const response=await authorize((token) => fetch('/api/memory',{ method,signal:controller.signal,
        headers:{ 'content-type':'application/json',...bearer(token) },...(body===undefined?{}:{body:JSON.stringify(body)}) }));
      if (!response.ok) throw new Error(memoryErrorMessage(method,response.status));
      const envelope=z.object({ ok:z.literal(true),data:MemorySnapshotSchema }).parse(await response.json());
      if (controller.signal.aborted) return;
      // Forget also discards this page's conversation, so a previous preference is not replayed from history.
      if (method==='DELETE') runtime.setState({ history:[] });
      const status = method==='PUT' ? `Saved. Revision ${envelope.data.revision}.`
        : method==='DELETE' ? 'Preferences forgotten. Conversation cleared.' : '';
      store.setState({ memory:envelope.data,note:envelope.data.preferences?.approvedNote??'',consent:false,
        ...(method==='DELETE'?{lines:[]}:{}),error:'',status });
    } catch(error) { if (!controller.signal.aborted) showError(error); }
    finally { if (!controller.signal.aborted) store.setState({ busy:false }); }
  },[store,runtime,authorize,showError]);

  useEffect(() => {
    let disposed=false;
    void (async () => {
      const query = new URLSearchParams(window.location.search);
      if (query.has('code') || query.has('error')) {
        const callback=parseCallback(window.location.search);
        window.history.replaceState(null,'','/nvidia.html');
        if (!callback.ok) throw new Error(callback.message);
        if (!provider.consumeState(callback.state)) throw new Error('Sign-in state did not match. Start again.');
        await completeSignIn(config.mcpUrl,provider,callback.code,callback.iss);
      }
      if (!provider.tokens()?.access_token) return;
      const connected=await connectMcp({ url:config.mcpUrl,mode:'oauth',provider });
      if (disposed) { await connected.close();return; }
      runtime.setState({ session:connected });
      // The Mon's voice before the first reply: a turn with no tool call would otherwise have no voice to speak in.
      void voice.prime(async () => (await connected.client.callTool({ name:'get_mon_status',arguments:{} })) as CallToolResult);
      store.setState({ connected:true,status:'Signed in. Your Mon and saved preferences belong to this account.' });
      void memoryRequest('GET');
    })().catch((error:unknown) => { if (!disposed) showError(error); });
    return () => { disposed=true;runtime.getState().abort?.abort();void runtime.getState().session?.close();runtime.setState({ session:null }); };
  },[provider,config.mcpUrl,store,showError,runtime,memoryRequest,voice]);

  /** One turn, typed or spoken. The reply is spoken sentence by sentence and captioned as each sentence starts. */
  async function runTurn(question:string, source:'typed'|'voice', startedAt:number) {
    const connection=runtime.getState().session;
    if (!connection || !question.trim()) { dispatchVoice({ type:'reply-done' });return; }
    voice.stop();
    runtime.getState().abort?.abort();
    store.setState({ busy:true,error:'',question:'',status:'Waiting for Nemotron on Nebius…' });
    push({ who:'Caller',text:question });
    const controller=new AbortController();runtime.setState({ abort:controller });
    const turn: TurnRecord = { source,startedAt,firstAudioAt:null,doneAt:null,outcome:'pending' };
    handles.setState({ turn });
    try {
      const tools=mcpToolsToClaude(connection.tools.filter((tool) => toolsAllowed.has(tool.name))).tools;
      const result=await runAgentTurn({ model,mcp:createTurnToolCaller({ client:connection.client,signal:controller.signal }),
        tools,history:runtime.getState().history,userText:question,signal:controller.signal,maxSteps:6,
        onEvent:(event) => {
          if (controller.signal.aborted) return;
          if (event.type!=='tool-result') return;
          // A result that carries the Mon sets the voice before its reply is spoken.
          voice.learn(event.result);push(toolResultLine(event.name,event.result));
        } });
      if (controller.signal.aborted) return;
      runtime.setState({ history:result.history });
      store.setState({ status:'',busy:false });
      if (!result.reply.trim()) { push(monLine(result.reply,result.outcome));finishTurn(turn,'finished');dispatchVoice({ type:'reply-done' });return; }
      // The caption follows the voice: each sentence appears as it starts, so a barge-in never leaves unspoken words on screen.
      push({ who:'Mon',text:'' });
      const lineId=store.getState().lines.at(-1)!.id;
      handles.setState({ speakingLine:lineId });
      const outcome=await voice.speak(result.reply,authorize,(sentence) => store.setState((st) => ({ lines:growLine(st.lines,lineId,sentence) })));
      if (handles.getState().speakingLine===lineId) handles.setState({ speakingLine:null });
      if (outcome==='finished') { finishTurn(turn,'finished');dispatchVoice({ type:'reply-done' }); }
    } catch(error) {
      if (!controller.signal.aborted) { showError(error);finishTurn(turn,'failed');dispatchVoice({ type:'reply-done' }); }
    }
    finally { if (!controller.signal.aborted) store.setState({ busy:false }); }
  }
  function finishTurn(turn:TurnRecord, outcome:TurnRecord['outcome']) {
    if (turn.outcome!=='pending') return;
    turn.outcome=outcome;turn.doneAt=performance.now();
    record('__monTurns',{ ...turn,ttfaMs:turn.firstAudioAt===null?null:Math.round(turn.firstAudioAt-turn.startedAt),turnMs:Math.round(turn.doneAt-turn.startedAt) });
  }
  async function send() {
    const current=store.getState();
    if (!runtime.getState().session || !current.question.trim()) return;
    dispatchVoice({ type:'typed' });
    await runTurn(current.question.trim(),'typed',performance.now());
  }
  function signOut() {
    controller.close();store.setState((st) => ({ voice:nextVoice(st.voice,{ type:'stop' }) }));
    voice.reset();runtime.getState().abort?.abort();void runtime.getState().session?.close();runtime.setState({ session:null });
    // Revoke at the server (RFC 7009) as well as forgetting it here: a copied refresh token stops working too.
    void revokeRefreshToken({ issuer:config.issuer,clientId:config.clientId,refreshToken:(provider.tokens() as { refresh_token?:string } | undefined)?.refresh_token });
    provider.signOut();runtime.setState({ history:[] });
    store.setState({ ...initialCompanionState(),status:'Signed out. This page no longer holds your conversation or preferences.' });
  }
  function exportMemory() {
    if (!state.memory) return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(state.memory,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='nyc-mon-memory.json';link.click();URL.revokeObjectURL(url);
    store.setState({ status:'Downloaded nyc-mon-memory.json.' });
  }
  return <Main className={PAGE}>
    <Heading className="font-display text-type-station">{TITLE}</Heading>
    <Paragraph className="text-type-caption text-text-muted">{config.modelLabel}. If Nebius doesn’t answer, nothing answers in its place.</Paragraph>
    {/* Always mounted so screen readers have the region before its text changes. */}
    <Paragraph role="status" className="text-type-caption text-text-muted">{state.status}</Paragraph>
    {!state.connected ? <Button title="Sign in as an adult Caller" onPress={() => { void beginSignIn(config.mcpUrl,provider).catch(showError); }}/> : <Button title="Sign out" variant="outline" onPress={signOut}/>}
    {state.error ? <Banner tone="danger" live="alert" title={state.error}/> : null}
    {state.connected ? <>
      <Section aria-label="Chat" className="gap-3">
        <Section aria-label="Talk to your Mon" className="gap-3">
          <View className="flex-row flex-wrap items-center gap-3">
            <Button title={talkTitle(state.voice.phase)} variant="cta" onPress={() => {
              if (state.voice.phase === 'listening') controller.finish(); else void controller.talk(); }}
              disabled={state.voice.mic === 'denied' || state.voice.asr === 'unavailable'}/>
            {state.voice.phase === 'thinking' || state.voice.phase === 'speaking'
              ? <Button title="Stop" variant="outline" onPress={() => controller.cutIn('tap')}/> : null}
          </View>
          <Switch label="Conversation mode: always listening, talk over your Mon any time" value={state.voice.conversation}
            onChange={(on) => { void controller.setConversation(on); }} disabled={state.voice.mic === 'denied' || state.voice.asr === 'unavailable'}/>
          {/* Always mounted so screen readers have the region before its text changes. */}
          <Paragraph aria-live="polite" className="text-type-caption text-text-muted">{voiceAnnouncement(state.voice)}</Paragraph>
          {state.voice.heard ? <Paragraph className="text-type-body"><Text className="font-semibold">Hearing: </Text>{state.voice.heard}</Paragraph> : null}
          <Paragraph className="text-type-caption text-text-muted">{state.voice.asr === 'riva'
            ? 'Speech to text: NVIDIA Riva (Parakeet). Hold Space to talk.' : 'Speech to text: your browser. Hold Space to talk.'}</Paragraph>
        </Section>
        <TextField surface="daylit" label="Ask your Mon" hint="Your Mon can check on itself, eat, rest, wake up and play. Typing while it talks cuts it off."
          value={state.question} onChangeText={(question) => {
            if (question && store.getState().voice.phase === 'speaking') controller.cutIn('type');
            store.setState({question}); }} disabled={state.busy}/>
        <Button title="Send" variant="cta" onPress={() => { void send(); }} disabled={state.busy}/>
        <View aria-live="polite">
          <List aria-label="Conversation" className="gap-3">
            {state.lines.map((line) => (
              <ListItem key={line.id} className="text-type-body">
                <Text className="font-semibold">{line.who}: </Text>{line.text}
                {line.cut ? <Text className="text-type-caption text-text-muted"> (cut off)</Text> : null}
                {line.detail ? <Details><Summary className="text-type-caption text-text-muted">Server response</Summary>
                  <Text className="whitespace-pre-wrap text-type-caption">{line.detail}</Text></Details> : null}
              </ListItem>
            ))}
          </List>
        </View>
      </Section>
      <Section className="gap-3">
        <Heading level={2} className="text-type-title">Saved preferences</Heading>
        <Paragraph className="text-type-body">Only save information you approve. Do not include passwords or sensitive personal details. Saved preferences are sent to Nebius with model requests. Chat history is not stored here.</Paragraph>
        {state.memory === null && !state.busy ? <Button title="Reload saved preferences" variant="outline" onPress={() => { void memoryRequest('GET'); }}/> : null}
        <TextField surface="daylit" label="What should your Mon remember?" hint={`Up to ${NOTE_MAX} characters. ${NOTE_MAX - state.note.length} left.`}
          value={state.note} onChangeText={(note) => store.setState({note:note.slice(0,NOTE_MAX)})} disabled={state.busy || !state.memory}/>
        <Switch label="Save this for my Mon to use" value={state.consent} onChange={(consent) => store.setState({consent})} disabled={state.busy || !state.memory}/>
        <View className="flex-row flex-wrap gap-3">
          <Button title="Save preferences" variant="outline" onPress={() => { void memoryRequest('PUT'); }} disabled={state.busy || !state.memory || !state.consent}/>
          <Button title="Forget preferences" variant="danger" onPress={() => store.setState({ confirmForget:true })} disabled={state.busy || !state.memory}/>
          <Button title="Download preferences (JSON)" variant="outline" onPress={exportMemory} disabled={!state.memory}/>
        </View>
        <Paragraph className="text-type-caption text-text-muted">Revision {state.memory?.revision ?? '(not loaded)'}. Sign in from another browser to see the same preferences.</Paragraph>
      </Section>
      <Dialog open={state.confirmForget} onClose={() => store.setState({ confirmForget:false })}
        title="Forget your saved preferences?"
        description="Your Mon will stop using them, and this conversation will be cleared. This can’t be undone."
        actions={<>
          <Button title="Keep preferences" variant="outline" onPress={() => store.setState({ confirmForget:false })}/>
          <Button title="Forget preferences" variant="danger" onPress={() => { store.setState({ confirmForget:false }); void memoryRequest('DELETE'); }}/>
        </>}/>
    </>:null}
  </Main>;
}
async function boot() {
  const element=document.getElementById('root');if (!element) throw new Error('Missing app root.');
  const root=createRoot(element);
  const fail = (title:string, description:string) => root.render(<Main className={PAGE}>
    <Heading className="font-display text-type-station">{TITLE}</Heading>
    <Banner tone="danger" live="alert" title={title} description={description}/>
  </Main>);
  if (!safeStorage('session')) { fail('This browser is blocking session storage, which sign-in needs.','Turn off private mode or allow site data, then reload.');return; }
  try {
    const response=await fetch('/api/nvidia/config',{cache:'no-store'});
    if (!response.ok) throw new Error(`config ${response.status}`);
    root.render(<Companion config={ConfigSchema.parse(await response.json())}/>);
  } catch { fail('The companion server isn’t answering.','Reload in a minute.'); }
}
void boot();
