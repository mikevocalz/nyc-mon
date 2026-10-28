# 06 Handoff: companion UI patch list

For the integrator. Base: `origin/feat/nvidia-05-submission-package` at `6f59ab27`. Skill loaded: `design:design-handoff`.

**Status of this code: written against the source read in this lane, not applied, not compiled, not run.** Lane D was read-only. Every patch needs `pnpm -F web-sim typecheck`, the web-sim tests and a browser pass by the Browser QA lane before merge.

Constraints kept (execution prompt §5): `@acme/ui` and `@acme/ui/html` components only, Zustand instance store for state (no `useState`), no new dependencies, no hex, no kit edits, no change to the agent loop or auth backend.

Files touched: `packages/web-sim/server/model.ts`, `packages/web-sim/src/client/nvidia.tsx`, `packages/web-sim/src/client/modelClient.ts`, `packages/web-sim/nvidia.html`, plus one new test file.

---

## P1 Honest provider errors (rank 1)

**`packages/web-sim/server/model.ts:297`**, at the top of `describeModelError`, before the Anthropic checks. Name checks avoid importing `nebius.ts` into the shared handler.

```ts
export function describeModelError(err: unknown): { message: string; retry: boolean } {
  if (err instanceof Error && err.name === 'NebiusError') {
    const { code, status } = err as Error & { code?: string; status?: number };
    if (code === 'TIMEOUT') return { message: 'Nemotron on Nebius didn’t answer within 60 seconds. No other model answered instead. Try again.', retry: true };
    if (code === 'HTTP' && status === 429) return { message: 'Nebius is limiting requests right now. Wait a minute and try again.', retry: true };
    if (code === 'HTTP') return { message: `Nebius returned an error${status ? ` (${status})` : ''}. No other model was used. Try again.`, retry: true };
    if (code === 'RESPONSE') return { message: 'Nebius sent a reply this page couldn’t use. No other model was used. Try again.', retry: true };
    return { message: 'This conversation couldn’t be sent to Nebius. Start a new conversation.', retry: false };
  }
  if (err instanceof Error && err.name === 'CompanionMemoryError') {
    return { message: 'Your saved preferences couldn’t be checked, so nothing was sent to the model. Try again.', retry: true };
  }
  // ...existing Anthropic/Bedrock branches unchanged
```

Why here: `nvidia-main.ts:61-62` builds the handler from `createModelHandler`, whose stream catch (`model.ts:391-392`) sends `describeModelError(err)` as the SSE error event; `modelClient.ts:94` shows that message as-is. The 60 s figure matches `nebius.ts:21` (`timeoutMs` default 60000), which `nvidia-main.ts:20-21` does not override. If that changes, pass the value in.

**Test** (new, `packages/web-sim/test/describeModelError.test.ts`): construct `new NebiusError('TIMEOUT')`, `new NebiusError('HTTP', 429)`, `new NebiusError('HTTP', 502)`, `new NebiusError('RESPONSE')`, `new NebiusError('INPUT')`, `new CompanionMemoryError(503)`; assert each message and `retry`. Assert no message contains "Bedrock" or "AWS".

## P2 Readable care outcomes (rank 2)

**`nvidia.tsx:18-25`**, imports and constants:

```ts
import { Banner, Button, Dialog, Switch, TextField, useInstanceStore, useStore } from '@acme/ui';
import { Details, Heading, List, ListItem, Main, Paragraph, Section, Summary, Text } from '@acme/ui/html';
import { toolOutcome, type ToolOutcome } from '../shared/toolOutcome.ts';
import type { TurnOutcome } from '../shared/agentLoop.ts';
import { captionText } from './caption.ts';

type Line = { id: number; who: 'Caller' | 'Mon' | 'Result'; text: string; detail?: string };
interface State { connected:boolean;busy:boolean;question:string;note:string;consent:boolean;memory:MemorySnapshot|null;
  error:string;status:string;confirmForget:boolean;lines:Line[];nextId:number }

const ACTION: Record<string, string> = { get_mon_status:'Status', check_on_mon:'Check-in', check_incubation:'Egg check',
  hatch_egg:'Hatch', talk_to_mon:'Talk', feed_mon:'Feed', rest_mon:'Rest', wake_mon:'Wake', play_with_mon:'Play' };
const OUTCOME: Record<ToolOutcome, string> = {
  applied: 'done. The server saved the change.',
  declined: 'not done. The server declined it, so nothing changed.',
  failed: 'failed. Nothing changed. Try again.',
  returned: 'checked.',
  unverified: 'the server’s answer couldn’t be read, so this isn’t counted as done.',
};
const EMPTY_REPLY: Record<TurnOutcome, string> = {
  done: 'No reply text.',
  refused: 'The model declined to answer. Try asking another way.',
  truncated: 'The reply was cut off at the length limit.',
  'step-limit': 'Your Mon tried too many steps and stopped. Try a simpler request.',
};
```

Initial state `nvidia.tsx:28` gains `status:'', confirmForget:false, lines:[], nextId:0`. Add one helper inside `Companion`:

```ts
const push = useCallback((line: Omit<Line, 'id'>) => store.setState((s) => ({
  lines: [...s.lines, { ...line, id: s.nextId }].slice(-40), nextId: s.nextId + 1 })), [store]);
```

Stable ids replace `key={index}`, so trimming to 40 no longer shifts text under existing keys (04, live-region keys).

**`nvidia.tsx:90`**: `push({ who:'Caller', text:question })` after the existing `setState` (drop the string from `lines` there).

**`nvidia.tsx:98-99`**, the tool-result branch:

```ts
if (event.type === 'tool-result') {
  const outcome = toolOutcome(event.result);
  push({ who: 'Result', text: `${ACTION[event.name] ?? event.name}: ${OUTCOME[outcome]}`,
    detail: JSON.stringify(event.result.structuredContent ?? event.result.content, null, 2).slice(0, 2500) });
}
```

**`nvidia.tsx:103`**: see P7.

**`nvidia.tsx:124`**, the log:

```tsx
<List aria-live="polite" aria-relevant="additions" aria-label="Conversation" className="gap-3">
  {state.lines.map((line) => (
    <ListItem key={line.id} className="text-type-body">
      <Text className="font-semibold">{line.who}: </Text>{line.text}
      {line.detail ? <Details><Summary className="text-type-caption text-text-muted">Server response</Summary>
        <Text className="whitespace-pre-wrap text-type-caption">{line.detail}</Text></Details> : null}
    </ListItem>
  ))}
</List>
```

Closed `<details>` content is not exposed to assistive tech, so the live region announces the sentence only. Not verified with a screen reader. If `List` does not forward `aria-live` (it is a `css()`-wrapped `<ul>`, `packages/ui/html/index.tsx:74`; not verified), wrap it in `<View aria-live="polite">` as today.

## P3 Load preferences on connect (rank 3)

Wrap `memoryRequest` (`nvidia.tsx:65-86`) in `useCallback` with deps `[store, runtime, authorize, showError]`. In the connect effect, after `store.setState({ connected:true })` at `:60`:

```ts
store.setState({ connected: true, status: 'Signed in. Your Mon and saved preferences belong to this account.' });
void memoryRequest('GET');
```

Add `memoryRequest` to the effect's deps.

**`nvidia.tsx:127`**: render the button only as a retry, `{state.memory === null && !state.busy ? <Button title="Reload saved preferences" variant="outline" … /> : null}`.

**`nvidia.tsx:129`**: `disabled={state.busy || !state.memory}` on the Switch.

## P4 Sign-in expiry reaches the screen (rank 4)

**`nvidia.tsx:38-41`**, `onSignedOut`:

```ts
const onSignedOut = useCallback(() => {
  runtime.getState().abort?.abort(); runtime.setState({ history: [] });
  store.setState({ connected:false, busy:false, memory:null, note:'', consent:false, lines:[], status:'',
    error: 'Your sign-in expired. Sign in again to keep talking.' });
}, [store, runtime]);
```

Why: the abort makes `send`'s `catch` skip `showError` and its `finally` skip `busy:false` (`:104-105`), so today the person is signed out with no message (by source; not verified at runtime). Setting both here covers every caller of `authorize`.

**Test**: the existing `freshToken` tests cover `onSignedOut` firing; add a component-level check only if web-sim has a DOM test setup (not verified).

## P5 Status messages (rank 5)

Render once, always mounted, directly under the header (before the conditional block), so the region exists before its text changes:

```tsx
<Paragraph role="status" className="text-type-caption text-text-muted">{state.status}</Paragraph>
```

Set `status` at these points:

| Where | Value |
|---|---|
| `send`, start (`:90`) | `Waiting for Nemotron on Nebius…` |
| `send`, after reply (`:103`) | `''` |
| `memoryRequest` success, `PUT` (`:82`) | `` `Saved. Revision ${envelope.data.revision}.` `` |
| `memoryRequest` success, `DELETE` | `Preferences forgotten. Conversation cleared.` |
| `memoryRequest` success, `GET` | `''` |
| `exportMemory` (`:114`) | `Downloaded nyc-mon-memory.json.` |
| `signOut` (`:109`) | `Signed out. This page no longer holds your conversation or preferences.` |
| connect (`:60`) | P3 |
| any error | `''` (the Banner carries it) |

**`nvidia.tsx:123`**: `title="Send"` always; keep `disabled={state.busy}`.

## P6 Confirm Forget (rank 6)

**`nvidia.tsx:132`**:

```tsx
<Button title="Forget preferences" variant="danger" disabled={state.busy || !state.memory}
  onPress={() => store.setState({ confirmForget: true })}/>
<Dialog open={state.confirmForget} onClose={() => store.setState({ confirmForget: false })}
  title="Forget your saved preferences?"
  description="Your Mon will stop using them, and this conversation will be cleared. This can’t be undone."
  actions={<>
    <Button title="Keep preferences" variant="outline" onPress={() => store.setState({ confirmForget: false })}/>
    <Button title="Forget preferences" variant="danger"
      onPress={() => { store.setState({ confirmForget: false }); void memoryRequest('DELETE'); }}/>
  </>}/>
```

`Dialog` (`packages/ui/Dialog.tsx:246`) traps focus and closes on Escape per its header comment. Danger label `ink-950` on `apple-500` is 4.83:1; edge `apple-950` against page 15.99:1. Focus return to the trigger after close: not verified.

## P7 Mon lines and empty replies (rank 7)

**`nvidia.tsx:103`**:

```ts
push({ who: 'Mon', text: result.reply.trim() ? captionText(result.reply) : EMPTY_REPLY[result.outcome] });
```

`captionText` (`src/client/caption.ts:8`) spells "Callah" as "Caller" on screen and drops `*stage directions*`, matching the main simulator (`App.tsx:1186`).

## P8 Layout and type tokens (rank 8)

**`nvidia.tsx:116`**: root becomes
`<Main className="mx-auto w-full max-w-content-feed gap-6 px-4 py-6 md:px-6">` (closing tag at `:137`).

**`nvidia.tsx:117`**: `<Heading className="font-display text-type-station">NYC-Mon Personal Companion</Heading>`

**`nvidia.tsx:118`**: `<Paragraph className="text-type-caption text-text-muted">Replies come from NVIDIA {modelId} on Nebius Token Factory. If Nebius doesn’t answer, nothing answers in its place.</Paragraph>`
`modelId` is not in the public config today (`nvidia-env.ts:41-44` sends only `modelLabel`). Either add `modelId: env.SIM_NEBIUS_MODEL_ID` there and to `ConfigSchema` (`nvidia.tsx:21`), or keep `{config.modelLabel}.` and change only the second sentence.

**`nvidia.tsx:121`**: `<Section aria-label="Chat" className="gap-3">`.

**`nvidia.tsx:125`**: `<Heading level={2} className="text-type-title">Saved preferences</Heading>` and wrap `:125-135` in `<Section className="gap-3">`.

**`nvidia.tsx:126,135`**: add `className="text-type-body"` and `className="text-type-caption text-text-muted"`.

**`nvidia.tsx:130`**: `gap-target-gap` → `gap-3`.

All classes exist in `theme.css`: `--container-content-feed` (248), `--text-type-station` (206), `--text-type-title` (209), `--text-type-caption` (221), `--font-display` (170).

## P9 Errors as Banner, boot failure framed (rank 9)

**`nvidia.tsx:120`**: `{state.error ? <Banner tone="danger" live="alert" title={state.error}/> : null}`

**`nvidia.tsx:139-145`**, `boot()`: check storage before rendering (moves the throw out of render at `:34`) and frame failures the same way.

```tsx
async function boot() {
  const element = document.getElementById('root'); if (!element) throw new Error('Missing app root.');
  const root = createRoot(element);
  const fail = (title: string, description: string) => root.render(
    <Main className="mx-auto w-full max-w-content-feed gap-6 px-4 py-6 md:px-6">
      <Heading className="font-display text-type-station">NYC-Mon Personal Companion</Heading>
      <Banner tone="danger" live="alert" title={title} description={description}/>
    </Main>);
  if (!safeStorage('session')) { fail('This browser is blocking session storage, which sign-in needs.', 'Turn off private mode or allow site data, then reload.'); return; }
  try {
    const response = await fetch('/api/nvidia/config', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    root.render(<Companion config={ConfigSchema.parse(await response.json())}/>);
  } catch { fail('The companion server isn’t answering.', 'Reload in a minute.'); }
}
```

`:34` keeps its throw as a guard; it no longer fires in practice.

## P10 Field surfaces and one primary (rank 10)

- **`nvidia.tsx:122`**: `<TextField surface="daylit" label="Ask your Mon" hint="Your Mon can check on itself, eat, rest, wake up and play." …/>`
- **`nvidia.tsx:123`**: `<Button title="Send" variant="cta" …/>`
- **`nvidia.tsx:128`**: `<TextField surface="daylit" label="What should your Mon remember?" hint={`Up to 500 characters. ${500 - state.note.length} left.`} …/>`
- **`nvidia.tsx:129`**: `label="Save this for my Mon to use"`
- **`nvidia.tsx:131`**: `title="Save preferences"`, `variant="outline"`
- **`nvidia.tsx:133`**: `title="Download preferences (JSON)"`
- **`nvidia.tsx:135`**: `Revision {state.memory?.revision ?? '(not loaded)'}. Sign in from another browser to see the same preferences.`

Daylit field contrast: border `text-muted` vs page 5.33:1, vs raised face 5.87:1; input text black on white 21:1; focus border `royal-500` 5.08:1 on page.

## Small copy and markup patches

| File:line | Change |
|---|---|
| `nvidia.tsx:44` | `'The request failed.'` → `'Something on this page failed. Reload and try again.'` |
| `nvidia.tsx:68` | → `'Saved preferences haven’t loaded yet. Wait a moment, then try again.'` |
| `nvidia.tsx:77` | Replace the single message with a per-method map: GET `Saved preferences couldn’t be loaded. Try again.`, PUT `Preferences weren’t saved. Try again.`, DELETE `Preferences weren’t forgotten. Try again.`; 409 `Your preferences changed in another session. Reload them, then save again.` |
| `nvidia.tsx:142` | Drop the `'NVIDIA server unavailable.'` message (P9 handles it) |
| `modelClient.ts:75` | `'The simulator server didn’t answer. Check that it’s running.'` → `'The companion server didn’t answer. Try again.'` Shared with the main simulator; check its tests (`grep -rn "simulator server" packages/web-sim/test`) before changing |
| `nvidia.html:2` | `content="light dark"` → `content="light"` |

## States checklist for Browser QA

| Element | State | Expected |
|---|---|---|
| Page | Config fetch fails | Header + danger Banner "The companion server isn’t answering." |
| Page | Session storage blocked | Header + danger Banner (P9) |
| Sign in | Cancelled at provider | Banner "Sign-in was cancelled. Sign in again to talk to your Mon." |
| Signed in | After redirect | Status "Signed in…"; preferences load without a click |
| Send | Waiting | Status "Waiting for Nemotron on Nebius…"; Send disabled |
| Send | Nebius timeout | Banner names Nebius and the 60 s limit |
| Care | Applied / declined | `Feed: done…` / `Feed: not done…`; JSON closed under "Server response" |
| Mon | Empty reply | Outcome sentence, never a code |
| Save | Success | Status "Saved. Revision N." |
| Forget | Click | Dialog; Escape and Keep close it with no request |
| Forget | Confirm | Status "Preferences forgotten. Conversation cleared."; log empty |
| Export | Click | File downloads; status line |
| Token refused mid-turn | | Signed-out view with "Your sign-in expired…" Banner, Send not stuck |
| Sign out | Click | Status "Signed out…" |
| Keyboard | Tab through page | Field → Send → log disclosures → preference field → switch → Save → Forget → Download → Sign out (Sign out sits in the header today; order follows DOM) |
| Reduced motion | OS setting on | Switch and buttons move instantly |
