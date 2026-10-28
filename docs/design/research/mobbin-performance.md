# Mobbin cards — performance pass

Mobbin cards for the four screens the pass touches, each tagged borrow or
reject. Searched 2026-10-17 via the Mobbin MCP server; `mobbin_url` links are
canonical. The realism pass's card set lives in `realism.md` — these are the
performance-pass picks, answering different questions.

## Game tab — controls and HUD

Question: which controller parts must animate and which can be static.

- [Google Arts & Culture — "Don't Touch The Art"](https://mobbin.com/screens/bc4a7722-0fcf-4ecc-94de-f1cc8fba5ad1) — **borrow.** A
  joystick over game content: the stick base and housing are static art; only
  the nub moves under the thumb. If our controller's paint layer goes static
  (Skia), this is the split to keep.
- [Xbox — console remote](https://mobbin.com/screens/f29dc23d-69a0-4f4f-8914-fc4f6e2a4806) — **borrow.** A full
  button cluster rendered as flat static glyphs around a gesture surface:
  proof that six-button clusters need zero per-frame animation to read as
  controls.
- [SmartThings — move focus pad](https://mobbin.com/screens/2b7fd1d1-29c5-429a-8392-a1751d1c1fc0) — **reject.**
  The continuous-input surface gives no visual feedback at all; press states
  are the one animation we cannot cut — input feel lives there (Freiberg).

## Lobby

Question: which Rive moments justify always-on animation.

- [Duolingo — matchmaking](https://mobbin.com/screens/290600cc-433b-4dcc-b136-466186f76521) — **borrow.** One
  animated hero (the character) carrying the whole "finding opponent" wait;
  everything else is static text. The shape to copy: one live element, not a
  screen full of them.
- [Yubo — group lobby countdown](https://mobbin.com/screens/90dfb8dd-f0cb-4a05-b8e5-c7a8e80bf0ea) — **borrow.**
  "STARTING IN 2 SEC…" is the only live element over a static scene — the
  lobby's state, not its decor, is what earns animation.
- [Xbox — new party roster](https://mobbin.com/screens/5bfd9fce-23bf-49a1-9d29-a70dd4a4df2a) — **borrow.** Invite
  list and start CTA are fully static; roster state changes are discrete
  events, not animation moments.
- [Skype — waiting room](https://mobbin.com/screens/c3b1d453-25d3-4dfc-a4c6-d6b78202d771) — **reject.** Static
  to the point of dead — "waiting" needs a heartbeat or it reads as hung.

## Settings — graphics and battery

Question: whether tiers are exposed, and how.

- [Ultrahuman — battery modes](https://mobbin.com/screens/520b63e7-7755-4288-9a47-737fe3541ab2) — **borrow.**
  Three tier cards, each name + one-line consequence ("High Battery Usage",
  "Power-Efficient" tag, "survival mode"). The tier-card shape for our
  phone/high split — consequence over jargon.
- [NBA — video quality](https://mobbin.com/screens/367b52d6-fcd9-410c-8dc5-541c6ed55017) — **borrow.**
  "Automatic (recommended)" checked by default above one manual tier — the
  governor-first exposure pattern: the auto path is the default, manual
  choices sit under it.
- [Twitch — quality options](https://mobbin.com/screens/ba70dfb1-e6c0-4648-af5d-f52d4c3cfd22) — **borrow.**
  A straight resolution list with per-option subtitles; the dense-manual
  shape if the surface ever exposes more than two tiers.
- [SiriusXM — video quality](https://mobbin.com/screens/4bc1177d-eb44-4ab4-aba8-18748c3076c0) — **reject.**
  "Normal / High / Maximum" with no consequence info — labels that tell the
  player nothing about battery or frame rate.

## Loader

Question: progress affordance while shaders compile and assets warm.

- [Moonly — staged progress](https://mobbin.com/screens/c2a4d157-d2af-4a72-90a2-8ab7e77c4a1c) — **borrow.** Two
  labeled bars with live percentages ("Crafting your meditations 59%") — the
  shape for "compiling shaders" and "warming assets" as separate stages.
- [Hypelist — ring and sublabel](https://mobbin.com/screens/7eb3e010-4ad1-452a-9cdf-e5ef2f8822d8) — **borrow.**
  A determinate ring over a dark scene with one line under it ("Creating your
  profile") — minimal, readable, brand-dark.
- [Stake — bar with time expectation](https://mobbin.com/screens/e77b502c-73f1-4508-9a71-73d6f64792a3) —
  **borrow.** Thin bar plus "This can take up to 1 minute" — the expectation
  line is the honest touch for a compile that genuinely takes that long.
- [ANZ Plus — indeterminate spinner](https://mobbin.com/screens/5b6a5b61-3ee6-4178-9aa3-6a3dd3864b02) —
  **reject.** A spinner with a long paragraph during a known-duration wait —
  indeterminate motion on a long compile reads as hung.
