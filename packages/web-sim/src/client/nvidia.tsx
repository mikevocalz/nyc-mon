import './rn-globals.ts';
import './globals.css';
import { useCallback, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { Banner, Button, Dialog, Switch, TextField, useInstanceStore, useStore } from '@acme/ui';
import { Details, Heading, List, ListItem, Main, Paragraph, Section, Summary, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { SimOAuthProvider, parseCallback } from '../shared/auth.ts';
import { runAgentTurn } from '../shared/agentLoop.ts';
import { mcpToolsToClaude } from '../shared/toolSpec.ts';
import { beginSignIn, completeSignIn, connectMcp } from './mcp.ts';
import { createAuthorize, bearer, sdkRefresh } from './freshToken.ts';
import { httpModelClient } from './modelClient.ts';
import { safeStorage } from './session.ts';
import { createTurnToolCaller } from './turnTools.ts';
import { createCompanionVoice } from './companionVoice.ts';
import { monSpeechPort } from './monSpeechPort.ts';
import { clearSessionVoice, setSessionVoice, stopSpeaking } from './speech.ts';
import {
  appendLine, errorMessage, expireSession, initialCompanionState, memoryErrorMessage, monLine, toolResultLine,
  type CompanionRuntime, type CompanionState, type Line,
} from './companionState.ts';
import { MemorySnapshotSchema } from '@acme/core/schemas';

const ConfigSchema = z.object({ mcpUrl:z.string().url(),clientId:z.string().min(1),modelBackend:z.literal('nebius'),modelLabel:z.string() });
type Config = z.infer<typeof ConfigSchema>;
const toolsAllowed = new Set(['get_mon_status','check_on_mon','check_incubation','hatch_egg','talk_to_mon','feed_mon','rest_mon','wake_mon','play_with_mon']);
const NOTE_MAX = 500;
const PAGE = 'mx-auto w-full max-w-content-feed gap-6 px-4 py-6 md:px-6';
const TITLE = 'NYC-Mon Personal Companion';
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

  async function send() {
    const current=store.getState();const connection=runtime.getState().session;
    if (current.busy || !connection || !current.question.trim()) return;
    const question=current.question.trim();
    store.setState({ busy:true,error:'',question:'',status:'Waiting for Nemotron on Nebius…' });
    push({ who:'Caller',text:question });
    voice.stop();
    const controller=new AbortController();runtime.setState({ abort:controller });
    controller.signal.addEventListener('abort',() => voice.stop(),{ once:true });
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
      push(monLine(result.reply,result.outcome));
      if (result.reply.trim()) void voice.speak(result.reply,authorize);
      store.setState({ status:'' });
    } catch(error) { if (!controller.signal.aborted) showError(error); }
    finally { if (!controller.signal.aborted) store.setState({ busy:false }); }
  }
  function signOut() {
    voice.reset();runtime.getState().abort?.abort();void runtime.getState().session?.close();runtime.setState({ session:null });provider.signOut();runtime.setState({ history:[] });
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
        <TextField surface="daylit" label="Ask your Mon" hint="Your Mon can check on itself, eat, rest, wake up and play."
          value={state.question} onChangeText={(question) => store.setState({question})} disabled={state.busy}/>
        <Button title="Send" variant="cta" onPress={() => { void send(); }} disabled={state.busy}/>
        <View aria-live="polite">
          <List aria-label="Conversation" className="gap-3">
            {state.lines.map((line) => (
              <ListItem key={line.id} className="text-type-body">
                <Text className="font-semibold">{line.who}: </Text>{line.text}
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
