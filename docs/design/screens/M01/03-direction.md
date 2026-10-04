# M01 Boot / power-on: direction

Inputs: `01-research.md`, `docs/design/hlynk/DIRECTION.md`, `docs/DESIGN_SYSTEM.md`, `docs/design/DECISIONS.md` (D1, D3, D8, P1). Route `/`. Shell: H-Lynk. States: first-run / returning / offline.

## The one move

The app opens as the H-Lynk waking: the shell is already there, dark; the red lens ramps on; the 3:4 screen lights straight into where the Caller belongs. No logo, no gradient, no wordmark, 600 ms total (§4.1).

## Layout

```
 ┌──────────────────────────────┐
 │  ▕▏                  (◉)     │  LED ramps 0 → on, 0–240 ms
 │┌────────────────────────────┐│
 ││                            ││  screen: lip colour until 240 ms,
 ││   (destination's first     ││  then fades up to the routed screen
 ││    frame, or plain page)   ││  240–600 ms
 │└────────────────────────────┘│
 │  [  ]   ┌────────────┐  [  ] │  trackpad + keys present, inert
 │  [  ]   └────────────┘  [  ] │
 └──────────────────────────────┘
```

Timeline (full motion): 0 ms shell drawn at `power: 'off'` in the clock's scheme → 0–240 ms `ScannerLed state="boot"` ramp → 240–600 ms screen fades up. The route decision must resolve inside 240 ms from the local MMKV snapshot; the network is never awaited.

## States

| State | Destination | What the Caller sees after 600 ms |
|---|---|---|
| first-run | M02 Welcome (P1: then M04 for "Get started", M03 for "Sign in") | The screen lights to the M02 first panel; the shell then lowers away (`motion-enter` reversed, 300 ms) so M02 stands without chrome (D1) |
| returning, Egg incubating | M11 | LED settles from `boot` into `incubating`; screen shows the case |
| returning, egg ready/overdue | M11 "ready" (M12 on tap) | LED settles into `ready` |
| returning, Baby | M13 | LED settles into `needsYou` or off per meters |
| offline, first run | M02, with a status line under the panel: no network needed until sign-in | Never a hang. Research: "with no network and no account, the app can't reach sign-in" |
| offline, returning | same as returning | the sim runs locally (§1.4) |

## Type

No text on the boot frame. The LED chip (`type-caption`) appears only when the LED settles into a meaningful state on the destination screen. VoiceOver hears "H-Lynk on" once (polite), then the destination's own title.

## Motion and reduced motion

Full: `motion-power-on`. Reduced (authored): LED steps straight to on, screen cuts on at 240 ms, shell lowering on first run becomes a 200 ms cross-fade. No scale anywhere.

## No-list

- No logo-on-gradient splash, no wordmark, no "loading…" text (§4.1).
- No spinner; the LED is not a loader (`01-research.md`, LED risk).
- No copy implying the H-Lynk holds or connects to the Mon (#8). No "device" anywhere (Law 9).
- No analytics or account identifier before M04 (COPPA risk in `01-research.md`).
- No orange: no CTA exists on this screen (#7).
