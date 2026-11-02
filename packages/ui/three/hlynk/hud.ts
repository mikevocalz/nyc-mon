/**
 * The H-Lynk screen's interface (PS-037): five tabs, what each tab shows, the
 * hit regions on the drawn screen, and the text a screen reader gets for it.
 * Pure TypeScript, no DOM and no three.js, so the server renders the captions
 * and node tests check the copy and the regions.
 *
 * One store per stage holds the state (repo rule: Zustand, never useState).
 * The tab control is the accessible source of truth; the 3D screen is a
 * second view of the same store and writes to it on a tap or click. Shared
 * by the website and the app (packages/ui/three/hlynk).
 */

/** The tabs, in the order the creator named them (PS-037, supersedes PS-019). */
export const HUD_TABS = ['dex', 'crew', 'care', 'bag', 'city'] as const;
export type HudTab = (typeof HUD_TABS)[number];
/** The screen opens on the Mon: the face the static capture shows. */
export const DEFAULT_HUD_TAB: HudTab = 'crew';

/** What the pointer is over on the 3D model: a tab on the screen, or the left side key. */
export type HudHover = HudTab | 'side-key';

/**
 * Per-stage screen state shared by the tab control and the 3D screen. The
 * pointer's hover target and the press counters belong to the stage
 * (DeviceStage's store), which every H-Lynk screen shares.
 */
export interface HudState {
  tab: HudTab;
  /** Side key sound on. The chirp only ever plays from a direct press. */
  sound: boolean;
}

export const initialHudState = (): HudState => ({ tab: DEFAULT_HUD_TAB, sound: true });

/** One care meter on the Care tab. The value is an illustration, never a reading. */
export interface HudMeter {
  name: string;
  value: number;
  /** Which `hud` colour fills the bar. */
  tone: 'amber' | 'cyan' | 'green';
}

/** Everything the screen shows. Every string comes from copy.ts or @acme/content. */
export interface HudContent {
  /** status row: the tier name */
  title: string;
  /** the starter's Baby name */
  mon: string;
  /** the line under the name ("Your Mon") */
  note: string;
  /** tab labels, also the DOM control's labels */
  tabs: Record<HudTab, string>;
  /** the starters with their Dex numbers, formatted ("No. 001") */
  dex: readonly { no: string; name: string }[];
  /** the three care meters and the line that says they are examples */
  care: { meters: readonly HudMeter[]; note: string };
  /** the Bag tab's one line */
  bag: string;
  /** the City tab: the four district names and one line under them */
  city: { districts: readonly string[]; line: string };
}

/** Exhaustive over HudTab: a new tab fails the typecheck until it has a caption. */
function tabBody(tab: HudTab, c: HudContent): string {
  switch (tab) {
    case 'dex':
      return `${c.dex.map((d) => `${d.no} ${d.name}`).join(', ')}.`;
    case 'crew':
      return `${c.mon}. ${c.note}.`;
    case 'care':
      return `${c.care.meters.map((m) => `${m.name} ${m.value} of 100`).join(', ')}. ${c.care.note}`;
    case 'bag':
      return c.bag;
    case 'city':
      return `${c.city.districts.join(', ')}. ${c.city.line}`;
  }
}

/** The screen as one sentence: the live caption under the stage, server-rendered for the default tab. */
export function hudCaption(tab: HudTab, content: HudContent): string {
  return `${content.tabs[tab]}: ${tabBody(tab, content)}`;
}

// --- the drawn screen --------------------------------------------------------

/** The screen canvas, px. The glass is 0.8 x 1.0 body widths; the canvas maps onto it edge to edge. */
export const HUD_SIZE = { width: 768, height: 1024 } as const;

/** The tab bar along the bottom of the screen, canvas px. Each tab is at least 128 x 96. */
export const HUD_TAB_BAR = { x: 24, y: 904, width: 720, height: 96 } as const;

/** Canvas rect of tab `i` in the bar. */
export function hudTabRect(i: number): { x: number; y: number; width: number; height: number } {
  const w = HUD_TAB_BAR.width / HUD_TABS.length;
  return { x: HUD_TAB_BAR.x + i * w, y: HUD_TAB_BAR.y, width: w, height: HUD_TAB_BAR.height };
}

/**
 * Screen UV (from a raycast hit) to the tab under it, or null. UV v runs
 * bottom-up; the canvas runs top-down.
 */
export function hudTabAt(u: number, v: number): HudTab | null {
  const x = u * HUD_SIZE.width;
  const y = (1 - v) * HUD_SIZE.height;
  const bar = HUD_TAB_BAR;
  if (y < bar.y || y > bar.y + bar.height || x < bar.x || x >= bar.x + bar.width) return null;
  return HUD_TABS[Math.floor(((x - bar.x) / bar.width) * HUD_TABS.length)] ?? null;
}

/**
 * Words the screen and its caption must never use: "device" for the H-Lynk
 * (Law 9), recruiting and ownership verbs, "wild" (Hood Mon), and pronouns
 * for a Mon (PS-005).
 */
export const HUD_BANNED = /\b(device|wild|owners?|trainers?|users?|catch\w*|captur\w*|it|its|he|she|him|her|his|they|them|their)\b/i;
