# 03 Copy sheet: companion UI

Source: `origin/feat/nvidia-05-submission-package` at `6f59ab27`. Skills loaded: `design:ux-copy`, `no-ai-slop`. Rules from `docs/COPY_DECK.md` ("Two voices", "Caller and Callah", "Banned words", "Tone").

All strings below are `voice: "ui"`. The page has no authored `character` strings; Mon speech comes from the model at runtime.

## Caller and Callah

- UI copy uses **Caller** correctly: `nvidia.tsx:90` (`Caller: …` log prefix) and `:119` (sign-in button). No "Callah", "owner", "user" or "trainer" in any UI string on this page.
- **Mon replies are shown raw** (`nvidia.tsx:103`). The main simulator passes spoken lines through `captionText` (`src/client/caption.ts:8-21`), which spells "Callah" as "Caller" on screen (per its header, ADR 0008: "on screen the word is always spelled Caller") and drops `*stage directions*`. The NVIDIA page skips it, so a judge can see `Say less, Callah. *chuckle*` as text. Proposed: run Mon lines through `captionText` so both surfaces show the same words. If the team reads COPY_DECK as allowing "Callah" inside character text on screen, this becomes a decision; the two documents disagree and the caption code is what the main app ships.

## String table

`File:line` | current | problem | proposed. Proposed strings follow "what happened, then what to do", sentence case, no apology, no em dashes.

### Header and sign-in

| # | File:line | Current | Problem | Proposed |
|---|---|---|---|---|
| C1 | `nvidia.html:2` | `NYC-Mon Personal Companion` (title) | Fine | Keep |
| C2 | `nvidia.tsx:117` | `NYC-Mon Personal Companion` | Fine | Keep |
| C3 | `nvidia.tsx:118` | `{modelLabel}. Live services only; no scripted fallback.` (`modelLabel` = `NVIDIA <id> on Nebius Token Factory`, `nvidia-env.ts:43`) | Second sentence is developer speak | `Replies come from NVIDIA {modelId} on Nebius Token Factory. If Nebius doesn't answer, nothing answers in its place.` |
| C4 | `nvidia.tsx:119` | `Sign in as an adult Caller` | Fine. "adult" is load-bearing (age gate) | Keep |
| C5 | new, after sign-in | (none) | No confirmation of who is signed in | `Signed in. Your Mon and saved preferences belong to this account.` (no account name: the page does not have one in state today) |
| C6 | `nvidia.tsx:119` | `Sign out` | Fine | Keep |
| C7 | new, after sign-out | (none) | Silent reset | `Signed out. This page no longer holds your conversation or preferences.` |

### Chat

| # | File:line | Current | Problem | Proposed |
|---|---|---|---|---|
| C8 | `nvidia.tsx:122` | `Ask your Mon` (field label) | Fine | Keep. Add `hint="Your Mon can check on itself, eat, rest, wake up and play."` from the allowed tool list (`:25`) |
| C9 | `nvidia.tsx:123` | `Send` / `Working…` | Busy label lives on a disabled button; screen readers don't hear it | Button stays `Send`; a status line says `Waiting for Nemotron on Nebius…` (C10) |
| C10 | new | (none) | No progress text | `Waiting for Nemotron on Nebius…` in a `role="status"` region |
| C11 | `nvidia.tsx:90` | `Caller: {question}` | Fine | Keep the speaker label `Caller` |
| C12 | `nvidia.tsx:103` | `Mon: {reply || outcome}` | Empty reply prints the code `step-limit`, `refused`, `truncated`, `done` | Reply text via `captionText`. Empty reply by outcome: `refused` → `The model declined to answer. Try asking another way.`; `truncated` → `The reply was cut off at the length limit.`; `step-limit` → `Your Mon tried too many steps and stopped. Try a simpler request.`; `done` → `No reply text.` |

### Care-action confirmation (tool results)

| # | File:line | Current | Problem | Proposed |
|---|---|---|---|---|
| C13 | `nvidia.tsx:99` | `{tool}: {outcome} — {JSON up to 2,500 chars}` | Raw tool id, raw JSON, em dash; read aloud in full by the live region | Sentence first, JSON in a closed `Details` labelled `Server response`. One line per outcome (C14 to C18) |
| C14 | new (`applied`) | | | `{Action}: done. The server saved the change.` |
| C15 | new (`declined`) | | | `{Action}: not done. The server declined it, so nothing changed.` |
| C16 | new (`failed`) | | | `{Action}: failed. Nothing changed. Try again.` |
| C17 | new (`returned`) | | | `{Action}: checked.` |
| C18 | new (`unverified`) | | | `{Action}: the server's answer couldn't be read, so this isn't counted as done.` |
| C19 | new, action names | `get_mon_status`, `check_on_mon`, `check_incubation`, `hatch_egg`, `talk_to_mon`, `feed_mon`, `rest_mon`, `wake_mon`, `play_with_mon` | Tool ids are not words | `Status`, `Check-in`, `Egg check`, `Hatch`, `Talk`, `Feed`, `Rest`, `Wake`, `Play` |

### Memory you control

| # | File:line | Current | Problem | Proposed |
|---|---|---|---|---|
| C20 | `nvidia.tsx:125` | `Memory you control` | Fine | `Saved preferences` (names the thing; matches button wording) |
| C21 | `nvidia.tsx:126` | `Only save information you approve. Do not include passwords or sensitive personal details. Saved preferences are sent to Nebius with model requests. Chat history is not stored here.` | Accurate; four sentences in one block | `Your Mon remembers only what you save here. Saved preferences go to Nebius with each message. Your chat isn't saved. Don't save passwords or private details.` |
| C22 | `nvidia.tsx:127` | `Load / refresh memory` | Slash label; step should not exist | Remove: load on connect. If kept as a retry after an error: `Reload saved preferences` |
| C23 | `nvidia.tsx:128` | `Approved preferences (500 characters maximum)` | Limit belongs in the hint | Label `What should your Mon remember?`, hint `Up to 500 characters. {n} left.` |
| C24 | `nvidia.tsx:129` | `I approve saving these preferences` | Fine | `Save this for my Mon to use` (Switch label) |
| C25 | `nvidia.tsx:131` | `Save approved memory` | "memory" and "preferences" both used | `Save preferences` |
| C26 | new, after save | (none) | No success text | `Saved. Revision {n}.` (status region) |
| C27 | `nvidia.tsx:135` | `Revision: {n or 'not loaded'}. A new browser session reads the same authenticated account, not a local fixture.` | Second sentence is a note to judges | `Revision {n}. Sign in from another browser to see the same preferences.` |

### Export and forget

| # | File:line | Current | Problem | Proposed |
|---|---|---|---|---|
| C28 | `nvidia.tsx:133` | `Export my memory` | Fine; "memory" vs "preferences" | `Download preferences (JSON)` |
| C29 | new, after export | (none) | No feedback | `Downloaded nyc-mon-memory.json.` |
| C30 | `nvidia.tsx:132` | `Forget all saved preferences` | Fires with no confirm | Button `Forget preferences`; opens C31 |
| C31 | new, confirm dialog | (none) | | Title `Forget your saved preferences?` Body `Your Mon will stop using them, and this conversation will be cleared. This can't be undone.` Buttons `Forget preferences` (danger) / `Keep preferences` |
| C32 | new, after forget | (none) | | `Preferences forgotten. Conversation cleared.` |

### Errors, timeouts, provider unavailable

| # | File:line | Current | Problem | Proposed |
|---|---|---|---|---|
| C33 | `nvidia.tsx:44` | `The request failed.` (non-Error fallback) | Vague | `Something on this page failed. Reload and try again.` |
| C34 | `nvidia.tsx:34` | `Session storage is required for secure sign-in.` | Thrown during render; no boundary shows it | `This browser is blocking session storage, which sign-in needs. Turn off private mode or allow site data, then reload.` |
| C35 | `nvidia.tsx:54` | `Sign-in state did not match. Start again.` | Fine | Keep |
| C36 | `nvidia.tsx:68` | `Load memory before changing it.` | Step should not exist after auto-load | `Saved preferences haven't loaded yet. Wait a moment, then try again.` |
| C37 | `nvidia.tsx:77` | `Memory changed in another session. Load it again.` (409) | Fine | `Your preferences changed in another session. Reload them, then save again.` |
| C38 | `nvidia.tsx:77` | `Memory was not saved. Check sign-in and backend availability.` | Shown for GET and DELETE too, where nothing was being saved | By method: GET `Saved preferences couldn't be loaded. Try again.`; PUT `Preferences weren't saved. Try again.`; DELETE `Preferences weren't forgotten. Try again.` |
| C39 | `nvidia.tsx:142` | `NVIDIA server unavailable.` | Thrown then swallowed by the `catch {}` at `:144` | Drop; C40 covers it |
| C40 | `nvidia.tsx:144` | `Start the NVIDIA companion server and check its nonsecret configuration.` | Operator copy on the judge's screen | `The companion server isn't answering. Reload in a minute.` |
| C41 | `modelClient.ts:18`, `freshToken.ts:31` | `Your sign-in expired. Sign in again to keep talking.` | Good copy that never shows when a refresh is refused mid-turn (see 01, risk 4) | Keep; make it reach the screen (06, P4) |
| C42 | `modelClient.ts:75` | `The simulator server didn’t answer. Check that it’s running.` | Says "simulator"; operator copy | `The companion server didn't answer. Try again.` |
| C43 | `modelClient.ts:43` | `The reply came back garbled. Try again.` | Fine | Keep |
| C44 | `modelClient.ts:98` | `The reply was cut off. Try again.` | Fine | Keep |
| C45 | `model.ts:310` | `The model call failed. Try again.` | What a judge sees for every Nebius failure: `NebiusError` falls through `describeModelError` | Map `NebiusError` by code (C46 to C50) |
| C46 | new, `TIMEOUT` (`nebius.ts:167,176`; default 60000 ms at `nebius.ts:21`, not overridden in `nvidia-main.ts:20-21`) | | | `Nemotron on Nebius didn't answer within 60 seconds. No other model answered instead. Try again.` |
| C47 | new, `HTTP` 429 | | | `Nebius is limiting requests right now. Wait a minute and try again.` |
| C48 | new, `HTTP` other | | | `Nebius returned an error ({status}). No other model was used. Try again.` |
| C49 | new, `RESPONSE` | | | `Nebius sent a reply this page couldn't use. No other model was used. Try again.` |
| C50 | new, `CONFIG` / `INPUT` | | | `This conversation couldn't be sent to Nebius. Start a new conversation.` |
| C51 | new, `CompanionMemoryError` on the model path (`companion-memory-client.ts:7`) | `Companion memory could not be verified. No model call was made.` (server only) | Also collapses into C45 | `Your saved preferences couldn't be checked, so nothing was sent to the model. Try again.` |
| C52 | `model.ts:358` | `Sign in again to keep talking.` (401) | Fine | Keep |
| C53 | `model.ts:363` | `Too many requests. Wait a minute and try again.` | Fine | Keep |
| C54 | `model.ts:362,366` | `Conversation too long. Start a new one.` | No "new conversation" control exists on this page | Add the control, or `Conversation too long. Reload the page to start a new one.` |
| C55 | `model.ts:298-308` | Bedrock and AWS messages | Not reachable from the NVIDIA backend by source (they need Anthropic SDK error types); listed so nobody pastes them into NVIDIA copy | No change |
| C56 | `auth.ts:145,200,201,205`; `mcp.ts:50,83` | `Sign-in was interrupted. Start it again.` / `Sign-in was cancelled. Sign in again to talk to your Mon.` / `Sign-in failed ({description}). Try again.` / `Sign-in returned without a code. Try again.` / `Sign in to talk to your Mon.` / `Sign-in didn’t finish. Try again.` | Good | Keep |

## Localization notes

- `{Action}` in C14 to C18 is a short noun; languages that inflect will need whole sentences per tool.
- C46 hardcodes 60 seconds; read it from config if `timeoutMs` becomes configurable.
