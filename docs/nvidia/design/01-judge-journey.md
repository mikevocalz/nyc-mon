# 01 Judge journey: NYC-Mon Personal Companion (NVIDIA on Nebius)

Lane D (frontend/experience). Source read: `origin/feat/nvidia-05-submission-package` at `6f59ab27`, fetched 2026-10-28.
Skill passes: `user-research` was not installed as a skill in this runtime, so this is a **manual pass** reusing existing repo research (`docs/COPY_DECK.md`, `docs/nvidia/SUBMISSION.md`). `ux-heuristics-review` loaded and applied.

Nothing here was observed in a running browser. Every claim below comes from reading source; runtime behaviour is labelled "not verified".

## Surface under review

One page, `packages/web-sim/nvidia.html`, rendering `Companion` from `packages/web-sim/src/client/nvidia.tsx` (146 lines). Everything the judge sees is in that file: sign-in, chat log, memory controls, export, forget, sign-out and error text. Server: `packages/web-sim/server/nvidia-main.ts`.

All seven screens in the brief are states of this one page, not separate routes:

| Screen | Where it lives | Exists today? |
|---|---|---|
| Sign-in / OAuth | `nvidia.tsx:119` button, callback handled `:49-56` | Yes |
| Companion chat | `nvidia.tsx:122-124` | Yes, as a plain text log |
| Care-action confirmation | Tool results printed as raw lines `nvidia.tsx:98-99` | Only as raw text with JSON |
| Memory controls (approve / list) | `nvidia.tsx:125-131` | Approve yes. "List" is one free-text note, not a list |
| Export & forget | `nvidia.tsx:132-133`, `:111-115` | Yes, no confirmation, no feedback |
| Error / timeout / provider-unavailable | `nvidia.tsx:120`, `:144` | Yes, but provider errors collapse to one generic line (see 03) |
| Sign-out | `nvidia.tsx:119`, `:107-110` | Yes, silent |

## Judge persona

**Priya, technical judge for the NVIDIA x Nebius track.** ML or platform engineer. Judges 30 to 60 entries; gives each one a single look of roughly three minutes, usually at a desk on a laptop, sometimes after watching the sub-3-minute video. Has a Nebius account and knows what Token Factory and Nemotron are.

What she checks, in order:
1. Is this really NVIDIA on Nebius, or a wrapper with a logo? She wants the model id on screen and evidence that the reply came from it.
2. Does the model *do* something (tool calls changing real state), or only chat?
3. Is user data handled the way the writeup claims: consent before saving, export, forget?
4. Does it break? A blank page or a vague "something went wrong" costs more than a missing feature.

What she will not do: read a README mid-demo, open devtools, retry more than once, or create a second account.

## The 3-minute path

| Time | Step | What she should see | Current source |
|---|---|---|---|
| 0:00 | Open hosted URL | Title, one line saying what this is, model id, a sign-in button | Title + `NVIDIA <model> on Nebius Token Factory. Live services only; no scripted fallback.` (`:117-118`). OK, but the second sentence is developer speak |
| 0:10 | Sign in | OAuth round trip, return to the page signed in | Works by source. No "signed in as" line after return, so she can't tell which account she is (not verified at runtime) |
| 0:40 | Ask her Mon something | Her line, a working indicator, then the Mon's reply | Send button turns into "Working…" (`:123`). The reply arrives as one block after the whole turn; Nebius is buffered, not token-streamed (`nebius.ts:142` comment) |
| 1:00 | Ask for a care action ("feed my Mon") | A clear "Fed: applied" outcome | Shows `feed_mon: applied — {"…2,500 chars of JSON…"}` (`:99`). The proof is there, buried in JSON |
| 1:30 | Save a preference | Type a note, flip consent, save, see it saved | Must first press "Load / refresh memory" (`:127`) or the field stays disabled. No success message; only `Revision: N` changes (`:135`) |
| 2:00 | Ask again; reply uses the preference | Reply mentions it | Depends on server injection (`companion-memory-client.ts:57-58`). Not verified |
| 2:20 | Export | A JSON file downloads | Works by source, no on-screen confirmation |
| 2:35 | Forget | Confirm, then "Forgotten", chat cleared | One click, no confirmation, deletes and clears chat (`:132`, `:81-83`) |
| 2:50 | Sign out | Back to signed-out state with a message | Silent reset (`:107-110`) |

## Drop-off risks, ranked

1. **Memory is disabled until she finds "Load / refresh memory".** The note field and Save are disabled while `memory === null` (`:128`, `:131`). Nothing on screen says why. A judge who types into a disabled field and nothing happens moves on. Fix: load memory automatically once connected.
2. **Care proof is unreadable.** The `applied` / `declined` classification (`toolOutcome.ts`) is the strongest honesty signal in the entry, and it is printed inside a raw JSON line with an em dash. Fix: one plain line per tool call, JSON behind a disclosure.
3. **Provider failures say "The model call failed. Try again."** A Nebius timeout or 5xx loses its honest message (`nebius.ts:40`, "No alternate provider was used") because `describeModelError` (`model.ts:297-310`) does not know `NebiusError` and falls through to the generic line. The judge cannot tell Nebius from our server.
4. **Token expiry mid-turn signs her out with no message.** By source: a refused refresh calls `onSignedOut` (`freshToken.ts:109-112`), which aborts the in-flight turn (`nvidia.tsx:39`); the `catch` then skips `showError` because the signal is aborted (`:104`). She lands on the sign-in button with no explanation. Not verified at runtime.
5. **Forget has no confirmation.** One mis-click wipes saved memory and the conversation.
6. **Empty reply shows a code word.** `Mon: ${result.reply || result.outcome}` (`:103`) prints `Mon: step-limit`, `Mon: refused` or `Mon: truncated`.
7. **No visible success after Save, Export or Sign out.** Each action works or fails silently except for errors.
8. **Session storage missing throws during render** (`:34`): no error boundary, so the judge would see an empty page. Rare (private modes that block storage). Not verified.

## Mobbin references

Searched 2026-10-28, web platform. One set per screen group in the brief. Sign-in, chat with tool results, care confirmation and error states share the chat set; there was no separate search for sign-in.

**Companion chat, tool results inline**
- [Base44, agent chat reporting tool results and limitations in plain sentences](https://mobbin.com/screens/e69ee3c8-dd8b-4738-8799-d513a01f107c): the agent states what worked and what returned low confidence. The model for our applied/declined/failed lines.
- [Plane AI, query shown as a labelled block above the result table](https://mobbin.com/screens/2916bdc1-91d1-4e4b-ac2c-accca9d583dd): the machine-readable part sits in its own box with a Copy action, out of the prose. Use for the JSON disclosure.
- [Searchable, "Working for 8s" / "Thinking…" progress line](https://mobbin.com/screens/5b1c6193-7557-47b2-9c17-f5fb0d2e10d2): elapsed-time status while the turn runs. Use for our buffered Nebius wait.

**Consent and memory controls**
- [Base44, Memory page with "Memory access" summary and "Change access"](https://mobbin.com/screens/9128eb56-60e7-42e2-a406-fc289c4781a1): states in one line what the agent may use before any control.
- [incident.io, confirm dialog before disabling message storage](https://mobbin.com/screens/b521b934-9d18-467a-bb53-e47d161c4246): plain consequence text, Cancel plus a red action named for what it does.
- [hilos, workspace memory with helper text naming who can read it](https://mobbin.com/screens/20238342-99a7-443d-a266-11487fe6f32d): helper text sits under the field, not in a separate paragraph.

**Export and forget**
- [Grok (xAI), "Your data" with Download account data and Delete account rows](https://mobbin.com/screens/f8336774-2fae-41e1-a33f-3d952433b1fc): each row is title, one-line consequence, one button; delete is the only red control.
- [Dropbox Dash, Privacy tab with "Access your data" and "Delete your data"](https://mobbin.com/screens/66db5892-c38d-4fa6-b461-6063ae12a173): export and delete as separate sections, each with its history.
- [Calendly, AI settings with a red "Delete Calendly Notetaker data" link](https://mobbin.com/screens/349107ec-765c-4f4d-98af-657a559a64c9): the destructive data action is set apart from the feature toggle.

What carries over: our page should follow the Grok and Dropbox pattern (export row, forget row, forget in the danger tone behind a confirm) and the Base44 pattern for tool outcomes (a plain sentence first, detail second). Our visual language stays NYC-MON (corner-cut faces, daylit concrete); only the structure is borrowed.
