# Proof of craft (W01 PROOF)

Owner: `content-and-proof-editor`. Code: `apps/web/components/home/proof.ts` (data contract and register), `ProofSection.tsx` (section), `proof.test.ts` (gate tests), copy in `copy.ts` → `W01_COPY.proof`. Shots: `rebaseline-2026-10-12/after/proof-{390,1440}.jpg`.

## 1. Finding: there is no social proof to show

canon-guardian checked on 2026-10-12. The repo, the docs and canon contain **no** testimonials, user or player quotes, press mentions, reviews or ratings, player or waitlist counts, hackathon or award results, or beta and playtest quotes. The HANDOFF bans social proof and counts on `/` anyway (`PREMIUM_SITE_HANDOFF.md`, WAITLIST "Never: counts, countdowns, 'spots left', social proof").

So the section shows only **artifacts that exist in this repo**, each labelled for what it is. Nothing on it is a quote, a number or a claim about players.

## 2. The section

- **Place:** after CARE, before the HATCH band. The story (world, H-Lynk, starters, care) is told first. The proof then backs the ask (hatch, waitlist) without interrupting the story. It does not follow STARTERS, because egg concept art right after the starter posters would read as a creature gallery.
- **Composition:** a dated filmstrip after KÖPPEN (`research/MOBBIN_2026-10_ADDENDUM.md` #8). One lead artifact sits large on the left (5 of 12 columns). The header sits at the top right, and a strip of four frames runs along the bottom right, each with its date, kind mark, status label, title and a short caption. On a white band (`bg-surface-raised`) with an ink top rule, between the grey CARE section and the night HATCH band. Phones read header, lead, then a two-up strip. Server-rendered and still: no motion markers, no `mfx-` ids.
- **Markers:** `id="trg-proof"`, `data-section="proof"` (`sectionMarker('proof')`; `HomeSectionId` gained `'proof'`), `data-testid="w01-proof"`. `tooling/site-qa/config.json` `fallbackSections` gained `proof` (`#trg-proof`). The stale `marquee` entry was removed: PS-014 replaced `MarqueeBand` with `SignageBoard`, and no `MarqueeBand` or `✦` remains in `apps/web` or `packages/ui`.
- **Copy** (`voice: "ui"`, COPY_DECK rules: sentence case, no exclamation marks, no banned words, no pronoun for a Mon, Caller never Callah):
  - Eyebrow: "Inside NYC-MON"
  - H2: "The work so far."
  - Body: "NYC-MON isn't out yet. These are pieces from the build, each marked for what it is: a render, concept art or a design artifact."
  - Note: "Stand-in art and models hold the place of final work. Dates show when each piece last changed."
  - Strip list name (screen readers): "More from the build"
- **Kind marks:** the shape tells the kinds apart, so colour is not the only cue. Render: an ink square. Concept art: an orange-700 dot. Prototype: a leaf-700 diamond. Design artifact: a royal-700 outlined square. The status label is always printed in text next to the mark.

## 3. Data contract (`proof.ts`)

```ts
type ProofKind = 'render' | 'concept-art' | 'prototype' | 'design-artifact'; // no testimonial/quote kind exists
type ProofRightsStatus = 'owned' | 'generated' | 'licensed' | 'unknown';
type ProofAsset =
  | { type: 'image'; src; width; height; blurDataURL?; ground: 'ink' | 'paper' }
  | { type: 'specimen'; specimen: 'district-colors' }; // drawn from live tokens
interface ProofItem {
  id: string;
  kind: ProofKind;
  title: string;
  caption: string;          // short, factual, no digits
  asset: ProofAsset;
  alt: string;              // required, no pronoun for a Mon
  status: string;           // visitor-facing label; must start with PROOF_KIND_LABEL[kind]
  source: { path: string; committed: string }; // repo path + `git log -1 --format=%cs -- <path>`
  rights: { status: ProofRightsStatus; note: string };
  approvedForPublic: boolean;
  approvalRef?: string;     // decision id; required when approved
}
```

- `publicProof(items)` keeps the items that pass `proofProblem()`: approved, with an approval reference, rights not `unknown`, alt present, a status that names the kind, no digits in title or caption, and a `YYYY-MM-DD` date. It keeps them in register order and caps them at `PROOF_MAX_ITEMS` (5). The first item is the lead.
- **Empty state:** if `publicProof()` returns nothing, `ProofSection` returns `null`. The section is not rendered: no heading, no placeholder, no "coming soon". With one item, only the lead and the note render.
- **The only date printed** is `source.committed`, the last commit date of the file. `proof.test.ts` checks that the date is a real commit date of that path (`git log --format=%cs -- <path>`), and that the path exists. The repo was unshallowed (`git fetch --unshallow`) before reading the dates. In the shallow clone, `packages/ui/district/tones.ts` resolved to the graft commit instead.
- **Tests** (`node --test components/home/proof.test.ts`, 12 tests): every candidate passes the gate, and 3 to 5 show. Ids are unique. No testimonial, quote, review or press kind exists. Every shown item has alt text and a status that names its kind. Titles, captions and statuses contain no digits, quotation marks, social-proof words or exclamation marks. COPY_DECK banned words and Mon pronouns are absent. Generated art is always `concept-art` and says "generated". Unapproved items, unknown rights, a missing approval ref, a status without the kind and a numeric caption are each rejected. An empty registry gives empty output. The strip is capped. Source paths and dates match git. The date format is fixed.

## 4. Rights register

| # | id | Path (source) | Kind / status label | Last commit | Rights | Holder and terms | Public? (ref) |
|---|---|---|---|---|---|---|---|
| 1 (lead) | `hlynk-core-render` | `apps/web/public/home/h-lynk-core-v2.png`, rendered from `apps/web/components/home/device-scene.ts` (procedural placeholder model, three.js) | Render / "Render, stand-in model" | 2026-10-08 (`b3e2446`) | owned | Made in this repo. Already public on `/` as the H-Lynk stage capture | yes (PS-017) |
| 2 | `district-colors` | `packages/ui/district/tones.ts` (`DISTRICT_TONES`, `TONE_CLASSES`), drawn live, not an image | Design artifact / "Design artifact, in use on this site" | 2026-10-04 (`12bb669`) | owned | NYC-Tron tokens, written in this repo. The signage board uses the main tones | yes (PS-014) |
| 3 | `metro-egg` | `packages/assets/creatures/metro-egg.webp` | Concept art / "Concept art, generated stand-in" | 2026-10-08 (`b3e2446`) | generated | Figma `generate_image`, model `gpt-image-2.5-sunburst`, 2026-10-07, at the creator's request. The tool's output terms apply | yes (PS-028) |
| 4 | `corner-egg` | `packages/assets/creatures/corner-egg.webp` | Concept art / "Concept art, generated stand-in" | 2026-10-08 (`b3e2446`) | generated | as #3 | yes (PS-028) |
| 5 | `prism-egg` | `packages/assets/creatures/prism-egg.webp` | Concept art / "Concept art, generated stand-in" | 2026-10-08 (`b3e2446`) | generated | as #3 | yes (PS-028) |

**Approval basis.** No approval was given specifically for this section. `approvedForPublic: true` rests on decisions under which each asset already ships publicly or was cleared for "a later section". PS-017 covers the H-Lynk capture on `/`. PS-014 covers the district tones on the signage board. PS-028 bundled the three eggs "for the egg-choice screen (M08) or a later section". **Mike should confirm before release**, especially for the generated eggs. To pull any item, set its `approvedForPublic` to `false`. Pulling all of them removes the section.

### Considered and left out

| Candidate | Why it is not on the page |
|---|---|
| `h-lynk-scanner.png`, `h-lynk-controls.png` | Crops of item #1, already shown in the H-Lynk proof rows |
| Starter Baby concept art (`squeaklet`, `kittee-cee`, `yotito`) and `hatch-night` | Already the STARTERS posters and the HATCH band. Repeating them adds no new evidence |
| Native Phase 1 loop (`apps/mobile`) | **No screenshot or recording exists** in `docs/` or anywhere in the repo (only app icons and the splash icon). A `prototype` item needs a real capture from a build, committed with its date |
| Storybook | Exists in `packages/ui/*.stories.tsx` (114 stories), but no captured image is committed. It could become a `design-artifact` item once a capture is committed |
| `docs/design/screens/*` | Markdown specs only, with no images |
| NYC photos (`@acme/assets/photos`) | Licensed Wikimedia Commons work by third parties (credits in `packages/ui/THIRD-PARTY-NOTICES.md`). They are not the team's craft, so they cannot be proof of it |
| Brand badge and wordmark (`packages/assets/brand`) | Already in the header and footer. Provenance is not recorded in the repo |

## 5. What a future verified-quote section would need

Nothing here should be reused to show quotes until all of the following exist. Quotes would also need a separate HANDOFF decision that lifts the "no social proof" rule.

1. **A real source:** a named person or publication, and the medium (email, interview, article, playtest session), with the original kept on file (a link, or an archived copy for private sources).
2. **Consented attribution:** written consent to quote, which records how the person is named (full name, first name, handle or anonymous) and whether a photo may appear. For anyone under 18, parental or guardian consent, and no photo or full name (COPY_DECK age rules, the ICO Children's Code).
3. **A date:** when it was said. The page prints that date.
4. **Exact wording:** verbatim, with any cut marked by an ellipsis. No paraphrase presented inside quotation marks.
5. **Usage approval:** a decision id (`PS-0xx`) that clears the quote for public use, with scope (which pages) and expiry or review date. A way to withdraw it, and a record that it was withdrawn.
6. **Context honesty:** the build or version the person saw (for example, "playtest of the Phase 1 build"). No implied endorsement beyond what was said, and no counts unless they come from a stated, dated measurement.

A contract for that would add a separate type, not a new `ProofKind`, for example `VerifiedQuote { id; text; attribution: { name; displayAs; minor: boolean }; saidOn; source: { medium; url?; archivedAt }; consent: { given: boolean; recordRef; date }; approvalRef; scope; reviewBy }`. It would have its own tests: no quote without consent, without a date or without an approval reference.
