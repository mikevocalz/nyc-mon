# Premium site decisions (ADR log)

One entry per non-trivial decision on the W01 premium redesign. Format: context, decision, alternatives, consequences. Dispositions follow the build / strike / defer rule: build only on real data end to end, strike when the surface's precondition failed, defer when the blocker is a decision someone else owns.

PS-001 to PS-007 answer `PREMIUM_SITE_AUDIT.md` §17, decided 2026-10-07 after Phase 1.

---

## PS-001 — Waitlist capture is `POST /v1/waitlist` in apps/admin-vite

**Disposition:** BUILD (Phase 6). Interim: the fake confirmation must not reach production.

**Context.** `/get` (`apps/web/components/get/GetPage.tsx`) checks the email with a regex, sets `useState`, and says "You're on the list" without sending or storing anything. ADR 0003 moved Payload, Better Auth and the `/v1` API to `apps/admin-vite`; `docs/REPO_MAP.md:66` says `apps/web` holds no database or auth secrets. admin-vite already serves an unauthenticated, pre-account POST in this shape: `apps/admin-vite/src/routes/v1/guardian-consents.ts` hands the request to `handleCreateGuardianConsent` in `@acme/payload`.

**Decision.**
- New Payload collection `waitlist` (email unique, district, source, createdAt) and handler in `@acme/payload`, mounted at `apps/admin-vite/src/routes/v1/waitlist.ts` following the guardian-consents route.
- Validation, honeypot and rate limit run server-side in the handler. A repeat email returns the same success ("You're already on the list"), so the endpoint doesn't reveal who has signed up.
- Age: the form asks "Are you 13 or older?". A "no" stores nothing and shows the guardian path from ADR 0001; no under-13 email is collected.
- `apps/web` calls it from a server action. The admin base URL is a server-only env var; the browser never sees it. The form uses `useActionState` (contract §12) on `@acme/ui/html` `Form` / `Label` / `Input` / `Output`, with every state announced.
- Until the endpoint ships, the confirmation copy is not shown as success. First change of Phase 2: either gate `/get` and its CTAs off in production, or replace the confirmation with an honest "Sign-ups open soon" state. No form may claim a signup it didn't store.

**Alternatives.** A server action in `apps/web` with its own DB secret breaks ADR 0003's boundary. A third-party list (Resend audience, Mailchimp) adds a vendor and a second store of minors' data. Payload already holds consent records, so this keeps one store.

**Consequences.** Phase 6 depends on admin-vite being deployed with a URL the web server can reach. Deploy checklist gains the env var, the collection migration and a rollback.

---

## PS-002 — H-Lynk Core colour is red

**Disposition:** decided by Mike, 2026-10-07: red.

**Context.** Decision #16 (`docs/canon/DECISIONS.md:242`) gives the Core a matte red body. Page copy says "a red handheld". `device-scene.ts:176-177` renders `#1D4ED8`. Commit 727428d (Mike, 2026-10-04) made it blue on purpose: "Blue shell variant; hlynk.core token stays red for canon".

**Decision.** Red on the marketing page, and the static capture is regenerated in red. It's the canon Core, the copy already says red, and red is the contract's hardware accent. Blue can stay as a variant inside the product if wanted.

**Consequences.** Phase 4 changes the body material in `device-scene.ts` to the `hlynk.core` token and regenerates `/home/h-lynk-core.png`.

---

## PS-003 — Header CTA is "Join the waitlist"; "Log in" leaves the site nav

**Disposition:** decided. STRIKE "Log in" from the marketing nav.

**Context.** `apps/web/components/site/nav.ts:14` sets `NAV_CTA` to "Log in", the header's only filled button. `SiteChrome.tsx:26-27` says the product site carries no auth (ADR 0003). The contract's copy law is one CTA string site-wide, and the app isn't available to the public, so no visitor has an account to log in to.

**Decision.** `NAV_CTA` becomes "Join the waitlist" → `/get`, sourced from the same copy constant as the hero and hatch CTAs. The `/sign-in` route stays where it is; only the nav entry goes.

**Return condition.** "Log in" comes back as a secondary text link when the app is publicly available.

---

## PS-004 — DeviceStage label is "H-Lynk Core", from copy.ts

**Disposition:** decided.

**Context.** `DeviceStage.tsx:60` has `aria-label="H-Lynk device"` as a JSX literal. Screen-reader users hear it, so it falls under the rule that UI never calls the H-Lynk "the device" (COPY_DECK Law 9, contract §4).

**Decision.** The label is "H-Lynk Core" and lives in `copy.ts`. The `"The device"` eyebrow (`copy.ts:23`) becomes "H-Lynk" in the same change.

---

## PS-005 — Mon pronouns

**Disposition:** decided by Mike, 2026-10-07: the player's Mon's gender is unstated in Phase 1 (answers canon Q14, `docs/canon/OPEN_QUESTIONS.md:60`).

**Context.** v11 says Mons have genders (¶54). v7 calls the rat line "he" and the cat line "she", and gives nothing for Yotes. Nothing says whether the player's own Mon has a fixed gender, a chosen one, or none stated in Phase 1. The current copy uses "it" for a Mon.

**Decision.** Marketing copy doesn't use a pronoun for an individual Mon. It says "your Mon", names the starter, or restructures the sentence. This avoids both "it" (which canon's genders argue against) and guessing a gender.

**Reopen when** a later phase of the game states a gender.

---

## PS-006 — Strike "its own weather" from World copy

**Disposition:** STRIKE.

**Context.** `copy.ts:20` says each district has "its own weather". A search for "weather" across `docs/canon`, `packages/content` and `packages/spatial` finds nothing. Canon Law 1: don't invent canon.

**Decision.** Phase 3 drops the phrase. World copy uses what canon has: the four districts and their real streets.

**Return condition.** Canon adds per-district weather.

---

## PS-007 — Final art: build the slots, wait for the assets

**Disposition:** DEFER the art; BUILD the art map.

**Context.** `packages/assets` holds the logo, wordmark, two fonts and NYC photos only. No Mon, egg or H-Lynk render exists in the repo (file search for the starter, Baby and egg names found nothing). The audit's main finding is that no creature appears on the page.

**Decision.** Phase 2's `art.ts` defines every slot as an exhaustive union with aspect ratio, pixel sizes per breakpoint, alt ownership and mobile crop. Sections compose so they hold up without the creature art: type and photography, no stand-in creature and no placeholder text in the DOM (contract §14). Real art replaces slot contents without layout change.

**Assets.** Mike confirmed on 2026-10-07 that he has or will produce all four sets: Baby-form renders for the three starters, three egg key art images (Metro, Corner, Prism), a red H-Lynk Core capture (after PS-002), and street-level photography of each district at the slot aspects.

---

## PS-008 — Rendering boundaries: server sections, small client islands

**Disposition:** decided (Phase 2).

**Context.** `HomeHero.tsx` is a whole-file client component because it reads `useDistrictStore`, renders `SegmentedControl`, and lazy-loads `CityBlocks` with `next/dynamic` (`ssr: false`). Phase 1 measured 1.4 s JS bootup and 664 KiB unused JS on the home route. Marquee, World, H-Lynk, Starters, Care and Hatch have no directive but render `View` from `@acme/ui/tw`, a client module.

**Decision.** Section shells are server components built from `@acme/ui/html`. The hero splits: headline, support line, CTA, seal and photo are server HTML; a client island holds the district selector and the city canvas. `DeviceStage` stays the H-Lynk island. Phase 3 applies this to the hero; Phases 4–6 keep it for their sections.

**Alternatives.** Keeping the hero client-side is simpler but ships its copy in the client bundle and ties first paint to hydration.

**Consequences.** Server sections can't read the district store; anything that follows the picked district (the divider tint, hero city) stays inside the island or reads the store in its own small client component.

---

## PS-009 — One motion clock: `gsap.ticker` drives Lenis

**Disposition:** decided and implemented (Phase 2).

**Context.** `MotionRoot.tsx` ran `ReactLenis` with `autoRaf: true` and `connectGsapLenis(lenis, { clock: 'external' })`. In Kinetrell 0.1.0-alpha.1 `'external'` only subscribes `ScrollTrigger.update` to Lenis scroll (`gsap-lenis.mjs:15-20`), so Lenis and `gsap.ticker` each ran a RAF loop.

**Decision.** `autoRaf: false` and `clock: 'kinetrell'`, which adds `lenis.raf` to `gsap.ticker`. Reduced motion still renders without Lenis.

**Alternatives.** Lenis as the clock with GSAP's ticker driven from it (`gsap.ticker.remove(gsap.updateRoot)` + manual updates): not supported by the Kinetrell API, so it would be a second abstraction beside it (contract §10).

**Consequences.** `site-qa:motion` asserts one motion clock. If Kinetrell changes the clock semantics, that check fails first.

---

## PS-010 — Canvases loop only while visible; three's internal loop is stopped

**Disposition:** decided and implemented (Phase 2).

**Context.** Phase 1 found 3 RAF loops idle and 5 with the H-Lynk stage on screen. The hero `CityBlocks` ignored `SceneSection`'s `paused` (the component had no such prop), and three's `Renderer.init()` starts `Animation.start()`, a RAF loop that runs until dispose even when `ThreeCanvas` has stopped drawing (`three/src/renderers/common/Animation.js`, r186).

**Decision.** `CityBlocks` gains a `paused` prop forwarded to `GpuCanvas`; the hero passes `SceneSection`'s value. `ThreeCanvas` calls `renderer._animation.stop()` after `init()` and advances `renderer._nodes.nodeFrame` in its own `draw()`. Both are private three members, wrapped in two guarded helpers with a comment naming the source; a rename turns them into no-ops and `site-qa:motion` catches the returning loop.

**Alternatives.** A global canvas coordinator store that grants one canvas at a time: unnecessary while the two canvases are a full section apart and each pauses offscreen. Revisit if two canvases ever share a viewport.

**Consequences.** One live canvas loop at most; none when neither is on screen.

---

## PS-011 — Art map: typed slots, local assets, swap without layout change

**Disposition:** decided and implemented (Phase 2).

**Context.** `art.ts` exported `TEMP_*` constants of NYC photos, and photo titles/places rendered as captions. Final Mon, egg and H-Lynk art is coming (PS-007).

**Decision.** `art(slot)` over an exhaustive `ArtSlot` union with dimensions, `sizes`, and alt or a decorative reason; a unit test enforces it. Details in `PREMIUM_SITE_ARCHITECTURE.md` §5.

**Consequences.** Final art is a source swap per slot. The slot list and final-asset specs live in `PREMIUM_SITE_HANDOFF.md`.

---

## PS-012 — District selector is a radio group, fixed in the kit

**Disposition:** decided and implemented (Phase 2).

**Context.** `SegmentedControl.web.tsx` rendered `role="tablist"`/`role="tab"` with no tab panel and no arrow keys inside a fieldset with a legend, and overflowed its panel at 390 and 320 (WCAG 4.1.2, 1.4.10).

**Decision.** Radio-group semantics with roving tabindex and arrow/Home/End keys, wrapping to two rows in narrow containers. Fixed in `packages/ui` so every caller gets it.

**Consequences.** Every `SegmentedControl` in the product now announces as a radio group; callers that relied on tab semantics were checked when the change landed.

---

## PS-013 — Hero: server HTML, two client islands, LCP is server-rendered content

**Disposition:** decided and implemented (Phase 3).

**Context.** `HomeHero.tsx` was a whole-file client component: copy, CTA, seal and photo hydrated with the district control. It imported `useDistrictStore` from the `@acme/spatial` barrel, which also exports the Viro and Rive scenes, so `/` shipped a 446,558-byte chunk (`StudioSceneNavigator`, Viro, Rive) that only `/spatial` needs. PS-008 set the boundary; this applies it.

**Decision.**
- `HomeHero.tsx` is a server component. Headline, support line, CTA, photograph, seal and caption are server HTML from `@acme/ui/html` and `@acme/ui`.
- `HeroDistrictIsland.tsx` ('use client') holds the two pieces that read the store: `HeroCity` (the `SceneSection` that draws `CityBlocks` behind the server children, still `next/dynamic` with `ssr: false` and `paused` forwarded) and `HeroDistrictPicker` (the radio group).
- The store is imported by module path, `@acme/spatial/district` (new export in `packages/spatial/package.json`), from the island and `DistrictDivider`. The Viro chunk no longer loads on `/` (checked in the served HTML's script list).
- The photograph keeps `loading="eager"`, `fetchPriority="high"` and a `<link rel="preload" as="image">` rendered in the tree (React hoists it). `ReactDOM.preload()` from the server component reached only the flight payload, not the HTML, so the element stays.
- LCP: on Lighthouse's mobile viewport (412×823) the measured LCP element is the support paragraph `#mfx-hero-body`, because the photograph now sits below the copy on phones. Both are server HTML with fixed boxes, so neither waits for hydration or the canvas. The canvas is never LCP: it mounts after hydration behind content that already reserves the section's height. CLS stays 0.

**Alternatives.** Keep the photo above the copy on phones so it stays LCP: rejected, the headline has to be the first read and the CTA has to fit in the first 844px. Keep the hero client-side: rejected by PS-008.

**Consequences.** Simulated LCP did not improve (5192 → 5486 ms median) because Lighthouse's simulated paint waits on main-thread JS, and the heavy JS on `/` is layout-level, loaded on every route (see QA §Phase 3 Perf). Those chains are outside the home sections and are the next perf step.

---

## PS-014 — Signage: a static district board replaces the slogan marquee

**Disposition:** decided and implemented (Phase 3).

**Context.** `MarqueeBand.tsx` repeated "Every block has a legend" six times with ✦ separators directly under the H1, cut words at 390, and was `aria-hidden`. The audit (§8, W12) and the art brief (§10 signage logic) call for a destination board.

**Decision.** `SignageBoard.tsx`: a signage-black band with an `h2` ("Four districts") and a list of four stops in route order, Harlem → Midtown → Downtown → Mega City. Each stop is the district name at `display-board` with one real cross street under it (`DISTRICT_COPY[d].streets`, the corners of the bundled photographs) and a disc in the district tone sitting on one silver route line. Vertical on phones, one row from `lg`. Static; server-rendered; readable by screen readers. The kit's `SignagePlate` (single line, truncates, `role="text"`) and `SignageBand` (console alert with a live region) don't fit a four-stop list, so the board composes the same tokens (`signage-black`, `signage-white`) instead.

**Alternatives.** A slow ticker: rejected, a moving band of place names reads as a crypto ticker and adds a motion owner with no purpose. Keeping the marquee static: rejected, it repeats the H1.

**Consequences.** The slogan is now defined once (`HOME_COPY.tagline`) and printed by the H1 and the seal artwork only.

---

## PS-015 — WORLD is the first bento: one dominant photograph, three modules

**Disposition:** decided and implemented (Phase 3).

**Context.** WorldSection had four equal-weight landmark photos with numbered 01–04 captions under a binary-contrast headline. ARCHITECTURE §4 allows a bento here: one dominant module, at most four, DOM order equal to mobile order.

**Decision.** 12-column grid from `md`: `world.primary` (Lenox Ave rowhouses) spans 7 columns and both rows; the story tile (h2, two short paragraphs) takes 5 columns in row 1; `world.secondary` (Wall Street) takes 5 columns in row 2. DOM order is photo → story → photo, which is the phone order. Two of three modules are photographs and they cover more than half the area. Captions are signage plates naming the district and cross streets (`PlaceCaption.tsx`). Hard 2px ink frames, no rounding, no numbers. The two image layers drift on desktop within `parallax.mid`/`parallax.near` inside fixed frames.

The optional fourth tile was left out: the brief's candidates were a third photograph or a text proof, and neither carried information the other three don't. `world.detail` stays in the art map, reserved for the Mon-in-district art (PS-007). `world.extra` was removed from the union.

**Consequences.** When creature art lands, `world.detail` becomes the fourth module (a Mon placed on a district street), which the art brief requires of World.

---

## PS-016 — NavBar collapse breakpoint is a prop; the site collapses below `lg`

**Disposition:** decided and implemented (Phase 3), fixed in the kit.

**Context.** At 768 the site header's links ran into the 198px wordmark (audit W9), and the waitlist CTA made the bar longer than "Log in" did. A review also found a keyboard trap: an open phone menu rotated past the breakpoint kept its Tab handler, but the toggle and links were `display: none`, so Tab never moved.

**Decision.** `NavBar` takes `collapseBelow: 'md' | 'lg'` (default `md`, so other callers are unchanged); the site passes `lg`. The focus ring is built from rendered elements only (`visibleRing` in `focus-cycle.ts`, unit-tested), an empty ring leaves Tab alone, and the sheet closes when the collapse breakpoint's media query starts matching. The site wordmark drops from 66 to 40px on a landscape phone (`short:` variant).

**Consequences.** Tablets from 768 to 1023 get the menu button instead of a crowded bar.

---

## PS-020 — STARTERS: three posters from `@acme/content`, art labelled as place

**Disposition:** decided and implemented (Phase 5).

**Context.** Audit W3: the starter cards were street photos under "Three eggs", with no creature, and the photo looked like it might be the Mon. The copy said "their own person" for a Mon (PS-005). No Baby render exists yet (PS-007).

**Decision.**
- Each starter is a poster: art plate first, then a Dex plate (`No. 002`), "Hatches from the Metro Egg", the Baby name in display type as the `h3`, and the Bloodline label on a ruled line. Every value comes from `starterCards()`, which reads `starterBloodlines` and `eggs` and nothing past the Baby node. The egg is matched by `bloodlineId`, not by array index.
- The art plate shows a street and carries a `PlaceCaption` signage plate ("Harlem, Harlem side street"). The alt describes the street. Nothing on the page calls the photo the Mon. Slots: `starter.1` Harlem brownstone stoops (Hood Ratti; v7 encounter tags street, courtyard), `starter.2` Apollo Theater on 125th St (Bodega Baddiee Cee; v7 tag community_hub), `starter.3` Times Square (Yote; canon gives no habitat, so the pick is for the Prism Egg's light and is not a canon claim).
- Layout: one column below `md`, side-on posters (art on the left half) from `md`, three side by side from `lg`. Nothing on the posters is interactive, so there is no hover state.
- The body names all three eggs from content ("Metro Egg, Corner Egg and Prism Egg") so the count is in the text as well as the layout, and the list announces three items.

**Alternatives.** A slider (PS-022). Making each poster a link to `/mons/[slug]`: rejected, the detail page lists the whole evolution line, which the home page must not lead into from a "no spoilers" introduction.

**Consequences.** Baby renders drop into `starter.<slot>` with no layout change (HANDOFF §STARTERS has the render spec). The section has no creature until then.

---

## PS-021 — CARE: one care stage led by the verbs, not a bento

**Disposition:** decided and implemented (Phase 5).

**Context.** Audit W10: one dark readout with three identical meter rows and percentages read as a dashboard. The closing line "A relationship, not a streak." was a binary contrast that named streaks while rejecting them. The title used "it" for a Mon. Audit §11 allows a CARE bento only around a dominant Mon reaction image, and that art doesn't exist.

**Decision.** One stage of three full-width rows on the daylight surface, separated by ink rules. In each row the verb (Feed, Rest, Play) is set at `display-lg`/`display-2xl` and is the visual; next to it, "Your Mon:" and the cue ("Asks for food.", "Gets sleepy.", "Comes closer."), then "You:" and the answer; last, the meter name and a small static 10-lot meter (`CareMeter`, plain markup with `role="meter"`; the kit `ProgressBar` was dropped because it brought Reanimated onto `/`). No percentage is printed. Each meter's accessible name is "Fullness, example level" and its value is announced as a percentage. A line under the stage says "Example levels, not a live reading." The closing line states the rule directly: "A low meter is a request. Nothing is lost while you are away." (orange-700, large text). Cues are drawn from v7 (food requests, sleepy contentment, the approach / step-back cue) and v11 ¶51; no cue is mapped to a specific sound or gesture.

**Alternatives.** Asymmetric bento with the `care` photo as the dominant module: rejected, a stoop photo isn't a Mon reaction and would be decoration. Keep the night readout: rejected (W10, and night is reserved for the hatch).

**Consequences.** When the Mon reaction art lands, CARE becomes the bento in audit §11: the reaction image dominant, the three rows beside it. Motion targets `mfx-care-head` and `mfx-care-readout` are unchanged.

---

## PS-022 — STARTERS: triptych, not a slider

**Disposition:** decided (Phase 5).

**Context.** The brief allowed one focused starter with a selector or `CardSlider` only if research proves it.

**Decision.** Static triptych (PS-020). A slider hides two of three starters at any time, which works against "make it obvious there are exactly three", and adds a keyboard and swipe model to a section with nothing to choose on the marketing page (the choice happens in the app, M08). The Mobbin references for this phase (Duolingo ABC's three cards, Tolan's single-character frame) support showing the set at once and giving each character the frame.

**Return condition.** If a hallway test shows people miss that the eggs are a choice, test a selector that changes nothing but emphasis, with `CardSlider`'s keyboard path.

---

## PS-017 — H-Lynk stage mount: capture until the first full frame, pipelines compiled off the frame path

**Disposition:** decided and implemented (Phase 4).

**Context.** Phase 1 measured 495ms from near-viewport to first frame and a 3.77s stall at 1280. On the Phase 3 build the stall didn't reproduce, but `DeviceStage` still removed the static capture the moment the canvas element existed, so the plate was empty for about 300ms, and mount ran as two long tasks (≈180 + 120ms) with a 300ms frame gap. A CPU profile put 139ms in node building and pipeline creation inside the first `render` and 53ms in PMREM. Reduced motion showed a capture with a light background inside the ink plate (W7).

**Decision.**
- The canvas mounts underneath the capture at 600px from the viewport (unchanged). `createDeviceScene` builds geometry and textures and returns. A second task bakes the studio environment and calls `renderer.compileAsync(scene, camera)`, which yields between objects. The device stays hidden until that resolves.
- The scene calls `onReady` after its first full frame; only then does `DeviceStage` fade the capture out (400ms CSS transition, no frame loop).
- Under reduced motion, or if neither WebGPU nor WebGL2 starts, the capture is all there is.
- The capture is a render of the scene's rest pose on exact `ink-950`, 896×1120, under a versioned file name (`h-lynk-core-v2.png`), because image optimisers cache by URL.
- Fallback order is unchanged: WebGPU, then WebGPURenderer's WebGL2 backend, then the capture.

**Alternatives.**
- `PMREMGenerator.fromSceneAsync`: deprecated in r181 and runs the same work.
- Render in a worker on an OffscreenCanvas: `ThreeCanvas` has no worker path, and the kit owns that file; not worth it for one stage.
- Keep the capture and skip the canvas on mobile: the object would be a flat picture on every phone; mount now costs ≈55ms tasks there too.

**Consequences.** Long tasks fall to about 55ms each and the worst scroll frame gap to 50–67ms (`PREMIUM_SITE_QA.md` Phase 4 Perf). The real model (`h-lynk-entry`) inherits the same path. A WebGPU device loss rebuilds on WebGL2 without bringing the capture back; acceptable while the rebuild is short.

---

## PS-018 — H-Lynk motion: one intro owned by the scene, then rest; ScrollTrigger only moves copy

**Disposition:** decided and implemented (Phase 4).

**Context.** Two systems moved the object at once: a scroll-scrubbed GSAP tween rotated and scaled the stage's DOM wrapper while the three.js loop swung the model's yaw every frame, pulsed the beam and animated sparks. The loop ran whenever the stage was visible, so a still page cost frames. The brief asks for settle, a slow turn, one scanner flare, a readable screen, then copy at rest; no spin, no bob, tilt ≤ 8°.

**Decision.**
- The scene owns the object. One intro measured from its first frame: settle 0–1.0s, turn 0–1.8s, flare 1.0–1.9s, screen on 1.5–2.4s. Then it reports rest and `DeviceStage` pauses the loop. A pointer over the stage wakes it for the tilt (`pageMotion.tilt.stage`); when the tilt settles it pauses again. Offscreen it is paused.
- `motion.ts` `w01.hlynk.reveal` targets only the name block and the two proof rows, played once at `top 70%`; it never touches the stage. No scrub, no pin.
- So per frame there is at most one owner of the object's transform, and ScrollTrigger does no per-frame work in this section after the entrance.
- Reduced motion: the capture shows the rest pose; copy is visible from the start (MotionRoot never arms).

**Alternatives.** Scrub the intro with scroll (ScrollTrigger driving scene time through params): rejected, it ties the object to scroll velocity on phones and puts ScrollTrigger back into the render loop's frame. A continuous slow yaw: rejected as idle decoration that also keeps a canvas loop alive.

**Consequences.** With the stage centred and idle, `site-qa:motion` sees no canvas loop. The intro replays only on a fresh mount. Proof rows land at 1.1s and 1.4s, before the object finishes turning, so no content waits on the canvas.

---

## PS-019 — Strike the push-to-talk chirp and the interactive HUD from the marketing stage

**Disposition:** STRIKE (Phase 4).

**Context.** Pressing the 3D left side key played a synthesised Nextel chirp (`nextel-chirp.ts`, `react-native-audio-api`), and hovering the 3D screen highlighted HUD buttons and switched tabs. Both needed a per-frame raycast. The key is a few pixels wide, nothing on the page points to it, it worked only with a pointer, and it presented "push to talk" and the HUD tabs as product facts that canon does not state (Decision #16 says "left action key"; Q42).

**Decision.** Remove both. The screen is a static, canon-safe face (tier name, a starter's Baby name, "Your Mon"). The stage takes pointer input only for the tilt.

**Return condition.** When canon names the action key's function and the page gives it a visible, keyboard-reachable control (with sound off by default and respecting reduced motion), a sound can come back as part of that control.

**Consequences.** `nextel-chirp.ts` is deleted. `react-native-audio-api` is still declared in `apps/web/package.json` and transpiled in `next.config.ts` with no importer in `apps/web`; removing it belongs to the config owner.

---

## PS-023 — Waitlist UI: inline form on `/` and `/get`, one server action, progressive enhancement

**Disposition:** decided and implemented (Phase 6). Builds on PS-001 (the backend, commit def0366).

**Context.** PS-001 put capture in admin-vite (`POST /v1/waitlist`, Payload `waitlist` collection) and gave `apps/web` a server action, `joinWaitlistAction`, with an exhaustive `WaitlistResult`. Phase 2 had replaced the fake `/get` form with a static "Sign-ups open soon" notice. The header and hero CTAs link to `/get`.

**Decision.**
- **Placement.** Inline, twice: a WAITLIST section on `/` right after HATCH (`source=home`) and the same form on `/get` (`source=get`), which loses the "Sign-ups open soon" notice. No modal: a modal adds a focus trap and a client-only open state for one email field, and it can't work without JavaScript. Header and hero CTAs keep linking to `/get`, a real route that now holds the form.
- **Boundary.** `WaitlistSection` and `GetPage` are server markup; `WaitlistForm` is the only client island. It renders a plain `<form>` from `@acme/ui/html` whose `action` is `useActionState(joinWaitlistAction)`. `useFormStatus` drives the pending button. No `useState`/`useReducer`; the district comes from the existing Zustand `useDistrictStore`. To type this, the web forks of the `/ui/html` primitives gained their native form attributes (`Form action`, `Input name/type/required/autoComplete/defaultChecked`, `Label htmlFor`, `Button type`); no behaviour changed.
- **Progressive enhancement.** Before hydration (or with JavaScript off) the form posts to the action and the page renders the result; checked for joined and invalid.
- **Validation and abuse.** All server-side, in the PS-001 handler: zod email check, honeypot `website` (a filled honeypot gets a quiet `joined`), per-IP hourly rate limit keyed on the visitor IP that the action vouches for with `WAITLIST_FORWARD_SECRET`. The browser adds `type=email`, `required` and `maxlength=254` as conveniences only.
- **Idempotency.** A repeat email answers `joined`; the copy covers it ("Signed up before? Nothing changes, and you'll still get just the one.") without saying whether the address was already there.
- **States.** Every `WaitlistResult` maps to one string through `waitlistMessage()` (exhaustive switch, unit-tested). Field errors are tied to the field; everything else goes to one polite `<output>`; joined moves focus to its heading.
- **Data.** Emails land in Payload's `waitlist` collection. Required env: `ADMIN_API_URL`, `WAITLIST_FORWARD_SECRET` (both server-only). Unset `ADMIN_API_URL` shows the error state and logs `[waitlist] ADMIN_API_URL is not set`.

**Alternatives.** `/get` only, with the home CTA linking there: one more page load at the moment of intent, and HATCH would end on a link. A footer newsletter field: a second form for the same thing (rejected in the FOOTER references). `useOptimistic` for joined: it would show success before the server said so, which is the W1 failure again.

**Consequences.** The district field records `midtown` for anyone who never touches the hero picker, because that is the store's default; analysis should treat `midtown` as "default or Midtown". Component-level tests aren't possible without adding a React test framework, which the repo doesn't have; the state mapping is unit-tested and every state was exercised in a browser against a mock of the endpoint (QA §Phase 6).

---

## PS-024 — HATCH: one night band, headline over a wide window, no button

**Disposition:** decided and implemented (Phase 6).

**Context.** Audit W5: H-Lynk, Care and Hatch shared one split template, so the page had no climax. The hatch band was a 6/5 split of copy and a framed photo with its own CTA button. `hatch.body2` gave the Mon a pronoun ("its choice … how it says yes"), breaking PS-005.

**Decision.** A single column on `ink-950`: the largest section headline on the page ("Pick a time." / "The egg waits.", the second line in orange), then the night photograph as a 21:9 window across the full grid (4:5 on phones), then the story and "Be there when it opens." No border, gradient, glow or pulse is added; the bridge and tower lights in the photo are the light source. The CTA button is removed because the waitlist sits directly below. The existing `w01.hatch.reveal` is the one motion moment; under reduced motion everything is at rest. New body copy: "Incubation takes 15 minutes, 30 minutes or an hour. Go about your day. You get one notification when it's ready." / "Then your Mon makes a choice too. The first look your Mon gives you is the yes, and sometimes that takes a moment." (Decision #14: the Mon chooses and may hesitate, never rejects.)

**Alternatives.** Copy laid over a full-bleed photo: needs a scrim, which is a decorative gradient under the art-direction rules, and the type would fight the lights. A countdown or a 15/30/60 picker on the page: the choice happens in the app, and a timer is exactly what the hatch copy says isn't there.

**Consequences.** HATCH reads as the high point because it is the only full-width image on the page and the only night band after H-Lynk. When the egg art lands it replaces the photo in the same box (HANDOFF §HATCH has the spec); nothing else changes.

---

## PS-025 — Footer scene: static skyline, RiverTide code-split

**Disposition:** decided and implemented (Phase 6).

**Context.** The footer ran `RiverTide`, a canvas, under the Harlem river. It already mounted lazily and paused offscreen, but its code shipped with the footer on every page, and after Phase 6 the page ends hatch → waitlist → footer: a moving scene right after the conversion form would pull the eye away from it and add a second night "moment" after the hatch.

**Decision.** `scene="skyline"`: the static Harlem `SkylineBand` in plain views. In the kit, `SiteFooter` now imports `RiverTide` with `React.lazy`, so footers without the river ship none of its code; the `river-tide` scene keeps its old behaviour for other callers. Footer links get a 24px minimum target from `md` (A11Y F10).

**Alternatives.** Keep `river-tide`: it meets the letter of the brief (lazy, paused offscreen, far from the H-Lynk stage) but competes with the form and the hatch. `none`: a bare keyline loses the city edge the references (IKEA, General Intelligence Company) show working.

**Consequences.** `site-qa:motion` idle-at-bottom shows 0 canvas loops at both widths. If the footer ever gets the river back, it should be on pages without a form above it.

---

## PS-026 — Hero caption names the landmark, not a district

**Disposition:** decided and implemented (Phase 7 polish).

**Context.** The hero poster is the Chrysler Building. Its caption plate read "Midtown, Lexington Ave at 42nd St" with the orange Midtown disc, and it sits directly above the district picker. Picking Harlem redrew the city behind the hero but left the plate saying Midtown, so the caption read as the picker's state and as a picker that didn't work (Phase 7 critique).

**Decision.** The hero caption names the photo's real place: "Chrysler Building, Lexington Ave at 42nd St", with no district disc and no district name. `PlaceCaption` takes a `landmark` flag for this; every other caption on the page (World, Starters, Hatch) keeps the district disc and name, since nothing there is picked.

**Alternatives.** Swap the hero photo per district: four LCP images, a layout shift risk on each pick, and the hero would be pre-loading three photos nobody asked for. Keep the district caption and add "Photo:": still shows a district name next to a district control. Drop the caption: loses the honest place label the art-direction rules require for photographs.

**Consequences.** The picker owns the city canvas and the hero photo stays one fixed poster. If the hero ever gets one photo per district, the caption can go back to the district form and follow the store.

---

## PS-027 — Hero city holds still after 4.5 s

**Disposition:** decided and implemented (Phase 7 polish, a11y N1).

**Context.** The hero `CityBlocks` canvas animated for as long as the page was open, beside the H1 and the CTA, and the only way to stop it was the OS reduced-motion setting. WCAG 2.2.2 allows motion that starts on its own to run up to 5 s without a pause control.

**Decision.** `HeroCity` passes `paused` to the city 4.5 s after mount, so it settles on a still frame. Picking a district restarts the same 4.5 s window, so the new city visibly arrives and then stops; that motion is the answer to the visitor's own action. Offscreen pausing is unchanged. The timer is a Zustand instance store, per the repo's no-`useState` rule. The canvas stays `aria-hidden`; its per-district `cityLabels` reached no assistive tech, so they are deleted and the hero `<section>` is named by its headline (`aria-labelledby="mfx-hero-title"`, new `SceneSection` prop).

**Alternatives.** A site-wide "Pause motion" toggle stored in MMKV/Zustand: more surface and state for one canvas, and the page has no other auto-running motion after PS-025. A slower loop: still fails 2.2.2.

**Consequences.** Verified on the :3110 build: hero pixel hashes stop changing by ~5 s, change again for ~1.5 s after picking Harlem, then hold. If a later scene loops past 5 s, a real pause control becomes necessary.
