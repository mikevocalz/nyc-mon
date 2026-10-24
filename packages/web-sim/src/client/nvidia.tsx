import './rn-globals.ts';
import './globals.css';
import { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { Button, Switch, TextField, useInstanceStore, useStore } from '@acme/ui';
import { Heading, Paragraph, Section } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import { SimOAuthProvider, parseCallback } from '../shared/auth.ts';
import { runAgentTurn } from '../shared/agentLoop.ts';
import { mcpToolsToClaude } from '../shared/toolSpec.ts';
import { beginSignIn, completeSignIn, connectMcp, type McpSession } from './mcp.ts';
import { createAuthorize, bearer, sdkRefresh } from './freshToken.ts';
import { httpModelClient } from './modelClient.ts';
import { safeStorage } from './session.ts';
import { MemorySnapshotSchema, type MemorySnapshot } from '../../../payload/src/admin/console/v1/companion-memory-store.ts';

const Config = z.object({ mcpUrl:z.string().url(),clientId:z.string().min(1),modelBackend:z.literal('nebius'),modelLabel:z.string() });
type Config = z.infer<typeof Config>;
interface State { connected:boolean;busy:boolean;question:string;note:string;consent:boolean;memory:MemorySnapshot|null;error:string;lines:string[] }
const toolsAllowed = new Set(['get_mon_status','check_on_mon','check_incubation','hatch_egg','talk_to_mon','feed_mon','rest_mon','wake_mon','play_with_mon']);

function Companion({ config }: { config:Config }) {
  const store = useInstanceStore<State>(() => ({ connected:false,busy:false,question:'',note:'',consent:false,memory:null,error:'',lines:[] }));
  const state = useStore(store);
  const session = useRef<McpSession|null>(null);
  const history = useRef<Anthropic.MessageParam[]>([]);
  const abort = useRef<AbortController|null>(null);
  const provider = useMemo(() => {
    const storage = safeStorage('session');
    if (!storage) throw new Error('Session storage is required for secure sign-in.');
    return new SimOAuthProvider({ clientId:config.clientId,store:storage,
      redirectUrl:new URL('/nvidia.html',window.location.origin).href,navigate:(url) => window.location.assign(url.href) });
  },[config.clientId]);
  const authorize = useMemo(() => createAuthorize({ store:provider,refresh:sdkRefresh(config.mcpUrl,provider),
    onSignedOut:() => { abort.current?.abort(); history.current=[]; store.setState({ connected:false,memory:null,note:'',consent:false,lines:[] }); } }),[provider,config.mcpUrl,store]);
  const model = useMemo(() => httpModelClient('/api/model',fetch,authorize),[authorize]);
  const showError = (error:unknown) => store.setState({ error:error instanceof Error ? error.message : 'The request failed.' });

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
      session.current=connected;store.setState({ connected:true });
    })().catch((error:unknown) => { if (!disposed) showError(error); });
    return () => { disposed=true;abort.current?.abort();void session.current?.close();session.current=null; };
  },[provider,config.mcpUrl,store]);

  async function memoryRequest(method:'GET'|'PUT'|'DELETE') {
    if (store.getState().busy) return;
    const current=store.getState();
    if (method !== 'GET' && current.memory === null) { store.setState({ error:'Load memory before changing it.' });return; }
    store.setState({ busy:true,error:'' });
    const controller=new AbortController();abort.current=controller;
    try {
      const body=method==='PUT' ? { expectedRevision:current.memory?.revision,consent:current.consent,
        preferences:{ ...(current.memory?.preferences ?? { interests:[] }),approvedNote:current.note } }
        : method==='DELETE' ? { expectedRevision:current.memory?.revision } : undefined;
      const response=await authorize((token) => fetch('/api/memory',{ method,signal:controller.signal,
        headers:{ 'content-type':'application/json',...bearer(token) },...(body===undefined?{}:{body:JSON.stringify(body)}) }));
      if (!response.ok) throw new Error(response.status===409?'Memory changed in another session. Load it again.':'Memory was not saved. Check sign-in and backend availability.');
      const envelope=z.object({ ok:z.literal(true),data:MemorySnapshotSchema }).parse(await response.json());
      if (controller.signal.aborted) return;
      // Forget also discards this page's conversation, so a previous preference is not replayed from history.
      if (method==='DELETE') history.current=[];
      store.setState({ memory:envelope.data,note:envelope.data.preferences?.approvedNote??'',consent:false,
        ...(method==='DELETE'?{lines:[]}:{}),error:'' });
    } catch(error) { if (!controller.signal.aborted) showError(error); }
    finally { if (!controller.signal.aborted) store.setState({ busy:false }); }
  }
  async function send() {
    const current=store.getState();const connection=session.current;
    if (current.busy || !connection || !current.question.trim()) return;
    const question=current.question.trim();store.setState({ busy:true,error:'',question:'',lines:[...current.lines,`Caller: ${question}`].slice(-40) });
    const controller=new AbortController();abort.current=controller;
    try {
      const tools=mcpToolsToClaude(connection.tools.filter((tool) => toolsAllowed.has(tool.name))).tools;
      const result=await runAgentTurn({ model,mcp:{ callTool:(name,args) => connection.client.callTool({ name,arguments:args }) },
        tools,history:history.current,userText:question,signal:controller.signal,maxSteps:6,
        onEvent:(event) => {
          if (event.type==='tool-result') store.setState((previous) => ({ lines:[...previous.lines,
            `${event.name}: ${event.result.isError?'refused or failed':'completed'} — ${JSON.stringify(event.result.structuredContent ?? event.result.content).slice(0,2500)}`].slice(-40) }));
        } });
      if (controller.signal.aborted) return;
      history.current=result.history;
      store.setState((previous) => ({ lines:[...previous.lines,`Mon: ${result.reply || result.outcome}`].slice(-40) }));
    } catch(error) { if (!controller.signal.aborted) showError(error); }
    finally { if (!controller.signal.aborted) store.setState({ busy:false }); }
  }
  function signOut() {
    abort.current?.abort();void session.current?.close();session.current=null;provider.signOut();history.current=[];
    store.setState({ connected:false,busy:false,question:'',note:'',consent:false,memory:null,error:'',lines:[] });
  }
  function exportMemory() {
    if (!state.memory) return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(state.memory,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='nyc-mon-memory.json';link.click();URL.revokeObjectURL(url);
  }
  return <Section className="mx-auto max-w-3xl gap-5 p-5">
    <Heading>NYC-Mon Personal Companion</Heading>
    <Paragraph>{config.modelLabel}. Live services only; no scripted fallback.</Paragraph>
    {!state.connected ? <Button title="Sign in as an adult Caller" onPress={() => { void beginSignIn(config.mcpUrl,provider).catch(showError); }}/> : <Button title="Sign out" variant="outline" onPress={signOut}/>}
    {state.error ? <Paragraph role="alert">{state.error}</Paragraph>:null}
    {state.connected ? <View className="gap-5">
      <TextField label="Ask your Mon" value={state.question} onChangeText={(question) => store.setState({question})} disabled={state.busy}/>
      <Button title={state.busy?'Working…':'Send'} onPress={() => { void send(); }} disabled={state.busy}/>
      <View aria-live="polite" className="gap-3">{state.lines.map((line,index) => <Paragraph key={index}>{line}</Paragraph>)}</View>
      <Heading>Memory you control</Heading>
      <Paragraph>Only save information you approve. Do not include passwords or sensitive personal details. Saved preferences are sent to Nebius with model requests. Chat history is not stored here.</Paragraph>
      <Button title="Load / refresh memory" variant="outline" onPress={() => { void memoryRequest('GET'); }} disabled={state.busy}/>
      <TextField label="Approved preferences (500 characters maximum)" value={state.note} onChangeText={(note) => store.setState({note:note.slice(0,500)})} disabled={state.busy || !state.memory}/>
      <Switch label="I approve saving these preferences" value={state.consent} onChange={(consent) => store.setState({consent})}/>
      <View className="flex-row flex-wrap gap-3">
        <Button title="Save approved memory" onPress={() => { void memoryRequest('PUT'); }} disabled={state.busy || !state.memory || !state.consent}/>
        <Button title="Forget all saved preferences" variant="outline" onPress={() => { void memoryRequest('DELETE'); }} disabled={state.busy || !state.memory}/>
        <Button title="Export my memory" variant="outline" onPress={exportMemory} disabled={!state.memory}/>
      </View>
      <Paragraph>Revision: {state.memory?.revision ?? 'not loaded'}. A new browser session reads the same authenticated account, not a local fixture.</Paragraph>
    </View>:null}
  </Section>;
}
async function boot() {
  const element=document.getElementById('root');if (!element) throw new Error('Missing app root.');
  const root=createRoot(element);
  try { const response=await fetch('/api/nvidia/config',{cache:'no-store'});if(!response.ok)throw new Error('NVIDIA server unavailable.');
    root.render(<Companion config={Config.parse(await response.json())}/>);
  } catch { root.render(<Paragraph role="alert">Start the NVIDIA companion server and check its nonsecret configuration.</Paragraph>); }
}
void boot();
