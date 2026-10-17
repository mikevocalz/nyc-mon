# Harlem v3: Mobbin reference audit

Owner: Lane A1 (research and design), `docs/plans/harlem-v3-valdrada-prompt.md` §6.1 #2 / §6.2. Written 2026-10-17. Covers the three screens the spec assigns: Settings "Legal & credits", the game lobby's world loading, and the game screen's street-name labelling.

Method: Mobbin MCP `search_screens` on iOS, 2026-10-17, per `game-lobby-mobbin.md`. Each screenshot below was downloaded at full resolution (`scratchpad/mobbin/v3-*.webp`) and viewed before writing; nothing is described from metadata. References inform hierarchy and states, never pixels. Mobbin emitted a "high AI usage" notice mid-session; usage is unlimited in beta and the searches completed.

Screen by screen, the question is narrower than the search:

- **Settings legal**: v3's tile owes credit to OpenStreetMap (ODbL), Valdrada and named NYC Open Data sets (`settings-content.tsx` renders `map-data-credit.ts` today, one source). The pattern needed is a multi-source attribution list where each source carries its own licence link.
- **Lobby loading**: `await-world-ready.ts` resolves on `firstFrame`, restarts its 20 s timeout whenever `loadProgress` advances, and fails to a generic strip (`GameLobbyScreen.tsx`). The pattern needed covers loading, slow-but-progressing and failed states for a large local dataset.
- **Game screen street names**: v3 keeps the corner blade signs (`signage.ts`, `street-furniture.ts`); names now come from CSCL. The pattern needed is how a map surface labels streets without drowning the scene.

## Settings — Legal & credits

### 1. Shop: a legal hub that ends in "Licenses"

- URL: https://mobbin.com/screens/f4b55de4-f97d-41ac-a421-13c587e066f2 · App: Shop
- Shows: wordmark, tagline and web address; three icon rows — Terms and conditions, Privacy policy, Licenses — a "By using Shop, you agree to…" line with inline links, and a version string.
- Pattern: legal grouped as named rows, one row per document, versions and boilerplate parked at the foot.
- Strength: the section reads as a directory, not a wall; the licences row is a peer of terms and privacy.
- Weakness: one Licences row hides a long flat list behind it — fine for npm packages, wrong for data sources a screen-reader must reach individually.
- Application: the settings legal section keeps its existing rows; the data credit becomes a named row per source, not a footnote inside a Licences catch-all.

### 2. Universe: the provider grouped with its map source

- URL: https://mobbin.com/screens/153e58f5-c0e2-4b96-b0a4-33133f7b576a · App: Universe
- Shows: a Legal screen with two labelled groups — UNIVERSE (Terms of Service) and MAPBOX (MapBox, MapBox Map Feedback, OpenStreetMap) — plus the caption "Universe uses MapBox as a map provider for Map Block."
- Pattern: a source group gets its own heading and one line saying what it is *for*.
- Strength: the data supplier sits next to its own attribution row; a reader can tell which link is the licence and which is the provider. This is the only reference that faces the same problem as v3 — a product built on someone else's map data.
- Weakness: the rows are bare chevrons; no licence name is visible until you drill in.
- Application: take the grouped layout — "City data" as its own group with a one-line role caption — but print each source's licence inline (`ODbL 1.0`, `MIT`) so no tap is needed to learn the terms.

### 3. Yahoo Finance: per-component credit cards

- URL: https://mobbin.com/screens/0029ed00-c28f-4922-aa26-44d2a80a9df6 · App: Yahoo Finance ("App Credits")
- Shows: a modal sheet; a paragraph acknowledging open source; per component: name, "Project code:" URL, "License: (Apache)" URL, copyright line.
- Pattern: each source is a small record — name, two links (project, licence), one attribution line.
- Strength: the two links have different jobs and different labels; nothing is implied.
- Weakness: dense URL text is read-only — these are dead links printed as text, not controls.
- Application: take the record shape per source: name, what it supplied, licence name as the link label. Keep the links live, never printed URLs (contrast and touch rules in `DESIGN_SYSTEM.md`, and G7's copy in `COPY_DECK.md`).

### 4. Twitch: attribution as a paragraph of links

- URL: https://mobbin.com/screens/f7fd41da-9370-443b-abde-a2e4b0494253 · App: Twitch
- Shows: "Licenses" prose list — "Twitch for iOS uses the following open-source code:" then each library as `name (URL) – licence – © owner` on flowing lines.
- Pattern: name and licence inline, no per-row chrome.
- Strength: every entry names its licence and owner in one line; it compresses well.
- Weakness: at 30+ entries it becomes unreadable grey paragraphs; no grouping, no hierarchy.
- Application: take the one-line `name — licence` grammar for each NYC Open Data row; reject the unbroken prose list — the v3 sources are grouped (OSM, Valdrada, per-dataset rows), not alphabetised package soup.

### 5. Tinder: the flat package list — rejected as our shape

- URL: https://mobbin.com/screens/5957b0fa-2cbc-40dc-85ea-f327b638f395 · App: Tinder
- Shows: "Licenses" as a bare alphabetical list of package names (AFNetworking, AppAuth, Branch…), every row a chevron.
- Pattern: identifier soup, alphabetical.
- Strength: fine for build-time OSS manifests, which is what it is.
- Weakness: nothing says what anything *is*; there is no grouping and no licence on the list surface. A dataset credit is a legal record of where the city came from — the reader must see "OpenStreetMap" and "ODbL" without tapping through.
- Application: reject the flat list for city data. OSM/ODbL and the Valdrada citation are first-class rows. (The pattern is still correct for an eventual third-party-code screen if one ships.)

## Game lobby — world loading

Current behaviour the references are judged against: START waits on `firstFrame`; `loadProgress` restarts the 20 s timeout each time it advances; failure returns to idle with one generic strip (`await-world-ready.ts`, `GameLobbyScreen.tsx`).

### 6. Meta AI: a determinate bar that says what is downloading

- URL: https://mobbin.com/screens/c622740d-5e61-41ef-9d68-a1a259525d64 · App: Meta AI
- Shows: "Downloading…", a from/to caption ("Spanish ⇄ English"), the note "Keep the app open and make sure your glasses are nearby and turned on", and a determinate bar at "6%".
- Pattern: what is loading + how far + what the user must not do, in three lines.
- Strength: the percentage is real progress and the instruction names the constraint.
- Weakness: the instruction is device-specific boilerplate here; a game lobby does not need it while the world is local.
- Application: `loadProgress` is a real ratio already — take the determinate bar with a plain label of what is loading ("The city"). A "keep the app open" note is only warranted if the fetch actually leaves the bundle (G5 decides; today the tile is bundled JSON).

### 7. Speak: progress that does not pretend

- URL: https://mobbin.com/screens/bcecab14-1d64-4c35-9630-db30b19c9c9b · App: Speak
- Shows: one word — "Downloading." — over a determinate bar, a close affordance top-left.
- Pattern: the least a loading state can honestly say: the verb, the bar, a way out.
- Strength: nothing fabricates stages or fake step labels.
- Weakness: no fallback messaging if the bar stalls; nothing distinguishes slow from stuck.
- Application: this is the floor the lobby already meets (progress drives START's state). What is missing in ours is the stall story — covered by the next two references.

### 8. Sora: duration honesty plus a disabled action

- URL: https://mobbin.com/screens/51cc3837-a837-436b-b676-6333faa2dafd · App: Sora
- Shows: "Uploading", "This may take up to 1 minute.", a thin determinate bar, and bottom buttons Retake and Continue with Continue visibly disabled while the upload runs.
- Pattern: name the wait, show the bar, disable what cannot run yet.
- Strength: the disabled primary is honest about dependency — nothing invites a tap that would fail. The duration line sets expectation without a countdown.
- Weakness: the capped estimate is a guess with a number; a world build has no honest "up to N".
- Application: START already disables correctly on the loading path. Take the pattern of an expectation line for the *slow* state — but only a qualitative one ("Taking longer than usual"), never an invented duration.

### 9. N26: the slow state says so out loud

- URL: https://mobbin.com/screens/f05ea4f7-835c-4e5a-aa73-d4ce81ec8959 · App: N26
- Shows: a determinate ring, "Uploading your files, this may take a few minutes…", and a footer banner "Please don't minimize or close the app during upload."
- Pattern: normal progress plus a persistent note for the long-tail case.
- Strength: the slow case is acknowledged in the UI, not left to look frozen; the footer persists, it is not a toast.
- Weakness: the instruction is again about an upload; ours is a local build, so "don't close" mostly does not apply.
- Application: when `loadProgress` has stalled but the timeout has not fired, the lobby should shift to a slow state that says waiting is still working (per §6.1 #6 the announcement stays accurate). The failure strip then covers terminal failure — three states, each distinct: loading (bar), slow (bar + note), failed (strip + back to idle).

### 10. Lloyds: the modal wait — rejected

- URL: https://mobbin.com/screens/3c5dec71-aa99-4b46-8c0d-21cf63b21757 · App: Lloyds Mobile Banking
- Shows: a dimmed screen behind a white card titled "Please wait" with a spinning lock ring.
- Pattern: modal spinner, no progress, no escape.
- Strength: it is honest that you cannot do anything.
- Weakness: indeterminate and modal — no progress, no recovery path, no way to distinguish a 2-second stall from a dead pipeline. For a world that loads in steps, this hides the only useful signal.
- Application: rejected. The lobby's determinacy and its failure strip are both better than this; do not regress to a bare "please wait".

## Game screen — street-name labelling

v3 street names come from CSCL records; the shipped pattern is green blades at signed junctions (`signage.ts`), which is the NYC street-furniture convention (WalkNYC discipline: a name lives at the corner it names). The map refs below all use centreline labels instead — a different contract, so the takes are about legibility and restraint, not placement.

### 11. Fresha (Apple Maps): centreline labels, one name per stretch

- URL: https://mobbin.com/screens/7fd4b74d-ab0a-45c3-b90c-438b0778940f · App: Fresha
- Shows: dense street map; every named road carries its name in caps along the centreline ("MENLO-ATHERTON HIGH SCHOOL" vs the quiet "WILLOW RD"); landmarks get text plus a category glyph.
- Pattern: road names repeat along the line at intervals; size tracks road importance.
- Strength: labels follow the road's direction and read without a legend.
- Weakness: this density is the opposite of ours — on a 3D scene, repeating text along every street is noise, and it is also not how the city's own signage works.
- Application: keep the corner-blade convention. Take only the density lesson: one name per junction, never a label per segment — `placeSigns`'s 30 m merge and 400 cap already enforce it.

### 12. Journal: street names as quiet caps on a light map

- URL: https://mobbin.com/screens/1218d293-fb70-4a5a-81ee-6e05d1f4c7b6 · App: Journal
- Shows: pale streets, names in small caps riding the centrelines, an empty-state card over the map.
- Pattern: labels are the quietest layer — same hue as the streets, sized under POIs.
- Strength: names are findable but never the loudest thing on screen.
- Weakness: light-on-light type at that size would fail our contrast norms; a card over the map is not our HUD model.
- Application: supports what the blades already do — sign-green face, white lettering (`signGreen`/`signText`), readable but subordinate to the scene. Reject any floating text layer over the city.

### 13. Pangea Charging: landmark labels attached to places

- URL: https://mobbin.com/screens/1d04535e-2fae-4fb2-8bac-fd6c132918b0 · App: Pangea Charging
- Shows: street labels along roads, POI names ("Art Institute of Chicago", "DePaul University") at their sites with small glyph chips, a destination card at the bottom.
- Pattern: names sit on the thing they name; the only elevated element is the destination card.
- Strength: the landmark's label is anchored to its location, not floating in a corner of the map.
- Weakness: everything is labelled at once; every POI competes with the route.
- Application: the three landmarks are already named by their building treatment (the Apollo's lettered marquee and blade). If a landmark name ever appears in 2D HUD copy, it anchors to the place — never a detached overlay list.

### 14. Tesla Robotaxi: what a muted map looks like when the route is the subject

- URL: https://mobbin.com/screens/e9bf4bec-3351-4a59-bbf6-7c61633c2844 · App: Tesla Robotaxi
- Shows: pale grey map, minimal street labels, the route and vehicle dominant; "Arriving in 3 min" + destination card under the map.
- Pattern: suppress everything that is not the current task's geography.
- Strength: proof that labels can go nearly silent when they are not the job.
- Weakness: a map whose names are suppressed is not a city you can learn — the trade is wrong for a world whose streets are the point.
- Application: reject as the default; it argues for the inverse — the blades stay because street names are part of the world, not a mode.

## Patterns carried into the v3 surfaces

| Pattern | From | Where it lands |
|---|---|---|
| A named row per source, licence printed on the row | Yahoo Finance, Universe | Settings legal/credits row list |
| Source group with a one-line role caption | Universe | "City data" group above the licence rows |
| `name — licence` one-line grammar | Twitch | NYC Open Data sub-rows in `COPY_DECK.md` |
| Determinate bar + what is loading | Meta AI, Speak | Lobby `loadProgress` presentation |
| Slow state that says waiting is still working | N26, Sora | Lobby `stalled` messaging before timeout |
| Disabled primary while the world builds | Sora | START's existing disabled state (confirmed, no change) |
| One name per junction, not per segment | Fresha, Journal | `placeSigns` merge/cap (already shipped; confirmed) |
| Names anchored to their places | Pangea | Landmark treatment stays in-world, no floating labels |

## What no reference answers

- A licensing row that is also a *data provenance* record (field-level `e` bits are invisible to Mobbin's legal screens). F2's audit and N8's test own that; these refs only shape the visible row list.
- A load that is CPU-bound local work, not a download. No Mobbin loading screen faces a bundled 25 MB dataset; the "slow" copy must not promise network recovery.
- Street blades in a 3D cel world. Every ref is a flat map; nothing on Mobbin covers signs standing on a modelled kerb. The §6.1 #7 critique and the recognition study's masked-blade variant carry that question instead.
