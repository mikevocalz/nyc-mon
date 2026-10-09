# M17 Dex entry / Mon profile: handoff

Inputs: `01`–`07` here; `packages/app/features/mon/create-mon-store.ts`; `packages/content/mons/index.ts`; Decision #12.

## Blockers

| # | Blocker | Owner | Blocks |
|---|---|---|---|
| B1 | `LifecycleTrack` | kit | lifecycle row |
| B2 | `captureTransparentFrame` + share module (X-5, X-6); native capability | `render`, `platform` | photo mode, export done (button hidden until done) |
| B3 | Q26, Q24, Q12/Q13 answers | Mike | bond, likes, culture rows (hidden until then) |

Default state ships without B2 and B3.

## Route

`/(home)/mon/[id]`. `id` is a `monInstanceId`. Entry: `m13-bar-dex`, Menu → Dex. An unknown `id` (not in `save.mons`) renders M22's not-found recovery with a route to Home, never a blank page. Shell: none.

## Data: exact calls

```ts
const mon = useMonStore(s => s.save?.mons.find(m => m.monInstanceId === id)); // not selectActiveMon: any of the Caller's Mons (Decision #18)
const caller = useMonStore(s => s.save?.caller);                               // CallerProfile | null
const species = allSpecies.find(sp => sp.speciesId === mon.speciesId);         // @acme/content
const bloodline = bloodlines.find(b => b.bloodlineId === species.bloodlineId); // @acme/content, Decision #12
const chain = walkChain(bloodline.chain);                                      // @acme/content
const slots = toLifecycleSlots(chain, mon.stage);                               // screen helper: done/current labelled, rest 'later' (one per remaining stage)
const name = mon.nickname ?? species.formName;
```

`species.formName` can be null for unpromoted records (schema); for the three starters it is set. A null renders the bloodline label alone, never "Unknown".

## States

| State | UI |
|---|---|
| default | portrait, species card, lifecycle, facts |
| photo mode | full-bleed portrait on a transparency checkerboard, shutter, Cancel; renderer holds the current pose (`presence` unchanged, vignettes paused) |
| export done | the captured PNG shown on the checkerboard; Share (opens the OS share sheet with the file), Done; toast `m17.photo.saved` |
| export error | toast `m17.photo.error`; stay in photo mode |

Loading: none (MMKV is synchronous). Offline: unchanged; nothing here writes.

## Layout

Compact: 16 pt gutter; portrait 4:5 full width; `space.4` between portrait and the Dex plate; plates stacked with `space.2`; bloodline `space.2` below; lifecycle `space.6` below; facts `space.6` below. Expanded/Quest 1280×800: two columns (5/12 portrait, 7/12 text) inside `content-screen`, gap `space.8`.

## Components and test IDs

| Element | testID |
|---|---|
| Back | `m17-back` |
| Photo button | `m17-photo` (absent until B2) |
| Portrait | `m17-portrait` |
| Dex plate | `m17-dex` |
| Form plate | `m17-form` |
| Bloodline | `m17-bloodline` |
| Lifecycle | `m17-life`, slots `m17-life-0` … |
| Facts | `m17-fact-name`, `m17-fact-hatched`, `m17-fact-caller` |
| Photo mode | `m17-photo-mode`, `m17-shutter`, `m17-photo-cancel`, `m17-photo-share`, `m17-photo-done` |

## Motion

| Element | Trigger | Token | Reduced |
|---|---|---|---|
| Page | enter | `motion-enter` | fade 200 ms |
| Photo mode | open/close | `motion-step` | fade 120 ms |
| Shutter | press | 120 ms flash on portrait | none |

## Acceptance

- No string for a Small, Mid or Max form, or the words for those stages, is reachable from this screen.
- No row renders with null canon data.
- An exported PNG has an alpha channel, no text chunks and no EXIF.
