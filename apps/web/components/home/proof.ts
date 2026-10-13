/**
 * Proof of craft (W01 PROOF): the public record of what NYC-MON has actually
 * made, in place of testimonials. There are no reviews, quotes, press, player
 * counts or playtest results to show (canon-guardian, 2026-10-12), and the
 * HANDOFF bans social proof and counts on `/`. So this section shows only
 * artifacts that exist in the repo, each labelled for what it is.
 *
 * Contract (docs/design/site/PROOF_OF_CRAFT.md):
 * - `kind` says what the visitor is looking at; `status` is the label printed
 *   on the page, and it starts with the kind's name ("Concept art, ...").
 * - `source.path` is the file the artifact lives in, and `source.committed` is
 *   that file's last commit date (`git log -1 --format=%cs -- <path>`). It is
 *   the only date the page prints. The unit test checks it against git.
 * - `rights` records who holds the picture and on what terms; `approvedForPublic`
 *   is the gate. Only approved items render, and with none the section is not
 *   rendered at all (no placeholder, no "coming soon").
 * - Captions state facts about the artifact: no numbers, no counts, no quotes,
 *   no claims about players.
 */
import { creatureArt } from '@acme/assets/creatures';
import type { PhotoSource } from '@acme/assets/photos';
import { art } from './art.ts';

/** What the artifact is. There is deliberately no kind for a quote or a testimonial. */
export type ProofKind = 'render' | 'concept-art' | 'prototype' | 'design-artifact';

/** The visitor-facing name of each kind; every `status` label starts with it. */
export const PROOF_KIND_LABEL = {
  render: 'Render',
  'concept-art': 'Concept art',
  prototype: 'Prototype',
  'design-artifact': 'Design artifact',
} as const satisfies Record<ProofKind, string>;

/**
 * Who holds the picture. `owned`: made by the team in this repo. `generated`:
 * made with a generative tool at the creator's request; the tool's output
 * terms apply. `licensed`: third-party work under a licence named in `rights.note`.
 * `unknown` never renders.
 */
export type ProofRightsStatus = 'owned' | 'generated' | 'licensed' | 'unknown';

export interface ProofRights {
  status: ProofRightsStatus;
  /** Who made it and on what terms, for the rights register. Not shown on the page. */
  note: string;
}

/** A bundled or public image. `ground` is the colour the art was made on, so the frame matches it. */
export interface ProofImage {
  type: 'image';
  src: PhotoSource;
  width: number;
  height: number;
  blurDataURL?: string;
  ground: 'ink' | 'paper';
}

/**
 * A specimen drawn from the live design tokens instead of a picture of them,
 * so it can never drift from the system it shows.
 */
export interface ProofSpecimen {
  type: 'specimen';
  specimen: 'district-colors';
}

export type ProofAsset = ProofImage | ProofSpecimen;

export interface ProofSource {
  /** Repo-relative path of the file the artifact lives in. */
  path: string;
  /** That file's last commit date, YYYY-MM-DD. */
  committed: string;
}

export interface ProofItem {
  id: string;
  kind: ProofKind;
  title: string;
  /** One or two short factual sentences. No numbers. */
  caption: string;
  asset: ProofAsset;
  /** Describes the picture for screen readers. No pronoun for a Mon (PS-005). */
  alt: string;
  /** The label the visitor sees, e.g. "Concept art, generated stand-in". */
  status: string;
  source: ProofSource;
  rights: ProofRights;
  approvedForPublic: boolean;
  /** The decision that cleared it for the public page. Required when approved. */
  approvalRef?: string;
}

/** The section shows a lead artifact and a strip; more than this stops reading as a strip. */
export const PROOF_MAX_ITEMS = 5;

const GENERATED_RIGHTS: ProofRights = {
  status: 'generated',
  note: 'Generated with Figma generate_image (gpt-image-2.5-sunburst) on 2026-10-07 at the creator\'s request (PS-028). The tool\'s output terms apply. Concept stand-in until final renders (PS-007).',
};

function eggImage(id: 'metro-egg' | 'corner-egg' | 'prism-egg'): Pick<ProofItem, 'asset' | 'alt'> {
  const a = creatureArt(id);
  return {
    asset: { type: 'image', src: a.source, width: a.width, height: a.height, blurDataURL: a.blurDataURL, ground: 'paper' },
    alt: a.alt,
  };
}

const hlynk = art('hlynk.static');

/**
 * Every candidate, in page order: the first is the lead frame, the rest are
 * the strip, oldest commit first. Unapproved items stay listed here with the
 * reason, so the register and the page cannot disagree.
 */
export const PROOF_ITEMS: readonly ProofItem[] = [
  {
    id: 'hlynk-core-render',
    kind: 'render',
    title: 'H-Lynk Core',
    caption: 'A still from the live scene that draws the H-Lynk Core on this page. The model is built in code from simple shapes.',
    asset: { type: 'image', src: hlynk.src, width: hlynk.width, height: hlynk.height, ground: 'ink' },
    alt: 'The H-Lynk Core at a three-quarter turn on a dark ground: a matte red body, a black scanner head with a red light rising from it, a screen reading Squeaklet, and a row of black keys around a square trackpad',
    status: 'Render, stand-in model',
    source: { path: 'apps/web/public/home/h-lynk-core-v2.png', committed: '2026-10-08' },
    rights: { status: 'owned', note: 'Rendered from apps/web/components/home/device-scene.ts (procedural placeholder model, three.js) in this repo.' },
    approvedForPublic: true,
    approvalRef: 'PS-017',
  },
  {
    id: 'district-colors',
    kind: 'design-artifact',
    title: 'District colors',
    caption: 'Each district has a main color and an accent. The signage board on this page uses the main one.',
    asset: { type: 'specimen', specimen: 'district-colors' },
    alt: 'District color pairs: Harlem brick with apple red, Midtown orange with royal blue, Downtown royal blue with carolina blue, Mega City carolina blue with royal blue',
    status: 'Design artifact, in use on this site',
    source: { path: 'packages/ui/district/tones.ts', committed: '2026-10-04' },
    rights: { status: 'owned', note: 'NYC-Tron design tokens, written in this repo (@acme/ui, @acme/theme).' },
    approvedForPublic: true,
    approvalRef: 'PS-014',
  },
  {
    id: 'metro-egg',
    kind: 'concept-art',
    title: 'Metro Egg',
    caption: 'Glossy red with white stripes and a gold inset. Squeaklet hatches from it.',
    ...eggImage('metro-egg'),
    status: 'Concept art, generated stand-in',
    source: { path: 'packages/assets/creatures/metro-egg.webp', committed: '2026-10-08' },
    rights: GENERATED_RIGHTS,
    approvedForPublic: true,
    approvalRef: 'PS-028',
  },
  {
    id: 'corner-egg',
    kind: 'concept-art',
    title: 'Corner Egg',
    caption: 'Glossy pink in a band of white fur. Kittee Cee hatches from it.',
    ...eggImage('corner-egg'),
    status: 'Concept art, generated stand-in',
    source: { path: 'packages/assets/creatures/corner-egg.webp', committed: '2026-10-08' },
    rights: GENERATED_RIGHTS,
    approvedForPublic: true,
    approvalRef: 'PS-028',
  },
  {
    id: 'prism-egg',
    kind: 'concept-art',
    title: 'Prism Egg',
    caption: 'Glossy black with painted flames and a crystal inset. Yotito hatches from it.',
    ...eggImage('prism-egg'),
    status: 'Concept art, generated stand-in',
    source: { path: 'packages/assets/creatures/prism-egg.webp', committed: '2026-10-08' },
    rights: GENERATED_RIGHTS,
    approvedForPublic: true,
    approvalRef: 'PS-028',
  },
];

/** Why an item may not render, or null when it may. */
export function proofProblem(item: ProofItem): string | null {
  if (!item.approvedForPublic) return 'not approved for public';
  if (!item.approvalRef?.trim()) return 'approved without a decision reference';
  if (item.rights.status === 'unknown') return 'rights unknown';
  if (!item.alt.trim()) return 'no alt text';
  if (!item.status.startsWith(PROOF_KIND_LABEL[item.kind])) return 'status label does not name the kind';
  if (/\d/.test(item.caption) || /\d/.test(item.title)) return 'number in title or caption';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.source.committed)) return 'commit date is not YYYY-MM-DD';
  return null;
}

/**
 * What the page may show: approved, valid items in registry order, capped at
 * `PROOF_MAX_ITEMS`. An empty result means the section is not rendered.
 */
export function publicProof(items: readonly ProofItem[] = PROOF_ITEMS): ProofItem[] {
  return items.filter((item) => proofProblem(item) === null).slice(0, PROOF_MAX_ITEMS);
}

/** "Oct 8, 2026" from "2026-10-08", in UTC so the server and the reader agree. */
export function proofDateLabel(committed: string): string {
  return new Date(`${committed}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
