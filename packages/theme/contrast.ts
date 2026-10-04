/**
 * WCAG 2.2 contrast for the NYC-MON palette (BUILD_PROMPT_v3 §0B Law 10, §1.3).
 *
 * Pure TypeScript, no dependencies. Colours are never written here as hex:
 * every pair names Tailwind colour tokens (`orange-500`, `text-muted`,
 * `primary/15`) and resolves them through tokens.ts, so the table re-measures
 * itself when a token changes. `contrast.test.ts` fails on any pair used as
 * text or UI that measures under its threshold; docs/design/CONTRAST.md is
 * the human-readable copy of the same registry.
 */
import { brand, hlynk, led, palette, semantic } from './tokens.ts';

// ---- math -------------------------------------------------------------------

export type Rgba = readonly [r: number, g: number, b: number, a: number];

/** `#RGB`, `#RRGGBB` or `#RRGGBBAA` to 0-1 channels. */
export function parseHex(hex: string): Rgba {
  const h = hex.replace(/^#/, '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) throw new Error(`not a hex colour: ${hex}`);
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), full.length === 8 ? n(6) : 1];
}

export function toHex([r, g, b]: Rgba): string {
  const c = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Source-over: `top` (with its alpha) painted on an opaque `bottom`. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];
  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
    1,
  ];
}

/** WCAG 2.2 relative luminance (sRGB, 0.04045 linearisation threshold). */
export function relativeLuminance(c: Rgba | string): number {
  const [r, g, b] = typeof c === 'string' ? parseHex(c) : c;
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** (L1 + 0.05) / (L2 + 0.05), lighter over darker. A translucent fg is composited on bg first. */
export function contrastRatio(fg: Rgba | string, bg: Rgba | string): number {
  const b = typeof bg === 'string' ? parseHex(bg) : bg;
  let f = typeof fg === 'string' ? parseHex(fg) : fg;
  if (f[3] < 1) f = composite(f, b);
  const [hi, lo] = [relativeLuminance(f), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// ---- token resolution -------------------------------------------------------

export type Mode = 'light' | 'dark';

const SEMANTIC = semantic as Record<string, { light: string; dark: string }>;
const FAMILIES = palette as unknown as Record<string, Record<string, string> | string>;

/** True when the name is a light/dark semantic token (its hex depends on the theme). */
export function isSemantic(name: string): boolean {
  return name.split('/')[0]! in SEMANTIC;
}

const LED = led as Record<string, string>;
const HLYNK = hlynk as Record<string, Record<string, string>>;

/**
 * A Tailwind colour name to RGBA: `primary`, `text-muted`, `orange-500`,
 * `concrete-50`, `signage-black`, `white`, `night`, each with an optional
 * `/NN` opacity modifier. The H-Lynk groups resolve as `led-<key>` and
 * `hlynk-<tier>-<key>` (`led-on`, `hlynk-core-body`); they are not Tailwind
 * classes, only names for the registry.
 */
export function resolveToken(name: string, mode: Mode): Rgba {
  const [base, alpha] = name.split('/') as [string, string | undefined];
  let hex: string | undefined;
  if (base in SEMANTIC) hex = SEMANTIC[base]![mode];
  else if (base === 'night') hex = brand.night;
  else if (base === 'white') hex = palette.white;
  else if (base.startsWith('led-')) hex = LED[base.slice(4)];
  else if (base.startsWith('hlynk-')) {
    const [, tier, ...rest] = base.split('-') as [string, string, ...string[]];
    const key = rest.map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1))).join('');
    hex = HLYNK[tier]?.[key];
  } else {
    const m = /^([a-z]+)-([a-z0-9]+)$/.exec(base);
    const fam = m ? FAMILIES[m[1]!] : undefined;
    if (fam && typeof fam === 'object') hex = fam[m![2]!];
  }
  if (!hex) throw new Error(`unknown colour token: ${name}`);
  const c = parseHex(hex);
  return alpha === undefined ? c : [c[0], c[1], c[2], c[3] * (Number(alpha) / 100)];
}

/** Paint background layers bottom-up into one opaque colour. The first layer must be opaque. */
export function flatten(layers: readonly string[], mode: Mode): Rgba {
  let out = resolveToken(layers[0]!, mode);
  if (out[3] < 1) throw new Error(`bottom layer must be opaque: ${layers[0]}`);
  for (const l of layers.slice(1)) out = composite(resolveToken(l, mode), out);
  return out;
}

// ---- the registry -----------------------------------------------------------

/**
 * - text: body text, 4.5:1 (SC 1.4.3).
 * - large-text: >= 24px, or >= 18.66px bold, 3:1 (SC 1.4.3).
 * - ui: component boundaries, state indicators, icons and chart marks needed
 *   to understand the content, 3:1 (SC 1.4.11).
 * - decorative: carries no information; exempt, `reason` required.
 * - disabled: inactive component; exempt by SC 1.4.3/1.4.11, `reason` required.
 */
export type Role = 'text' | 'large-text' | 'ui' | 'decorative' | 'disabled';

export const THRESHOLD: Record<Role, number> = {
  text: 4.5,
  'large-text': 3,
  ui: 3,
  decorative: 0,
  disabled: 0,
};

export interface Pair {
  id: string;
  /** Foreground token; may carry `/NN`. */
  fg: string;
  /** Background layers, bottom first. A single opaque token is the common case. */
  bg: readonly string[];
  role: Role;
  /** file:line of each real usage (repo-relative). Empty only for token-contract rows. */
  usedAt: readonly string[];
  /** Required for decorative and disabled rows; optional context otherwise. */
  reason?: string;
}

export interface Measurement {
  pair: Pair;
  /** `both` when every token is mode-invariant (palette steps). */
  mode: Mode | 'both';
  fgHex: string;
  bgHex: string;
  ratio: number;
  threshold: number;
  pass: boolean;
}

const SURFACES = ['bg', 'surface', 'surface-raised', 'surface-sunken'] as const;
const NIGHT = ['ink-950'] as const;

/** The themed tone text tokens (ghost labels, slider counter): tone-<tone>-text. */
const TONE_TEXT = ['orange', 'royal', 'carolina', 'leaf', 'apple', 'brick'].map((t) => `tone-${t}-text`);
/** Each tone's hover tint, as TONE_CLASSES[tone].soft paints it behind a ghost label. */
const TONE_SOFT: Record<string, string> = {
  orange: 'orange-500/15', royal: 'royal-500/15', carolina: 'carolina-500/15', leaf: 'leaf-500/15', apple: 'apple-500/15', brick: 'orange-800/25',
};
const TONE_TEXT_LINE: Record<string, number> = { orange: 123, royal: 131, carolina: 138, leaf: 145, apple: 153, brick: 160 };

/** Token contract: every semantic text token on every surface, and every on-* on its fill. */
const CONTRACT: Pair[] = [
  ...(['text', 'text-muted', 'text-secondary', 'primary', 'accent', 'success', 'danger', 'info'] as const).flatMap((fg) =>
    SURFACES.map((s): Pair => ({ id: `contract:${fg}/${s}`, fg, bg: [s], role: 'text', usedAt: [] })),
  ),
  ...(
    [
      ['on-primary', 'primary'],
      ['on-primary', 'primary-pressed'],
      ['on-cta', 'cta'],
      ['on-cta', 'cta-pressed'],
      ['on-accent', 'accent'],
      ['on-accent', 'accent-pressed'],
      ['on-success', 'success'],
      ['on-danger', 'danger'],
      ['on-info', 'info'],
      ['text-inverse', 'text'],
    ] as const
  ).map(([fg, bg]): Pair => ({ id: `contract:${fg}/${bg}`, fg, bg: [bg], role: 'text', usedAt: [] })),
  ...(TONE_TEXT).flatMap((fg) =>
    SURFACES.map((s): Pair => ({ id: `contract:${fg}/${s}`, fg, bg: [s], role: 'text', usedAt: [] })),
  ),
  ...(['focus', 'border-strong', 'structure'] as const).flatMap((fg) =>
    SURFACES.map((s): Pair => ({ id: `contract:${fg}/${s}`, fg, bg: [s], role: 'ui', usedAt: [] })),
  ),
];

/** Pairs as the kit and app actually draw them. */
const USAGE: Pair[] = [
  // -- semantic text on theme surfaces (themed: measured light and dark) ----
  { id: 'text on surface', fg: 'text', bg: ['surface'], role: 'text', usedAt: ['packages/ui/Text.tsx:39', 'packages/ui/Heading.tsx:25', 'apps/mobile/components/EventActionsSheet.tsx:54'] },
  { id: 'muted text on surface', fg: 'text-muted', bg: ['surface'], role: 'text', usedAt: ['packages/ui/Text.tsx:40', 'apps/mobile/components/AppTabBar.tsx:112', 'packages/app/features/schedule/BookingSurface.tsx:63'] },
  { id: 'muted text on raised', fg: 'text-muted', bg: ['surface-raised'], role: 'text', usedAt: ['apps/mobile/components/EventActionsSheet.tsx:50', 'packages/app/features/home/home-content.tsx:76', 'packages/ui/Text.tsx:40'] },
  { id: 'primary text on surface', fg: 'primary', bg: ['surface'], role: 'large-text', usedAt: ['packages/app/features/error/screen.shared.tsx:19'], reason: 'font-display text-display-xl (60px)' },
  { id: 'primary text on raised', fg: 'primary', bg: ['surface-raised'], role: 'text', usedAt: ['packages/ui/Text.tsx:42', 'packages/ui/Heading.tsx:27'] },
  { id: 'primary icon in primary/10 well', fg: 'primary', bg: ['surface-raised', 'primary/10'], role: 'ui', usedAt: ['packages/app/features/home/home.data.ts:28', 'packages/app/features/home/home.data.ts:33'] },
  { id: 'accent text on raised', fg: 'accent', bg: ['surface-raised'], role: 'text', usedAt: ['packages/ui/Text.tsx:41', 'packages/app/features/home/home-content.tsx:77', 'packages/app/features/editor/AttachSheet.tsx:88'] },
  { id: 'accent icon in accent/10 well', fg: 'accent', bg: ['surface-raised', 'accent/10'], role: 'ui', usedAt: ['packages/app/features/home/home.data.ts:29', 'packages/app/features/home/home.data.ts:34'] },
  { id: 'accent bell icon on raised', fg: 'accent', bg: ['surface-raised'], role: 'ui', usedAt: ['apps/mobile/components/AppHeader.tsx:70'] },
  { id: 'danger text on raised', fg: 'danger', bg: ['surface-raised'], role: 'text', usedAt: ['packages/ui/Text.tsx:44', 'packages/app/features/editor/AttachSheet.tsx:168', 'apps/mobile/components/EventActionsSheet.tsx:54'] },
  { id: 'danger text on danger/10 hover', fg: 'danger', bg: ['surface-raised', 'danger/10'], role: 'text', usedAt: ['apps/mobile/components/EventActionsSheet.tsx:44', 'apps/mobile/components/EventActionsSheet.tsx:54'] },
  { id: 'on-primary on primary', fg: 'on-primary', bg: ['primary'], role: 'text', usedAt: ['packages/app/features/home/home-content.tsx:48', 'packages/app/features/explore/explore.store.ts:17', 'apps/mobile/components/AppTabBar.tsx:111'] },
  { id: 'on-primary/90 on primary', fg: 'on-primary/90', bg: ['primary'], role: 'text', usedAt: ['packages/app/features/home/home-content.tsx:53', 'packages/app/features/home/home-content.tsx:54'] },
  { id: 'on-primary on primary-pressed', fg: 'on-primary', bg: ['primary-pressed'], role: 'text', usedAt: ['packages/app/features/explore/explore.store.ts:18', 'apps/mobile/components/AppTabBar.tsx:85'] },
  { id: 'on-accent on accent', fg: 'on-accent', bg: ['accent'], role: 'text', usedAt: ['packages/app/features/explore/explore.store.ts:19', 'apps/mobile/app/(drawer)/split/_layout.tsx:300'] },
  { id: 'inverse text on text', fg: 'text-inverse', bg: ['text'], role: 'text', usedAt: ['packages/ui/Text.tsx:43', 'packages/ui/Heading.tsx:29'] },
  { id: 'out-of-month day', fg: 'text-muted', bg: ['surface-raised'], role: 'text', usedAt: ['packages/app/features/schedule/MiniCalendar.tsx:111'], reason: 'days stay readable and pressable (onSelect); muted colour, not opacity, marks them as outside the month' },
  { id: 'past day', fg: 'text-muted', bg: ['surface-raised'], role: 'text', usedAt: ['packages/app/features/schedule/BookingSurface.tsx:74'], reason: 'past days still call selectDate (BookingSurface.tsx:58); the day strip sits in the bg-surface-raised panel (BookingSurface.tsx:48)' },
  { id: 'unavailable slot (muted/60)', fg: 'text-muted/60', bg: ['surface-sunken'], role: 'disabled', usedAt: ['packages/app/features/schedule/BookingSurface.tsx:107'], reason: 'accessibilityState disabled (BookingSurface.tsx:96)' },
  // The grid tab bar is a night facade in both themes (palette steps, no themed
  // tokens). The 95% bar is measured over a light page, its worst case.
  { id: 'grid tab label idle', fg: 'silver-300', bg: ['concrete-50', 'ink-950/95'], role: 'text', usedAt: ['apps/mobile/components/AppTabBar.tsx:97', 'apps/mobile/components/AppTabBar.tsx:109', 'apps/mobile/components/AppTabBar.tsx:128'], reason: 'bar is bg-ink-950/95 in both themes; measured over a light page' },
  { id: 'grid tab label active', fg: 'orange-400', bg: ['concrete-50', 'ink-950/95', 'orange-500/15'], role: 'text', usedAt: ['apps/mobile/components/AppTabBar.tsx:84', 'apps/mobile/components/AppTabBar.tsx:96', 'apps/mobile/components/AppTabBar.tsx:108'] },
  { id: 'grid tab selected edge', fg: 'orange-500/60', bg: ['concrete-50', 'ink-950/95', 'orange-500/15'], role: 'ui', usedAt: ['apps/mobile/components/AppTabBar.tsx:84'] },
  { id: 'grid rail label idle', fg: 'silver-300', bg: ['ink-950'], role: 'text', usedAt: ['apps/mobile/components/AppTabBar.tsx:109', 'apps/mobile/components/AppTabBar.tsx:145'] },
  { id: 'focus ring on offset band', fg: 'focus', bg: ['bg'], role: 'ui', usedAt: ['packages/ui/Button.tsx:23', 'packages/ui/IconButton.tsx:20', 'packages/ui/cards/NeonSwitch.tsx:19', 'packages/ui/cards/NeonCheckbox.tsx:13', 'packages/ui/cards/CardSlider.web.tsx:144'], reason: 'ring-offset-2 ring-offset-bg paints the page colour between the control and the ring' },
  { id: 'focus ring on night control', fg: 'focus', bg: ['ink-950'], role: 'ui', usedAt: ['packages/ui/SearchBar.tsx:26', 'packages/ui/SegmentedControl.web.tsx:16'], reason: 'no offset: the ring touches the night control face' },
  // The site header and footer are the kit NavBar and SiteFooter: night (ink-950) in both themes.
  { id: 'focus ring on site header', fg: 'focus', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/nav/NavBar.tsx:78', 'packages/ui/nav/NavBar.tsx:81', 'packages/ui/nav/NavBar.tsx:92', 'packages/ui/nav/NavBar.tsx:94', 'apps/web/components/site/SiteChrome.tsx:46'] },
  { id: 'focus ring on site footer', fg: 'focus', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/nav/SiteFooter.tsx:83'] },
  { id: 'focus ring on page', fg: 'focus', bg: ['bg'], role: 'ui', usedAt: ['packages/ui/dropdown.ts:15'] },
  { id: 'nav action edge', fg: 'orange-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/nav/NavBar.tsx:92', 'packages/ui/nav/NavBar.tsx:99'] },
  { id: 'profile ring active', fg: 'orange-500', bg: NIGHT, role: 'ui', usedAt: ['apps/web/components/site/SiteChrome.tsx:47'], reason: 'ring-offset-ink-950 puts the night bar between the avatar and the ring' },
  { id: 'profile ring hover', fg: 'silver-400', bg: NIGHT, role: 'ui', usedAt: ['apps/web/components/site/SiteChrome.tsx:47'] },
  { id: 'unread dot', fg: 'danger', bg: ['surface-raised'], role: 'ui', usedAt: ['apps/mobile/components/AppHeader.tsx:71'] },
  { id: 'theme border', fg: 'border', bg: ['surface-raised'], role: 'decorative', usedAt: ['apps/mobile/components/EventActionsSheet.tsx:42', 'apps/mobile/components/AppHeader.tsx:68'], reason: 'frame on controls whose text label or icon identifies them; separators' },
  { id: 'neon glow', fg: 'glow', bg: ['bg'], role: 'decorative', usedAt: ['packages/theme/tokens.ts:340', 'packages/ui/district/tones.ts:132'], reason: 'box-shadow halo behind a surface that already has its own edge; fully transparent on daylit (no glow in daylight)' },
  { id: 'hot glow', fg: 'glow-hot', bg: ['bg'], role: 'decorative', usedAt: ['packages/theme/tokens.ts:343', 'apps/mobile/components/AppTabBar.tsx:84'], reason: 'box-shadow halo behind a surface that already has its own edge; fully transparent on daylit (no glow in daylight)' },
  { id: 'structure rule /40', fg: 'structure/40', bg: ['bg'], role: 'decorative', usedAt: ['apps/mobile/components/AppTabBar.tsx:128'], reason: 'section rule; no information' },

  // -- tone text on the page (themed tone-*-text: night step dark, page step light)
  // Ghost Button / IconButton labels and the CardSlider counter sit straight on
  // the page. The hover tint row is measured over surface-sunken, the darkest
  // page surface, so it is the worst case for the 15% (brick 25%) tint.
  ...Object.keys(TONE_SOFT).flatMap((t): Pair[] => {
    const at = [`packages/ui/district/tones.ts:${TONE_TEXT_LINE[t]}`, 'packages/ui/Button.tsx:73', 'packages/ui/IconButton.tsx:79'];
    return [
      { id: `${t} ghost label on page`, fg: `tone-${t}-text`, bg: ['bg'], role: 'text', usedAt: [...at, 'packages/ui/cards/CardSlider.shared.tsx:33'] },
      { id: `${t} ghost label on hover tint`, fg: `tone-${t}-text`, bg: ['surface-sunken', TONE_SOFT[t]!], role: 'text', usedAt: [...at, 'packages/ui/Button.tsx:132'], reason: 'tint layer fades in on group-hover; measured on the sunken page surface' },
    ];
  }),
  { id: 'disabled ghost label on page', fg: 'ink-400', bg: ['concrete-50'], role: 'disabled', usedAt: ['packages/ui/Button.tsx:48', 'packages/ui/IconButton.tsx:79'], reason: 'inactive control: aria-disabled, no press handler' },
  // Validation and recorder errors sit under the field well on the page, not
  // on night: the themed danger (apple-600 daylit, apple-400 night).
  { id: 'field error message on page', fg: 'danger', bg: ['bg'], role: 'text', usedAt: ['packages/ui/cards/neon-field.ts:22', 'packages/ui/ErrorMessage.tsx:21', 'packages/ui/cards/NeonCheckbox.tsx:80', 'packages/ui/audio/VoiceRecorder.native.tsx:288'] },

  // -- TextField surface="daylit": raised face, text-muted edge, themed throughout
  { id: 'daylit field edge on page', fg: 'text-muted', bg: ['bg'], role: 'ui', usedAt: ['packages/ui/TextField.tsx:41'], reason: 'the 2px edge is the field boundary (SC 1.4.11)' },
  { id: 'daylit field edge on sunken', fg: 'text-muted', bg: ['surface-sunken'], role: 'ui', usedAt: ['packages/ui/TextField.tsx:41'] },
  { id: 'daylit field text', fg: 'text', bg: ['surface-raised'], role: 'text', usedAt: ['packages/ui/TextField.tsx:41'] },
  { id: 'daylit field placeholder', fg: 'text-muted', bg: ['surface-raised'], role: 'text', usedAt: ['packages/ui/TextField.tsx:42'] },
  { id: 'daylit field label', fg: 'text', bg: ['bg'], role: 'text', usedAt: ['packages/ui/TextField.tsx:39'] },
  { id: 'daylit field error edge', fg: 'danger', bg: ['bg'], role: 'ui', usedAt: ['packages/ui/TextField.tsx:46'] },
  { id: 'daylit field focus edge', fg: 'focus', bg: ['bg'], role: 'ui', usedAt: ['packages/ui/TextField.tsx:42'] },
  { id: 'field clear glyph (daylit)', fg: 'text-muted', bg: ['surface-raised'], role: 'ui', usedAt: ['packages/ui/TextField.tsx:118'] },
  { id: 'field clear glyph (well)', fg: 'silver-300', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/TextField.tsx:118'] },

  // -- SheetSurface scheme="system": the raised face follows the page scheme
  { id: 'system sheet title', fg: 'text', bg: ['surface-raised'], role: 'text', usedAt: ['packages/ui/BottomSheet.tsx:49'] },
  { id: 'system sheet close edge', fg: 'border-strong', bg: ['surface-raised'], role: 'ui', usedAt: ['packages/ui/BottomSheet.tsx:50'] },
  { id: 'system sheet close glyph', fg: 'text', bg: ['surface-raised'], role: 'ui', usedAt: ['packages/ui/BottomSheet.tsx:51'] },

  // -- Button variant="cta": orange-500 face in both schemes, on-cta label
  { id: 'cta button label', fg: 'on-cta', bg: ['cta'], role: 'text', usedAt: ['packages/ui/Button.tsx:117', 'packages/ui/control-look.ts:47'] },
  { id: 'cta keyline on daylit page', fg: 'orange-950', bg: ['concrete-50'], role: 'ui', usedAt: ['packages/ui/neon/frame-colors.ts:10'], reason: 'the face (orange-500) is 2.38:1 on concrete-50, so the night keyline is the boundary by day' },
  { id: 'cta face on night page', fg: 'orange-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/neon/frame-colors.ts:10'], reason: 'after dark the face itself is the boundary; its orange-950 keyline is not' },

  // -- Badge tone="neutral": the quiet status chip, themed (M05 pending badge)
  { id: 'neutral badge label', fg: 'text-secondary', bg: ['surface-sunken'], role: 'text', usedAt: ['packages/ui/Badge.tsx:100'] },
  { id: 'neutral badge edge', fg: 'border', bg: ['bg'], role: 'decorative', usedAt: ['packages/ui/Badge.tsx:98'], reason: 'status chip, not a control; its text identifies it' },

  // -- night facades (palette steps: mode-invariant) -------------------------
  { id: 'title on night', fg: 'ink-50', bg: NIGHT, role: 'text', usedAt: ['packages/ui/Card.tsx:48', 'packages/ui/cards/neon-field.ts:15', 'packages/ui/ToastCard.tsx:37'] },
  { id: 'white on night', fg: 'white', bg: NIGHT, role: 'text', usedAt: ['packages/ui/charts/StatCard.tsx:54', 'packages/ui/nav/NavBar.tsx:88', 'packages/ui/nav/SiteFooter.tsx:79'] },
  { id: 'table cell on stripe', fg: 'silver-100', bg: ['ink-900'], role: 'text', usedAt: ['packages/ui/DataTable.tsx:44', 'packages/ui/DataTable.tsx:53'] },
  { id: 'nav link on night', fg: 'silver-200', bg: NIGHT, role: 'text', usedAt: ['packages/ui/nav/NavBar.tsx:82', 'packages/ui/dropdown.ts:16'] },
  { id: 'nav link on hover', fg: 'silver-200', bg: ['ink-800'], role: 'text', usedAt: ['packages/ui/dropdown.ts:14', 'packages/ui/nav/NavBar.tsx:83'] },
  { id: 'body on night', fg: 'silver-300', bg: NIGHT, role: 'text', usedAt: ['packages/ui/Card.tsx:48', 'packages/ui/Dialog.tsx:49', 'packages/ui/TabBar.tsx:36'] },
  { id: 'table head on ink-900', fg: 'silver-300', bg: ['ink-900'], role: 'text', usedAt: ['packages/ui/DataTable.tsx:35', 'packages/ui/DataTable.tsx:38'] },
  { id: 'caption on night', fg: 'silver-400', bg: NIGHT, role: 'text', usedAt: ['packages/ui/DataTable.tsx:47', 'packages/ui/charts/StatCard.tsx:57', 'packages/ui/nav/SiteFooter.tsx:80'] },
  { id: 'pager text on ink-900', fg: 'silver-400', bg: ['ink-900'], role: 'text', usedAt: ['packages/ui/DataTable.tsx:51'] },
  { id: 'axis tick on night', fg: 'silver-500', bg: NIGHT, role: 'text', usedAt: ['packages/ui/charts/NeonBarChart.tsx:64', 'packages/ui/charts/NeonLineChart.tsx:78', 'packages/ui/nav/SiteFooter.tsx:88'] },
  { id: 'placeholder on field well', fg: 'silver-500', bg: NIGHT, role: 'text', usedAt: ['packages/ui/cards/neon-field.ts:16'] },
  { id: 'orange tone text on night', fg: 'orange-400', bg: NIGHT, role: 'text', usedAt: ['packages/ui/district/tones.ts:123', 'packages/ui/nav/SiteFooter.tsx:93', 'packages/ui/nav/NavBar.tsx:99'] },
  { id: 'royal tone text on night', fg: 'royal-300', bg: NIGHT, role: 'text', usedAt: ['packages/ui/district/tones.ts:131', 'packages/ui/nav/SiteFooter.tsx:94', 'packages/ui/nav/NavBar.tsx:100'] },
  { id: 'carolina tone text on night', fg: 'carolina-400', bg: NIGHT, role: 'text', usedAt: ['packages/ui/district/tones.ts:138', 'packages/ui/nav/SiteFooter.tsx:95', 'packages/ui/nav/NavBar.tsx:101'] },
  { id: 'leaf tone text on night', fg: 'leaf-400', bg: NIGHT, role: 'text', usedAt: ['packages/ui/district/tones.ts:145', 'packages/ui/charts/StatCard.tsx:72'] },
  { id: 'apple tone text on night', fg: 'apple-400', bg: NIGHT, role: 'text', usedAt: ['packages/ui/district/tones.ts:153', 'packages/ui/Menu.web.tsx:63', 'packages/ui/audio/PlayerShell.tsx:34'] },
  { id: 'brick tone text on night', fg: 'orange-300', bg: NIGHT, role: 'text', usedAt: ['packages/ui/district/tones.ts:160'] },
  { id: 'sort glyph carolina-300', fg: 'carolina-300', bg: ['ink-900'], role: 'ui', usedAt: ['packages/ui/DataTable.tsx:59'] },
  { id: 'sort glyph leaf-300', fg: 'leaf-300', bg: ['ink-900'], role: 'ui', usedAt: ['packages/ui/DataTable.tsx:60'] },
  { id: 'sort glyph apple-300', fg: 'apple-300', bg: ['ink-900'], role: 'ui', usedAt: ['packages/ui/DataTable.tsx:62'] },
  // Kit Card night faces (cornerCut, beam) in both themes. Screen content on
  // them uses themed classes (text-text, text-muted); the face carries
  // scheme-dark, whose theme.css block redeclares each token at its dark value,
  // so these rows measure those steps. Before that, Next settled the tokens at
  // :root and a light page painted text-text black on night (/profile Account
  // card, 1.06:1).
  { id: 'card themed heading on night face', fg: 'ink-50', bg: NIGHT, role: 'text', usedAt: ['packages/theme/theme.css:328', 'packages/app/features/profile/profile-content.tsx:100'], reason: 'text-text inside a cornerCut or beam Card resolves to ink-50 on the face' },
  { id: 'card themed muted on night face', fg: 'silver-500', bg: NIGHT, role: 'text', usedAt: ['packages/theme/theme.css:329', 'packages/theme/theme.css:330', 'packages/app/features/profile/profile-content.tsx:101'], reason: 'text-muted and text-secondary inside the Card face resolve to silver-500' },
  { id: 'card themed primary on night face', fg: 'orange-500', bg: NIGHT, role: 'text', usedAt: ['packages/theme/theme.css:332'] },
  { id: 'card themed accent on night face', fg: 'carolina-500', bg: NIGHT, role: 'text', usedAt: ['packages/theme/theme.css:338', 'packages/theme/theme.css:349'], reason: 'accent and info share carolina-500 on the face' },
  { id: 'card themed success on night face', fg: 'leaf-500', bg: NIGHT, role: 'text', usedAt: ['packages/theme/theme.css:345'] },
  { id: 'card themed danger on night face', fg: 'apple-400', bg: NIGHT, role: 'text', usedAt: ['packages/theme/theme.css:347'] },
  // The notch Card face is the tone in both themes; themed text on it takes the
  // tone's on-face step (NOTCH_ON_INK / NOTCH_ON_WHITE).
  { id: 'card themed text on orange notch', fg: 'ink-950', bg: ['orange-500'], role: 'text', usedAt: ['packages/ui/Card.tsx:34'] },
  { id: 'card themed text on carolina notch', fg: 'ink-950', bg: ['carolina-500'], role: 'text', usedAt: ['packages/ui/Card.tsx:34'] },
  { id: 'card themed text on leaf notch', fg: 'ink-950', bg: ['leaf-500'], role: 'text', usedAt: ['packages/ui/Card.tsx:34'] },
  { id: 'card themed text on apple notch', fg: 'ink-950', bg: ['apple-500'], role: 'text', usedAt: ['packages/ui/Card.tsx:34'] },
  { id: 'card themed text on white notch', fg: 'ink-950', bg: ['ink-50'], role: 'text', usedAt: ['packages/ui/Card.tsx:34'] },
  { id: 'card themed text on royal notch', fg: 'white', bg: ['royal-500'], role: 'text', usedAt: ['packages/ui/Card.tsx:36'] },
  { id: 'card themed text on brick notch', fg: 'white', bg: ['orange-800'], role: 'text', usedAt: ['packages/ui/Card.tsx:36'] },
  { id: 'home headline on ink panel', fg: 'orange-500', bg: ['ink-800'], role: 'large-text', usedAt: ['packages/spatial/SpatialScreen.tsx:106', 'packages/ui/neon/SolidPanel.tsx:42'], reason: 'Heading display-sm (30px web, 26px native at rem 14) on the SolidPanel tone="ink" face, which is night in both themes' },
  { id: 'orange eyebrow on glass card', fg: 'orange-500', bg: ['concrete-50', 'ink-950/85'], role: 'text', usedAt: ['packages/ui/future/GridCard.tsx:29', 'packages/ui/future/CircuitButton.tsx:49'], reason: 'measured over a light page, the worst case for the 85% night glass' },
  { id: 'carolina eyebrow on glass card', fg: 'carolina-500', bg: ['concrete-50', 'ink-950/85'], role: 'text', usedAt: ['packages/ui/future/GridCard.tsx:30', 'packages/ui/future/CircuitButton.tsx:50'], reason: 'measured over a light page, the worst case for the 85% night glass' },

  // -- labels on tone faces ---------------------------------------------------
  { id: 'night on orange face', fg: 'ink-950', bg: ['orange-500'], role: 'text', usedAt: ['packages/ui/district/tones.ts:123', 'packages/ui/dropdown.ts:19', 'packages/ui/nav/NavBar.tsx:85', 'packages/ui/nav/NavBar.tsx:185'] },
  { id: 'white on royal face', fg: 'white', bg: ['royal-500'], role: 'text', usedAt: ['packages/ui/district/tones.ts:131', 'packages/ui/dropdown.ts:25', 'packages/ui/DataTable.tsx:58', 'packages/app/features/schedule/accent-classes.ts:43'] },
  { id: 'banner white on royal face', fg: 'ink-50', bg: ['royal-500'], role: 'text', usedAt: ['packages/ui/district/tones.ts:131', 'packages/ui/future/CircuitButton.tsx:48'] },
  { id: 'night on carolina face', fg: 'ink-950', bg: ['carolina-500'], role: 'text', usedAt: ['packages/ui/district/tones.ts:138', 'packages/ui/future/CircuitButton.tsx:47'] },
  { id: 'night on leaf face', fg: 'ink-950', bg: ['leaf-500'], role: 'text', usedAt: ['packages/ui/district/tones.ts:145'] },
  { id: 'night on apple face', fg: 'ink-950', bg: ['apple-500'], role: 'text', usedAt: ['packages/ui/district/tones.ts:153', 'packages/ui/Badge.tsx:113', 'packages/ui/dropdown.ts:28', 'packages/ui/nav/NavBar.tsx:103'] },
  { id: 'white on brick face', fg: 'white', bg: ['orange-800'], role: 'text', usedAt: ['packages/ui/district/tones.ts:160', 'packages/ui/dropdown.ts:30'] },
  { id: 'banner white on brick face', fg: 'ink-50', bg: ['orange-800'], role: 'text', usedAt: ['packages/ui/district/tones.ts:160'] },
  { id: 'night on white face', fg: 'ink-950', bg: ['ink-50'], role: 'text', usedAt: ['packages/ui/district/tones.ts:167', 'packages/ui/Badge.tsx:113'] },
  { id: 'selected event: white on gold-700', fg: 'white', bg: ['gold-700'], role: 'text', usedAt: ['packages/app/features/schedule/accent-classes.ts:50', 'packages/app/features/schedule/accent-classes.ts:51'] },
  { id: 'selected event: white on forest-700', fg: 'white', bg: ['forest-700'], role: 'text', usedAt: ['packages/app/features/schedule/accent-classes.ts:58', 'packages/app/features/schedule/accent-classes.ts:59'] },
  { id: 'selected event: white on sky-700', fg: 'white', bg: ['sky-700'], role: 'text', usedAt: ['packages/app/features/schedule/accent-classes.ts:66', 'packages/app/features/schedule/accent-classes.ts:67'] },
  { id: 'selected event: white on rose-700', fg: 'white', bg: ['rose-700'], role: 'text', usedAt: ['packages/app/features/schedule/accent-classes.ts:74', 'packages/app/features/schedule/accent-classes.ts:75'] },

  // -- control edges, state marks and chart marks on night (SC 1.4.11) -------
  { id: 'orange field edge', fg: 'orange-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/tones.ts:124', 'packages/ui/cards/neon-field.ts:38'] },
  { id: 'royal field edge', fg: 'royal-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/tones.ts:132', 'packages/ui/cards/neon-field.ts:38'] },
  { id: 'carolina field edge', fg: 'carolina-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/tones.ts:139', 'packages/ui/cards/neon-field.ts:38'] },
  { id: 'leaf field edge', fg: 'leaf-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/tones.ts:146', 'packages/ui/cards/neon-field.ts:38'] },
  { id: 'apple field edge', fg: 'apple-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/tones.ts:154', 'packages/ui/cards/neon-field.ts:38'] },
  { id: 'brick field edge', fg: 'orange-700', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/tones.ts:161', 'packages/ui/control-look.ts:54'] },
  { id: 'switch off: track edge', fg: 'silver-600', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/cards/NeonSwitch.tsx:26'] },
  { id: 'switch off: thumb on track', fg: 'silver-400', bg: ['ink-900'], role: 'ui', usedAt: ['packages/ui/cards/NeonSwitch.tsx:26'] },
  // The on-thumb is a banner-white square in a 2px night keyline. On the bright
  // faces the keyline is the edge that reads; on royal and brick it is the fill.
  ...(['orange-500', 'carolina-500', 'leaf-500', 'apple-500'] as const).map((face): Pair => ({
    id: `switch on: thumb keyline on ${face}`, fg: 'ink-950', bg: [face], role: 'ui', usedAt: ['packages/ui/cards/NeonSwitch.tsx:25', 'packages/ui/cards/NeonSwitch.tsx:31'],
  })),
  ...(['royal-500', 'orange-800'] as const).map((face): Pair => ({
    id: `switch on: thumb fill on ${face}`, fg: 'ink-50', bg: [face], role: 'ui', usedAt: ['packages/ui/cards/NeonSwitch.tsx:25', 'packages/ui/cards/NeonSwitch.tsx:31'],
  })),
  { id: 'checkbox off: box edge', fg: 'silver-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/cards/NeonCheckbox.tsx:24'] },
  { id: 'slider thumb on track', fg: 'ink-50', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/Slider.web.tsx:24', 'packages/ui/Slider.web.tsx:30'] },
  { id: 'chart series: orange', fg: 'orange-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/series.ts:21', 'packages/ui/charts/NeonLineChart.tsx:128'] },
  { id: 'chart series: royal', fg: 'royal-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/series.ts:20', 'packages/ui/charts/NeonLineChart.tsx:128'] },
  { id: 'chart series: carolina', fg: 'carolina-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/series.ts:20', 'packages/ui/charts/NeonLineChart.tsx:128'] },
  { id: 'chart series: leaf', fg: 'leaf-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/series.ts:21', 'packages/ui/charts/NeonLineChart.tsx:128'] },
  { id: 'chart series: apple', fg: 'apple-500', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/series.ts:21', 'packages/ui/charts/NeonLineChart.tsx:128'] },
  { id: 'chart series: brick', fg: 'orange-700', bg: NIGHT, role: 'ui', usedAt: ['packages/ui/district/series.ts:10', 'packages/ui/district/series.ts:22'] },
  { id: 'chart keyline: royal under orange', fg: 'royal-500', bg: ['orange-500'], role: 'decorative', usedAt: ['packages/ui/district/series.ts:75', 'packages/ui/charts/NeonLineChart.tsx:129'], reason: 'the wordmark keyline under a stroke; the stroke against night carries the data' },
  { id: 'night facade border', fg: 'ink-800', bg: NIGHT, role: 'decorative', usedAt: ['packages/ui/DataTable.tsx:30', 'packages/ui/SegmentedControl.web.tsx:13', 'packages/ui/charts/StoryPanel.tsx:8'], reason: 'container keylines; the selected segment face and cell text identify content' },
  { id: 'night control keyline', fg: 'ink-700', bg: NIGHT, role: 'decorative', usedAt: ['packages/ui/nav/NavBar.tsx:87', 'packages/ui/DataTable.tsx:52', 'packages/ui/cards/neon-field.ts:26'], reason: 'frame around a control whose glyph or label (white / silver-100 / silver-300) identifies it' },
  { id: 'outline knock-out', fg: 'surface', bg: ['surface'], role: 'decorative', usedAt: ['packages/ui/text-effects/OutlineText.tsx:63'], reason: 'fills the glyph face with the surface; the outline stroke carries the text' },


  // -- daylit page (Decision #4): concrete neutrals, signage-black type -------
  // Palette steps, so one `both` row each; the semantic light column resolves to
  // these and is measured again by the token contract above.
  ...(['concrete-50', 'concrete-100', 'white'] as const).map((page): Pair => ({
    id: `daylit: signage-black on ${page}`, fg: 'signage-black', bg: [page], role: 'text', usedAt: [],
  })),
  ...(['concrete-50', 'concrete-100', 'white'] as const).map((page): Pair => ({
    id: `daylit: muted concrete-600 on ${page}`, fg: 'concrete-600', bg: [page], role: 'text', usedAt: [],
  })),
  ...(['concrete-50', 'concrete-100'] as const).map((page): Pair => ({
    id: `daylit: secondary concrete-700 on ${page}`, fg: 'concrete-700', bg: [page], role: 'text', usedAt: [],
  })),
  { id: 'daylit: large/ui grey concrete-500 on page', fg: 'concrete-500', bg: ['concrete-50'], role: 'large-text', usedAt: [], reason: 'never body text; large text and marks only' },
  { id: 'daylit: CTA label', fg: 'signage-black', bg: ['orange-500'], role: 'text', usedAt: [] },
  { id: 'daylit: CTA pressed label', fg: 'signage-black', bg: ['orange-400'], role: 'text', usedAt: [] },
  ...(['concrete-50', 'concrete-100'] as const).flatMap((page): Pair[] => [
    { id: `daylit: link/focus royal-500 on ${page}`, fg: 'royal-500', bg: [page], role: 'text', usedAt: [] },
    { id: `daylit: danger apple-600 on ${page}`, fg: 'apple-600', bg: [page], role: 'text', usedAt: [] },
    { id: `daylit: success leaf-700 on ${page}`, fg: 'leaf-700', bg: [page], role: 'text', usedAt: [] },
    { id: `daylit: info carolina-800 on ${page}`, fg: 'carolina-800', bg: [page], role: 'text', usedAt: [] },
  ]),
  { id: 'daylit: hairline concrete-200 on page', fg: 'concrete-200', bg: ['concrete-50'], role: 'decorative', usedAt: ['packages/theme/tokens.ts:150'], reason: '`border` on daylit: dividers and frames around controls whose label identifies them' },
  { id: 'daylit: keyline concrete-400 on page', fg: 'concrete-400', bg: ['concrete-50'], role: 'decorative', usedAt: ['packages/theme/tokens.ts:78'], reason: 'decorative keylines (docs/DESIGN_SYSTEM.md concrete-400); no information' },

  // -- H-Lynk Core (Decision #16): body plastic is scheme-invariant -----------
  { id: 'hlynk: LED on in the black head', fg: 'led-on', bg: ['hlynk-core-black'], role: 'ui', usedAt: [] },
  { id: 'hlynk: trackpad ring on pad face', fg: 'hlynk-core-ring', bg: ['hlynk-core-black'], role: 'ui', usedAt: [] },
  { id: 'hlynk: black control edge on body', fg: 'hlynk-core-black', bg: ['hlynk-core-body'], role: 'ui', usedAt: [], reason: 'the key, pad and head edges identify each control; black is never text on the body' },
  { id: 'hlynk: key glyph', fg: 'hlynk-core-glyph', bg: ['hlynk-core-black'], role: 'ui', usedAt: [] },
  { id: 'hlynk: key glyph pressed', fg: 'hlynk-core-glyph-pressed', bg: ['hlynk-core-black'], role: 'ui', usedAt: [] },
  { id: 'hlynk: text on body', fg: 'hlynk-core-ink', bg: ['hlynk-core-body'], role: 'text', usedAt: [] },
  { id: 'hlynk: hatch rim on pad face', fg: 'hlynk-core-hatch-rim', bg: ['hlynk-core-black'], role: 'ui', usedAt: [] },
  { id: 'hlynk: hatch orange on night', fg: 'hlynk-core-hatch-rim', bg: NIGHT, role: 'text', usedAt: [] },
  { id: 'hlynk: body on daylit page', fg: 'hlynk-core-body', bg: ['concrete-50'], role: 'decorative', usedAt: ['packages/theme/tokens.ts:188'], reason: 'the shell is not a control; its edge needs no ratio (measures 4.98 anyway)' },
  { id: 'hlynk: body on night page', fg: 'hlynk-core-body', bg: NIGHT, role: 'decorative', usedAt: ['packages/theme/tokens.ts:188'], reason: 'the shell is not a control; its edge needs no ratio (measures 3.70 anyway)' },
  { id: 'hlynk: LED off in the black head', fg: 'led-off', bg: ['hlynk-core-black'], role: 'decorative', usedAt: ['packages/theme/tokens.ts:174'], reason: 'the unlit lens; LED state is never conveyed by the LED alone (a text chip sits in the screen)' },
  { id: 'hlynk: disabled key glyph', fg: 'hlynk-core-glyph-disabled', bg: ['hlynk-core-black'], role: 'disabled', usedAt: ['packages/theme/tokens.ts:198'], reason: 'inactive key' },
  { id: 'hlynk: key and trackpad focus outline on body', fg: 'hlynk-core-ink', bg: ['hlynk-core-body'], role: 'ui', usedAt: ['packages/ui/hlynk/HLynkKey.tsx:69', 'packages/ui/hlynk/Trackpad.web.tsx:48'] },
  { id: 'hlynk: trackpad ring, booting or disabled', fg: 'led-off', bg: ['hlynk-core-black'], role: 'disabled', usedAt: ['packages/ui/hlynk/TrackpadFace.tsx:41'], reason: 'inactive trackpad during boot (WCAG 1.4.11 inactive components)' },
  { id: 'hlynk: reduced-motion LED cue in the black head', fg: 'led-on', bg: ['hlynk-core-black'], role: 'ui', usedAt: ['packages/ui/hlynk/ScannerLed.tsx:96', 'packages/ui/hlynk/ScannerLed.tsx:104', 'packages/ui/hlynk/ScannerLed.tsx:107'], reason: 'tick row, filled dot and exclamation dot that stand in for the LED rhythm' },

  // -- text on the ink plate over a scene (SolidPanel tone="ink": ink-800 face in both themes)
  { id: 'scene plate headline', fg: 'orange-500', bg: ['ink-800'], role: 'large-text', usedAt: ['packages/app/features/explore/explore-content.tsx:22', 'packages/app/features/profile/profile-content.tsx:46', 'packages/app/features/error/screen.shared.tsx:25'], reason: 'display-sm heading and the display-xl 404 on the plate' },
  { id: 'scene plate title', fg: 'ink-50', bg: ['ink-800'], role: 'large-text', usedAt: ['packages/app/features/error/screen.shared.tsx:29'] },
  { id: 'scene plate body', fg: 'silver-200', bg: ['ink-800'], role: 'text', usedAt: ['packages/app/features/profile/profile-content.tsx:47', 'packages/app/features/error/screen.shared.tsx:32'] },
  { id: 'scene plate line', fg: 'silver-300', bg: ['ink-800'], role: 'text', usedAt: ['packages/app/features/explore/explore-content.tsx:43', 'packages/app/features/profile/profile-content.tsx:45'] },
  { id: 'scene plate tab label', fg: 'silver-200', bg: ['ink-900'], role: 'text', usedAt: ['packages/app/features/explore/explore-content.tsx:25'] },
  { id: 'scene plate tab edge', fg: 'ink-400', bg: ['ink-800'], role: 'ui', usedAt: ['packages/app/features/explore/explore-content.tsx:23'] },
  { id: 'scene plate selected tab label', fg: 'ink-950', bg: ['orange-500'], role: 'text', usedAt: ['packages/app/features/explore/explore-content.tsx:26'] },
  { id: 'scene plate selected tab face', fg: 'orange-500', bg: ['ink-800'], role: 'ui', usedAt: ['packages/app/features/explore/explore-content.tsx:24'] },
  { id: 'skyline divider keyline', fg: 'orange-500', bg: ['ink-950'], role: 'decorative', usedAt: ['packages/ui/backgrounds/SkylineDivider.tsx:35'], reason: 'aria-hidden band between sections; the section headings carry the structure' },

  // -- admin console (08-handoff §9): signage bands and the page-surface cards -
  { id: 'console: signage band headline', fg: 'signage-white', bg: ['signage-black'], role: 'text', usedAt: [] },
  { id: 'console: signage band detail', fg: 'signage-white/85', bg: ['signage-black'], role: 'text', usedAt: [] },

  // -- disabled ---------------------------------------------------------------
  { id: 'disabled label', fg: 'ink-400', bg: NIGHT, role: 'disabled', usedAt: ['packages/ui/Button.tsx:48', 'packages/ui/IconButton.tsx:79', 'packages/ui/neon/NeonChevron.tsx:55', 'packages/ui/audio/PlayerShell.tsx:123'], reason: 'inactive control' },
  { id: 'disabled slider icon', fg: 'ink-700', bg: NIGHT, role: 'disabled', usedAt: ['packages/ui/cards/CardSlider.shared.tsx:159'], reason: 'inactive control' },
];

export const PAIRS: readonly Pair[] = [...CONTRACT, ...USAGE];

/**
 * §1.3 rules: combinations that must never be drawn. Each still has to measure
 * under its role's threshold, or the rule has gone stale and should be dropped.
 */
export interface Forbidden {
  id: string;
  fg: string;
  bg: string;
  role: Exclude<Role, 'decorative' | 'disabled'>;
  rule: string;
  /**
   * A house floor above the role's WCAG threshold, for rules about margin
   * rather than failure. The pair must measure under this instead.
   */
  floor?: number;
}

export const FORBIDDEN: readonly Forbidden[] = [
  { id: 'orange on royal', fg: 'orange-500', bg: 'royal-500', role: 'ui', rule: 'Orange is an accent on night and neutrals; never orange text or marks on royal.' },
  { id: 'white on orange', fg: 'white', bg: 'orange-500', role: 'text', rule: 'No white-on-orange labels. Orange faces take night text (on-primary in dark).' },
  { id: 'banner white on orange', fg: 'ink-50', bg: 'orange-500', role: 'text', rule: 'Same rule for the banner white.' },
  { id: 'white on apple', fg: 'white', bg: 'apple-500', role: 'text', rule: 'Apple faces take night text below 18.66px bold.' },
  { id: 'orange on light', fg: 'orange-500', bg: 'ink-50', role: 'ui', rule: 'Brand orange is not text, icon or chart ink on a light surface; use primary (orange-700) there.' },
  { id: 'carolina on light', fg: 'carolina-500', bg: 'ink-50', role: 'ui', rule: 'Carolina is a night colour; on light use info (carolina-800).' },
  { id: 'leaf on light', fg: 'leaf-500', bg: 'ink-50', role: 'ui', rule: 'Leaf on light fails even 3:1; use success (leaf-700).' },
  { id: 'apple on light (text)', fg: 'apple-500', bg: 'ink-50', role: 'text', rule: 'Apple on light holds 3:1 for marks only; text uses danger (apple-600).' },
  { id: 'royal on night (text)', fg: 'royal-500', bg: 'ink-950', role: 'text', rule: 'Royal reads as structure on night, never as text; royal text uses royal-300.' },
  { id: 'orange on daylit page', fg: 'orange-500', bg: 'concrete-50', role: 'ui', rule: 'Orange is a face on daylit (cta), never text, icon or line.' },
  { id: 'LED on Core body', fg: 'led-on', bg: 'hlynk-core-body', role: 'ui', rule: 'The LED, emitters and the trackpad ring never touch bare body plastic; they sit on black.' },
  { id: 'apple-400 on Core body', fg: 'apple-400', bg: 'hlynk-core-body', role: 'ui', rule: 'Same for the lighter red.' },
  { id: 'black text on Core body', fg: 'signage-black', bg: 'hlynk-core-body', role: 'text', rule: 'Black is a control face on the body, never text. Text on the body is hlynk-core-ink (white).' },
  { id: 'concrete-900 keys on Core body', fg: 'concrete-900', bg: 'hlynk-core-body', role: 'ui', floor: 3.5, rule: 'Passes 3:1 by 0.05; too thin a margin for key edges. Core keys are pure black.' },
  { id: 'black keys on apple-700', fg: 'signage-black', bg: 'apple-700', role: 'ui', rule: 'Why the body is not the deeper red.' },
  { id: 'brick face on night', fg: 'orange-800', bg: 'ink-950', role: 'ui', rule: 'Brick (orange-800) is a face colour; its control edge on night is orange-700.' },
];

// ---- measuring --------------------------------------------------------------

function themed(p: { fg: string; bg: readonly string[] }): boolean {
  return isSemantic(p.fg) || p.bg.some(isSemantic);
}

/** One row per mode for themed pairs, one `both` row for palette-only pairs. */
export function measure(pair: Pair): Measurement[] {
  const modes: (Mode | 'both')[] = themed(pair) ? ['light', 'dark'] : ['both'];
  return modes.map((mode) => {
    const m: Mode = mode === 'both' ? 'dark' : mode;
    const bg = flatten(pair.bg, m);
    const fgRaw = resolveToken(pair.fg, m);
    const fg = fgRaw[3] < 1 ? composite(fgRaw, bg) : fgRaw;
    const ratio = contrastRatio(fg, bg);
    const threshold = THRESHOLD[pair.role];
    return { pair, mode, fgHex: toHex(fg), bgHex: toHex(bg), ratio, threshold, pass: ratio >= threshold };
  });
}

export function measureAll(pairs: readonly Pair[] = PAIRS): Measurement[] {
  return pairs.flatMap(measure);
}

export function measureForbidden(f: Forbidden): { ratio: number; threshold: number } {
  return { ratio: contrastRatio(resolveToken(f.fg, 'dark'), resolveToken(f.bg, 'dark')), threshold: f.floor ?? THRESHOLD[f.role] };
}
