# Alexa+ design: the Mon views and the companion skill

Date: 2026-10-08. Scope: the two MCP Apps views in `packages/mcp-server/src/ui/` and the Agent Skill in `skills/nyc-mon-companion/`. Platform facts come from `docs/alexa/PLATFORM-DOCS.md` §2.7–2.9 and §3.5, and from the Alexa+ MCP design guide pages opened on 2026-10-08 (overview, display modes, layout and rendering, visual foundations, components and patterns, brand expression, accessibility).

## The rule

The views add no visual language. They are the NYC-MON kit and the companion screens that already ship, rendered for the web the way Storybook renders them, inside the MCP Apps sandbox. A first pass with hand-drawn markup (a station-sign band, bar meters, custom buttons) was rejected by the creator on 2026-10-08 and deleted.

## What ships

| Piece | Resource | Built from |
|---|---|---|
| Status card (Inline) | `ui://nyc-mon/mon-card-<hash>.html` | The kit `Card` as W02 uses it, holding M13 Home's care view |
| Mon room (Fullscreen) | `ui://nyc-mon/mon-room-<hash>.html` | The same card filling the canvas, plus M18's timeline rows |
| Companion skill | `skills/nyc-mon-companion/SKILL.md` | Validated with `agentskills validate` (skills-ref) |

Both resources are one View (`src/ui/view/main.tsx`, `MonView.tsx`) on the ext-apps vanilla `App` (`@modelcontextprotocol/ext-apps` 2.0.3), built twice with a different starting layout. Fullscreen is "an expansion of the inline fragment … not a separate surface" (Alexa+ display modes), so the card's Journal button requests fullscreen and the same document re-renders as the room.

### Which existing pieces each view uses

Kit components are imported from their own files, the way their Storybook stories import them, and get only props those stories pass. No className or style is set on a kit component; plain layout Views go around them.

| Piece | Story it copies | Card | Room |
|---|---|---|---|
| `Card variant="notch" notchSides={['top']}` with `title` (Mon name) and `description` (Bloodline label), toned per starter slot as W02 does (orange, royal, leaf) | UI/Card Notch; `MonsIndexPage.tsx` | yes, holding the Baby still | yes |
| `Image fill framed={false} unoptimized` in a sized 4:5 box | HomeLayout `renderStill`; UI/Image bare | yes | yes |
| `StatusRow` with one `request` or `neutral` item from `homeStatus` | UI/StatusRow Request | beside the Card | beside the Card |
| `CareMeterRingGroup` of three `CareMeterRing`, `scheme` daylit or night with the page | Care/CareMeterRing GroupDaylit / GroupNight | beside the Card | beside the Card |
| `Button size="lg" fullWidth`: Feed, Rest or Wake, Play, then Journal (`m18.title`) or Close (`m14.close`). The action the Mon asks for (M13 `askRoute`) is `variant="cta"`, the rest `variant="outline"`; all outline when nothing is asked. hlynk-care is drawn over a live scene and read black-on-navy here | UI/Button Cta, FullWidthWraps | yes | yes |
| `Heading level={2} size="title"`, `Text`, `Text variant="caption" tone="muted"`, `Badge size="sm" tone="neutral"` for M18's rows | UI/Heading, UI/Card bodies; JournalScreen | no | yes, scrolling beside the Card |

The status chip and rings sit on the page, not on the tone face: inside a notch Card the kit sets themed text to the face's on-face colour, which leaves the chip and the ring plate unreadable on orange and leaf after dark. The stories show both on a plain scheme surface, so that is the composition used.

### Room backdrop: the site's grid floor

The room carries GridBand from the website (`apps/web/components/home/GridBand.tsx`): `LazyScene` with the midtown sky as `placeholderColor`, `GridFloor` with GridBand's props (horizon 0.45, 24 columns, 18 rows, speed 0.6, skyline), and its Pause button (`Button size="sm"`, `aria-pressed`), placed top right because the action bar holds the bottom edge. The inline card has no backdrop. Source: `src/ui/view/GridBackdrop.tsx`, compiled into the room build only.

GridFloor draws on WebGPU and falls back to Skia CanvasKit, which fetches `/canvaskit/canvaskit.wasm` (about 7.7 MB) from the page origin. In the MCP Apps sandbox that fetch is blocked by `connect-src 'none'` and aborts with a RuntimeError. So the view:

- mounts GridFloor only when the kit's own GPU check (`useGpuSupport`, which requests the adapter and the device) reports `supported`, and unmounts it when the device is lost;
- swaps CanvasKit's web loader (`react-native-skia/lib/module/web`) for a build alias that never fetches (`src/ui/view/skia-web-sandbox.ts`) and drops the floor if the kit asks for it anyway;
- wraps the backdrop in an error boundary so a failure leaves the room and its controls intact.

Without a working device the room shows only LazyScene's placeholder sky, the same thing the site shows before a scene draws, and no Pause button. The button also hides under reduced motion, when the floor draws still. WebGPU needs no CSP entry.

Measured in bundled Chromium 153 through an AppBridge host: with `--enable-unsafe-webgpu` (SwiftShader) the floor draws and animates; without it, `navigator.gpu` returns no adapter and the room shows the sky with no network request and no console error; with an adapter whose `requestDevice` rejects, the same. All three paths are boot tests. Echo Show WebGPU support is undocumented (PLATFORM-DOCS §2.7), so on a device the likely result is the sky fallback.

Data: `src/ui/contract.ts` adapts a tool result (lane A's `MonView`/`CareView` or the core `MonInstance`/`CareState`) into what those components already take: a `CareState`, `monIdentity(...)`, and `JournalEntry` rows. State is one zustand store.

| Tool | View |
|---|---|
| `get_mon_status` | mon-card |
| `feed_mon`, `rest_mon`, `wake_mon`, `play_with_mon` | mon-card (redraws from the care result) |
| `check_on_mon` | none: its result has no `care`, so the rings would be missing |
| a future tool returning `journal` with `mon` and `care` | mon-room |

## Build

`pnpm --filter @acme/mcp-server build:ui` runs `src/ui/build.ts`:

- The Vite config is Storybook's own: `apps/storybook/.storybook/main.ts` `viteFinal`, imported and called unmodified, with `apps/storybook/postcss.config.mjs` (Tailwind v4).
- Added: `vite-plugin-singlefile` 2.3.3 to inline everything, and a sharp 0.35.5 loader that downsizes the creature WebPs (Babies to 400 px wide; the eggs and hatch scene, which the views never draw, to 16 px).
- `src/ui/view/view.css` repeats `apps/storybook/globals.css` (Tailwind `important`, `@acme/theme/theme.css`, the kit and companion sources) and loads the two brand fonts from the same `packages/assets/fonts` files in WOFF2 instead of TTF.

Size: the card is 1,432,182 bytes (1399 KiB) raw, 486,912 bytes (475 KiB) gzip; the room, with the grid floor, is 2,201,546 bytes (2150 KiB) raw, 702,726 bytes (686 KiB) gzip. Roughly: React, react-native-web and the kit pieces about half the script; the ext-apps App runtime with zod about 445 KiB; Tailwind's CSS for the kit about 200 KiB; fonts about 100 KiB; Baby stills about 100 KiB. Alexa+ names no byte limit for an MCP App; it asks for one gzipped, content-hashed, self-contained bundle. Test budgets: card 1500 KiB raw and 520 KiB gzip; room 2400 KiB raw and 780 KiB gzip.

## What the sandbox could not do

- **Fonts.** The MCP Apps default CSP has no `font-src` beyond `'self'`, so inlined `data:` fonts are blocked (seen in Chromium with the spec's default CSP injected). The resources declare `resourceDomains: ['data:']`, which a spec host turns into `font-src 'self' data:`; with that CSP the fonts load. Open question: whether Alexa+ accepts `data:` as a resource domain. If it does not, the fonts fall back to Arial Black and the system sans and nothing else changes.
- **Skia, WebGPU, three.js.** Not used by these components on web. `CareMeterRing` has a web SVG fork; the views draw no 3D Mon.
- **Kit barrel.** A production Vite build of the `@acme/ui` barrel failed on `AVATAR_GRADIENTS` (`packages/ui/index.ts` re-exported it from `./Avatar`, which resolves to `Avatar.web.tsx` on web). Mike approved the fix and the lead applied it in `packages/ui/index.ts`. The views import component files the way the stories do, so they never depended on the barrel.

## References

Mobbin (search results, 2026-10-08), used for the first pass and kept as context: Tolan https://mobbin.com/screens/ffe464e5-482f-45a2-aa76-a231b802c4cd, Google Health https://mobbin.com/screens/5c761a21-21d4-4ebd-a88b-27d5a41202a0, Lifesum https://mobbin.com/screens/6e2d4f3f-9e13-445b-92bb-8e01edca420e, Noom https://mobbin.com/screens/280fc790-30d6-4e75-a7d1-4511b5f53b21, Microsoft Copilot https://mobbin.com/screens/0a0469f6-8b30-4631-8f2d-1019de4caf73. The shipped design follows the kit, not these.

Alexa+ guide rules applied: author at 768×480 with one root `zoom` per device class (1.667 on Echo Show 8 and 15, from `hostContext.deviceClass`); the inline card fits the 480 px canvas height (measured 445 base px); the room fills the fullscreen canvas exactly; light and dark from `hostContext.theme` through theme.css's `[data-theme]`; no storage, no network, bridge only; no Alexa+ logo.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Card tone by starter slot, as W02 does. | Same Mon, same card as the website. |
| 2 | The Home bar's fourth button (Dex) becomes Journal on the card and Close in the room. | M13 has four slots; Dex has no MCP tool, and the room is where the journal lives. Both labels already exist in copy. |
| 3 | Status chip and rings beside the Card, on the page. | The composition the StatusRow and CareMeterRing stories show working in both schemes; on a tone face they are not readable in every tone × theme. |
| 4 | The rings show no numbers. | M13 P1: the ring draws no number; the value is in its progressbar semantics and in the voice data. |
| 5 | Buttons call the tools with `{ monId }` only. | Same tools as voice; no Peek round runs on the card, so `play_with_mon` gets no `quality`. |
| 6 | Outcome lines in the live region use M14–M16 strings (`m14.eaten.a11y`, `m14.declined.asleep`, `m16.result.body`, …). Failures show the server's plain-language text. | No new copy. |

## Voice-only behaviour

The views show nothing the tool data lacks: name, Bloodline, status, the three meters and the journal are all in `structuredContent`, and every button is a tool a voice agent calls with the same arguments. The skill tells the agent to speak meters as words with no symbols. On a real Echo, Alexa's model phrases the reply; the skill fully drives only the web simulator (PLATFORM-DOCS §2.8).

## Accessibility audit

Method: contrast computed in `ui.test.ts` from `@acme/theme` tokens and the kit's `CARE_COLORS`, stacked as the views stack them; rendering, theme and the action round trip checked in Playwright's bundled Chromium 153 through an ext-apps `AppBridge` host at Echo Show 8 size (1280×800). Not tested: VoiceView, Screen Magnifier or colour inversion on a device (no device access, ADR 0015).

| Check | Result |
|---|---|
| Touch targets | Kit `Button` roots carry `min-h-target` (48 px base, 80 px on an Echo Show). |
| Text on the card face | Ink on orange and leaf, white on royal: all at least 4.5:1 (the kit's notch on-face step, PS-034). |
| Ring captions and status chip | On the page beside the Card: kit text on the scrim-scene plate and on surface-sunken, at least 4.5:1 in both schemes. |
| Ring fill against track | 3.77:1 by day (royal on concrete-200), higher at night. Meets the 3:1 non-text rule; below the 4.5:1 Alexa+ asks for colour inside graphics. That is the kit's ring, so a fix belongs in `packages/ui/care/care-colors.ts`. |
| Button label | Silver-300 on signage black, at least 4.5:1. |
| Screen reader | The kit's semantics: rings are progressbars named "Energy" etc. with values 0–100; the ring group is a labelled group; the main region is named with `m13.mon.a11y` ("Squeaklet, Hood Ratti Bloodline. Asking for food."). Results go to a polite live region. |
| Alt text | The Baby stills use `CREATURE_ART` alt text from `packages/assets/creatures`. Those strings run past the 125-character Alexa+ limit; shortening them is a fix in that package. |
| Motion | Rings render with `reducedMotion`; nothing flashes. |

## Critique

What works: the card is recognisably the website's starter card with the app's care view inside it, and the buttons are the app's buttons. The inline card fits its canvas; the room fills its canvas with the bar on screen.

What is weaker: the bundle is large (475 KiB gzip) because it carries React, react-native-web and the full MCP Apps client. The Journal rows only appear when a tool returns `journal`, and no tool does yet. The ring and alt-text gaps above are kit issues, reported rather than patched here.
