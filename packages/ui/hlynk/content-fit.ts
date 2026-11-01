/**
 * Fit a step's content inside the H-Lynk screen without scrolling (Decision
 * H-3, docs/design/hlynk/ADAPTIVE.md). Nothing inside the H-Lynk screen
 * scrolls: the media (ring, egg, illustration) shrinks first, down to its
 * floor; then the type ramp steps down within the kit's tokens and spacing
 * compresses, one step at a time, to the minimum step. The title is a block
 * like any other, so it is always laid out in full. If even the minimum step
 * cannot fit, `fits` is false and the caller reports the window size as a
 * layout finding instead of scrolling.
 *
 * Heights are estimates (average glyph width per em, wrapped lines times the
 * token line height, times the OS font scale). Screens pair this with a
 * measured check (`useFitOverflow` in the screen) that steps down further if
 * the real layout still overflows. Pure: node-testable.
 */

/** A type ramp step the fit may choose: the class to apply plus its metrics in pt. */
export interface FitTypeStep {
  className: string;
  sizePt: number;
  lineHeightPt: number;
}

/** One rung of the fit ladder: four text roles plus padding and gap. */
export interface FitStep {
  title: FitTypeStep;
  body: FitTypeStep;
  strong: FitTypeStep;
  padPt: number;
  gapPt: number;
}

/** Ladder index: 0 is the authored layout, 2 the tightest the kit allows. */
export type FitStepIndex = 0 | 1 | 2;

type Ladder = readonly [FitStep, FitStep, FitStep];

const t = (className: string, sizePt: number, lineHeightPt: number): FitTypeStep => ({ className, sizePt, lineHeightPt });

/**
 * Ladders from `typeRamp` and `xrTypeRamp` (@acme/theme tokens.ts) and the
 * 4 pt spacing scale. The title never drops below a 17 pt (mobile) or 16 pt
 * (headset) bold step, and body never below `type-caption`, the kit's floor
 * ("nothing is set smaller").
 */
export const HLYNK_FIT_LADDERS: { mobile: Ladder; xr: Ladder } = {
  mobile: [
    { title: t('text-type-title', 24, 30), body: t('text-type-body', 17, 24), strong: t('text-type-body-strong', 17, 24), padPt: 16, gapPt: 12 },
    { title: t('text-type-body-strong', 17, 24), body: t('text-type-label', 15, 20), strong: t('text-type-label font-semibold', 15, 20), padPt: 12, gapPt: 8 },
    { title: t('text-type-body-strong', 17, 24), body: t('text-type-caption', 13, 18), strong: t('text-type-caption font-semibold', 13, 18), padPt: 8, gapPt: 4 },
  ],
  xr: [
    { title: t('text-xr-title', 26, 32), body: t('text-xr-body', 18, 28), strong: t('text-xr-body font-semibold', 18, 28), padPt: 16, gapPt: 12 },
    { title: t('text-xr-body font-bold', 18, 28), body: t('text-xr-label', 16, 22), strong: t('text-xr-label font-semibold', 16, 22), padPt: 12, gapPt: 8 },
    { title: t('text-xr-label font-bold', 16, 22), body: t('text-xr-caption', 14, 20), strong: t('text-xr-caption font-semibold', 14, 20), padPt: 8, gapPt: 4 },
  ],
};

/** Average advance per em for the kit's sans at these weights; a little wide on purpose. */
const EM_ADVANCE = { title: 0.6, body: 0.56, strong: 0.58 } as const;
/** Button label line height (type-label / xr-label) and the vertical face padding per size, rem-16 web worst case. */
const CONTROL = { labelLhPt: { mobile: 20, xr: 22 }, padYPt: { sm: 10, md: 14, lg: 20 }, minPt: 48 } as const;
/** Gap between a title and the line under it (`gap-1`). */
const TIGHT_GAP_PT = 4;

export type FitBlock =
  /** Wrapped copy in one of the ladder's roles. `tight`: 4 pt above it instead of the step gap. */
  | { kind: 'text'; role: 'title' | 'body' | 'strong'; chars: number; tight?: boolean }
  /** A kit Button row: `count` buttons of `size`, wrapping when the row is narrower than `minRowWidthPt`. */
  | { kind: 'controls'; size: 'sm' | 'md' | 'lg'; minRowWidthPt?: number }
  /** A block whose height does not follow the ladder (rows that own their own type). */
  | { kind: 'fixed'; heightPt: number }
  /** The one flexible square: ring, case, illustration. */
  | { kind: 'media'; minPt: number; maxPt: number };

export interface FitInput {
  /** The screen's content area in pt, bezel and status row already excluded. */
  widthPt: number;
  heightPt: number;
  fontScale: number;
  ramp: 'mobile' | 'xr';
  /** Top to bottom. At most one `media` block. */
  blocks: readonly FitBlock[];
  /**
   * `stack`: one column. `side`: the media in a trailing column exactly its
   * own width, everything else in the leading column, `FIT_SIDE_GAP_PT` apart.
   */
  arrangement: 'stack' | 'side';
  /** Start the ladder here (a measured overflow raises it). @default 0 */
  minStep?: FitStepIndex;
}

export interface FitResult {
  step: FitStepIndex;
  type: FitStep;
  /** Side of the media square, 0 when there is no media block. */
  mediaPt: number;
  /** Estimated content height including padding: the taller column in `side`. */
  contentPt: number;
  fits: boolean;
}

/** Gap between the two columns of the `side` arrangement (`gap-6`). */
export const FIT_SIDE_GAP_PT = 24;

function textHeight(block: Extract<FitBlock, { kind: 'text' }>, step: FitStep, widthPt: number, fontScale: number): number {
  const type = step[block.role];
  const perLine = Math.max(1, Math.floor(widthPt / (type.sizePt * EM_ADVANCE[block.role] * fontScale)));
  const lines = Math.max(1, Math.ceil(block.chars / perLine));
  return Math.ceil(lines * type.lineHeightPt * fontScale);
}

function controlHeight(block: Extract<FitBlock, { kind: 'controls' }>, ramp: 'mobile' | 'xr', widthPt: number, fontScale: number): number {
  const row = Math.max(CONTROL.minPt, Math.ceil(CONTROL.labelLhPt[ramp] * fontScale + CONTROL.padYPt[block.size] * 2));
  const rows = block.minRowWidthPt !== undefined && widthPt < block.minRowWidthPt ? 2 : 1;
  // Wrapped rows sit `target-gap` (12) apart.
  return row * rows + (rows - 1) * 12;
}

/** Height of a column of blocks (no padding), with the media block counted as `mediaPt`. */
function columnHeight(blocks: readonly FitBlock[], step: FitStep, input: FitInput, widthPt: number, mediaPt: number): number {
  let total = 0;
  blocks.forEach((block, i) => {
    if (i > 0) total += block.kind === 'text' && block.tight ? TIGHT_GAP_PT : step.gapPt;
    switch (block.kind) {
      case 'text':
        total += textHeight(block, step, widthPt, input.fontScale);
        break;
      case 'controls':
        total += controlHeight(block, input.ramp, widthPt, input.fontScale);
        break;
      case 'fixed':
        total += block.heightPt;
        break;
      case 'media':
        total += mediaPt;
        break;
    }
  });
  return total;
}

function tryStep(input: FitInput, index: FitStepIndex): FitResult {
  const step = HLYNK_FIT_LADDERS[input.ramp][index];
  const media = input.blocks.find((b): b is Extract<FitBlock, { kind: 'media' }> => b.kind === 'media');
  const innerW = Math.max(0, input.widthPt - step.padPt * 2);
  const innerH = Math.max(0, input.heightPt - step.padPt * 2);

  if (input.arrangement === 'side' && media) {
    // The media column is exactly as wide as the media; the leading column
    // takes the rest. Shrink the media in 16 pt steps while the leading
    // column is too tall, since a wider column wraps fewer lines.
    const lead = input.blocks.filter((b) => b.kind !== 'media');
    let mediaPt = Math.floor(Math.min(media.maxPt, innerH, (innerW - FIT_SIDE_GAP_PT) / 2));
    let leadH = columnHeight(lead, step, input, Math.max(0, innerW - FIT_SIDE_GAP_PT - mediaPt), 0);
    while (leadH > innerH && mediaPt > media.minPt) {
      mediaPt = Math.max(media.minPt, mediaPt - 16);
      leadH = columnHeight(lead, step, input, Math.max(0, innerW - FIT_SIDE_GAP_PT - mediaPt), 0);
    }
    const contentPt = Math.max(leadH, mediaPt) + step.padPt * 2;
    return { step: index, type: step, mediaPt, contentPt, fits: leadH <= innerH && mediaPt >= media.minPt };
  }

  const fixedH = columnHeight(input.blocks, step, input, innerW, 0);
  if (!media) {
    const contentPt = fixedH + step.padPt * 2;
    return { step: index, type: step, mediaPt: 0, contentPt, fits: contentPt <= input.heightPt };
  }
  const mediaPt = Math.floor(Math.max(0, Math.min(media.maxPt, innerW, innerH - fixedH)));
  const shown = Math.max(mediaPt, media.minPt);
  const contentPt = fixedH + shown + step.padPt * 2;
  return { step: index, type: step, mediaPt: shown, contentPt, fits: mediaPt >= media.minPt && contentPt <= input.heightPt };
}

/**
 * The largest ladder step at which the blocks fit, media shrinking first.
 * When nothing fits, the minimum step with media at its floor and
 * `fits: false`.
 */
export function fitHLynkContent(input: FitInput): FitResult {
  const start = input.minStep ?? 0;
  let last: FitResult | null = null;
  for (let i = start; i <= 2; i += 1) {
    last = tryStep(input, i as FitStepIndex);
    if (last.fits) return last;
  }
  return last ?? tryStep(input, 2);
}
