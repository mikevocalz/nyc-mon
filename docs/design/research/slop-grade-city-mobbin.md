# Slop-grade city: Mobbin reference audit

Lane A1, 2026-10-27, for `docs/plans/slop-grade-city-prompt.md` §6.2. Companion audits: `game-lobby-mobbin.md`, `realism.md` § Settings.

Method: Mobbin MCP `search_screens` (six queries) and `search_flows` (one query) on iOS, 2026-10-27. Each result's screenshot was viewed as the inline preview the MCP returns before anything was written; the full-resolution files were not downloaded this time, so fine text in a few screens is read at preview resolution and marked where that matters. The `mobbin-pass` skill loaded, but it is written for MoyoLearn; its procedure (structural move adopted, patterns refused and why, query recorded) is applied here. References inform hierarchy and states, never pixels, colour, type or copy.

Rules that decide what a reference may teach: the copy deck's "promise only what ships" and "no pressure" rules, the graphics surface's three-tier, no-per-effect-toggle rule (`graphics-settings-surface.md`), and G02's existing lobby hierarchy (`game-lobby-mobbin.md`).

## 1. Game lobby, world loading (`features/game/lobby/GameLobbyScreen.tsx`)

Queries: screens "mobile game loading screen with progress bar while the game prepares"; screens "game failed to load error screen with retry button"; flows "game first launch downloading and preparing content before play".

| App | Link | What the screen shows | Structural move | Take / reject |
|---|---|---|---|---|
| Zomato (ZPL Hand Cricket) | https://mobbin.com/screens/5c938b04-7446-4323-a3ff-0a28d124a55f | Full-bleed game art, logo top, a short "LOADING" caption over a thin bar in the bottom fifth | Progress lives low, under the art, and is small | **Take** the placement: the compile bar sits under START's zone and leaves the lobby identity alone. **Reject** the caption-only bar: it gives no number |
| Alan | https://mobbin.com/screens/2a7512a1-7d5f-40be-aa2f-0e29def7ce1a | "Loading the experience..." over a determinate bar, decoration around it, a close button | Sentence plus determinate bar | **Reject**: "the experience" names nothing. `g02.start.compiling` names the step |
| yope | https://mobbin.com/screens/339bdee5-6672-44ca-82b3-75c0f64fd5ca | A bar under the title, then a checklist: three steps ticked, the fourth spinning | Named steps, each ticked when done | **Take** the idea that the step in progress is named. G02 shows one named step (lights) with a percentage, not a checklist: the lobby has one slow step, and a list would invent the others |
| Hers | https://mobbin.com/screens/44f7a26e-46b8-4512-a432-598171fb7885 | Segmented progress at the top, three step chips with checks, the third greyed while pending | Pending step shown dimmer than finished ones | **Take** for the slow state: the label stays, dimming nothing; the number keeps moving or the slow line appears |
| Mimo | https://mobbin.com/screens/f9f50b35-1ac9-4dd3-b06d-9b328c996fc1 | "Just a second! We're putting together your personalized curriculum..." under a top bar | Reassurance line with a time promise | **Reject**: "just a second" promises a duration nobody has measured (`pipecache` probe not run) |
| PlayStation App (flow "Downloading a game") | https://mobbin.com/flows/d88011b8-c3f9-4a76-bf6f-334840d4f025 | "Download to Console" becomes a panel with "Time until playable... 3 m left", a bar, "Downloading...", and Cancel; then "Play on Console" | The primary button's slot becomes the progress panel, then turns back into a play button | **Take** the slot swap: progress replaces START in place and START returns when ready. **Reject** the time-left estimate until measured |
| Eventbrite | https://mobbin.com/screens/9464f17d-dd00-4989-917f-a485bbe79400 | Illustration, "Something went wrong", one dark "Try Again" | One sentence, one action | **Take** one action for the failed state. **Reject** the empty "something went wrong": `g02.start.compiling.failed` says what failed and that the save is fine |
| Clue | https://mobbin.com/screens/eb39d007-32c8-48ec-8ad0-8dad8609e95d | "Looks like something's gone wrong", a line saying what to do if it continues, "Try again", "Copy error information" | Failure copy carries the next step if retry fails | **Take** the "if it keeps happening" clause, already in `g02.resume.fail.generic`; the copy-error action is a debug affordance for a later lane, not drafted |
| Tinder | https://mobbin.com/screens/99fc436b-55de-44d7-bbff-f29f50830cbf | A modal "This is awkward" over a bar stuck at 100 % | Error modal on top of a full progress bar | **Reject**: a full bar behind an error contradicts itself. The failed state replaces the bar |

States for the lobby (copy in `COPY_DECK.md` § Lobby: shaders compiling):

| State | What shows | From |
|---|---|---|
| compiling | START's slot shows "Setting up the city's lights · n%", determinate | Zomato placement, PlayStation slot swap, yope named step |
| slow | Same bar, the line "Still setting up the lights. Your game is safe." below it; the bar keeps its last value | Hers dimmed pending step |
| failed | Bar removed; failure line and one "Try again" | Eventbrite, Clue; Tinder rejected |

## 2. Graphics settings (`features/settings/settings-content.tsx`, per `graphics-settings-surface.md`)

Queries: screens "mobile game graphics quality settings screen"; screens "time of day picker with sunrise, day, sunset and night options".

| App | Link | What the screen shows | Structural move | Take / reject |
|---|---|---|---|---|
| Spotify (Video quality) | https://mobbin.com/screens/601da1d4-14f3-4219-b50c-11cf8c71548a | "Auto (recommended)" first with a one-line consequence, then Low to Very high, each with its own consequence line; a note that the choice applies to this video only | Automatic first; every option says what it costs | **Take** the ordering (already the surface's rule). **Reject** the "(recommended)" tag: the deck bans badges on the default |
| Riveo | https://mobbin.com/screens/2ccc629d-680d-4e03-8767-fc649fbe3cae | A sheet with segmented rows for resolution and frame rate, a caption under each ("Great balance between quality and render time") | Segmented row plus one caption | **Take**: matches `SegmentedControl` plus caption; the same reference `realism.md` used, so the time-of-day row joins as a fourth segmented row, not a new control |
| (Not Boring) Camera | https://mobbin.com/screens/c7137eaa-dc79-4847-b7b8-bd4a5e3a1dd5 | Grouped radio rows (SuperRaw, ProRAW, Basic) each with a one-line trade-off; an HDR toggle with an explanation | Each option names its trade-off | **Take** the trade-off line pattern for `quality.desc`. **Reject** the hero illustration and radio list: pills already decided |
| Deezer (Audio) | https://mobbin.com/screens/b4b33b23-6f90-420e-860a-396a99ed3504 | Per-network quality rows, an explanatory paragraph with bitrates, an action sheet with four tiers | Numbers explain the tiers | **Reject** numbers in UI: the surface bans per-effect detail; render scale and SSR stay internal |
| Ten Percent Happier | https://mobbin.com/screens/ebefeee1-7173-40ef-97d8-50b8b902f728 | Three tiles with icons: Morning, Mid-Day, Evening, the first selected; a time wheel below | Time of day as named periods with glyphs | **Take** named periods with a glyph each for the time-of-day row (Dusk, Golden hour, Midday, Night). **Reject** the clock wheel: presets are lighting, not a clock (COPY_DECK note) |
| Finch | https://mobbin.com/screens/d2b269af-748d-409a-9c28-f8573bc8c438 | A time wheel with three preset chips under it (Morning 9:00am, Afternoon 1:00pm, Evening 8:00pm) | Presets as chips beside a free value | **Reject**: there is no free value to pair the chips with |
| Philips Hue | https://mobbin.com/screens/d4eb3386-7bff-485e-b2d2-024d41a26561 | Options "At a specific time", "Sunrise" (selected, with offsets), "Sunset" | Solar events as options | **Reject**: offsets would expose sun angles, a per-effect knob the surface bans |

Outcome: the time-of-day control is a fourth row on the graphics surface, `SegmentedControl` with four options and a glyph each, captioned once. It does not need a new component.

## 3. Game HUD (`features/game/GameScreen.tsx`)

Query: screens "turn-by-turn navigation screen showing current street name chip over the map".

| App | Link | What the screen shows | Structural move | Take / reject |
|---|---|---|---|---|
| Apple Maps | https://mobbin.com/screens/fa3e962f-5b20-4705-b9ee-853017b9c8b4 | An opaque dark card at the top: distance and "Turn right onto Santa Cruz Ave"; a destination sheet at the bottom | Street text on its own opaque card, never on the map | **Take** for any street chip: an opaque face, which also settles the contrast case in DESIGN_SYSTEM (case 1) |
| Grab Driver | https://mobbin.com/screens/a8f2e305-d713-4008-95e0-922cfd91bb56 | Opaque card top-left with distance and street; a small "30 min · 27.4 km" pill over the map; round controls at the corners | Small pill floats over the map only with its own fill | **Take** the opaque pill. **Reject** corner-control density: the game HUD already owns its corners (G01) |
| Google Maps | https://mobbin.com/screens/2d80b74e-3ff0-4331-a600-9e22bd8fadf5 | Green instruction card, POI cards over the map, "Re-centre" and "Refresh" pills, a bottom ETA bar | Many floating cards | **Reject**: the map is buried; the city frame is the product here |
| Grab | https://mobbin.com/screens/699363da-045c-4dbb-80f3-4ed394f29195 | Dark instruction card with "30 m, Sharp right", a hint banner, a bottom sheet | Same opaque-card pattern | Confirms Apple Maps; nothing new |
| Transit | https://mobbin.com/screens/c88b39a9-350c-4467-86ab-1baf574bc4f5 | Route summary card and a "HEAD SOUTHEAST in a pedestrian zone" card at the bottom | Direction phrase in caps over a sentence | **Reject** for the HUD: no navigation exists in the game |

Outcome: **no HUD layout change in this lane.** The game has no street chip today and no navigation; the spec's "street chips" are a later frontend-design item (§6.1 #9). What carries forward is a constraint: any chip drawn over the physically lit frame has an opaque face. Whether the time-of-day control also appears on the HUD is left to that item; the default here is settings only, so the HUD gains nothing.

## 4. Legal & credits (`settings-content.tsx`, `MapAttribution.tsx`)

Query: screens "open source licenses and acknowledgements screen in settings".

| App | Link | What the screen shows | Structural move | Take / reject |
|---|---|---|---|---|
| Yahoo Finance | https://mobbin.com/screens/0029ed00-c28f-4922-aa26-44d2a80a9df6 | "App Credits": one intro paragraph, then per component a name, a project-code link, a licence link and the copyright line | Name, what, licence, link per entry | **Take**: the Slop row is name plus one line plus a "View … repository" link, the shape § City data credits already uses |
| Yahoo News | https://mobbin.com/screens/1c8e6943-455f-4fe6-91b0-570bf9d93499 | "Open source licenses" under "Legal", a list of library names with chevrons | Index list, details one level down | **Take** for scale later; with one software credit today, a list of one is padding. **Reject** for now |
| Quicken | https://mobbin.com/screens/1310c2bf-4d04-4d63-90a6-9715842f02f0 | Cards reading "This product may contain @x/y. License: MIT" | Package names as entries | **Reject**: package names mean nothing to a Caller; the row names the project and its author |
| GoPro Quik | https://mobbin.com/screens/0dc4d621-2cdb-496a-b40d-52becc05c4f5 | Full licence texts run together in small type (preview resolution: body text not legible at this size) | Full texts inline | **Reject**: the full MIT text belongs in the linked repository and `docs/licenses/`, not in the card |
| PlayStation App | https://mobbin.com/screens/326d33dd-cbf8-4c9d-9f25-47575ca80243 | "Intellectual Property Notices": trademarks first, then licence texts | Trademark notices before software | **Reject** the ordering for us: data and code credits are what the card owes |

Outcome: a "Software" group under the existing City data group, one row (`settings.legal.software.slop.*`). Code and data credits stay in separate groups so the Slop row never reads as a data credit (no Slop geodata is imported).

## Refused patterns, collected

| Pattern | Seen in | Why refused |
|---|---|---|
| Time promises during loading ("just a second", "3 m left") | Mimo, PlayStation App | No compile time is measured yet (`pipecache`) |
| Error over a full progress bar | Tinder | Contradictory state |
| "(recommended)" badge on the default | Spotify | COPY_DECK "no pressure" rule |
| Bitrates and numbers in a quality picker | Deezer | Per-effect detail is internal (`graphics-settings-surface.md`) |
| Clock wheel or solar offsets for time of day | Ten Percent Happier, Philips Hue | Presets are lighting, not a clock |
| Floating cards over the map | Google Maps | The city frame is the product |
| Package-name licence lists | Quicken | Means nothing to a Caller |

## iPad Pro

None of these screens changes layout on iPad Pro in this lane, so `skills/mikevocalz-foldable-layouts/SKILL.md` was not needed. If the frontend-design item moves the time-of-day control onto the HUD, it reads that skill first; tablets keep the physical right rail.
