/**
 * Every NeonBlade UI component (https://neonbladeui.neuronrush.com/components)
 * and its NYC-MON port: what it is called here, where its story is, and
 * which story file and export the index previews. Drives NeonBlade/Index.
 */
export const NEONBLADE_SITE = 'https://neonbladeui.neuronrush.com/components';

export type NeonBladeCategory =
  | 'backgrounds' | 'buttons' | 'cards' | 'charts' | 'cursors' | 'elements' | 'footers'
  | 'inputs' | 'navbars' | 'progress' | 'sliders' | 'tables' | 'text';

export const CATEGORY_NAMES: Record<NeonBladeCategory, string> = {
  backgrounds: 'Backgrounds',
  buttons: 'Buttons',
  cards: 'Cards',
  charts: 'Charts',
  cursors: 'Cursors',
  elements: 'Elements',
  footers: 'Footers',
  inputs: 'Inputs',
  navbars: 'Navbars',
  progress: 'Progress',
  sliders: 'Sliders',
  tables: 'Tables',
  text: 'Text',
};

export interface CatalogEntry {
  category: NeonBladeCategory;
  /** NeonBlade's slug, as in its URL and registry. */
  slug: string;
  /** NeonBlade's display name. */
  name: string;
  /** Our component, as you would import or write it. */
  ours: string;
  /** Story file (without .stories.tsx) and export the link opens. */
  story: { file: string; export: string };
  /** Story the thumbnail renders, when it differs from `story` (e.g. a button page). */
  preview?: { file: string; export: string };
  /** Width, px, the thumbnail lays the story out at before scaling. Small parts use less so they fill the card. Default 1200. */
  stage?: number;
  /** Which end of the story the thumbnail shows. Default top. */
  anchor?: 'top' | 'bottom';
  /** One line on how the port reads. */
  note: string;
}

export const CATALOG: readonly CatalogEntry[] = [
  { category: 'backgrounds', slug: 'ascii-rain', name: 'ASCII Rain', ours: 'SignRain', story: { file: 'SignRain', export: 'Playground' }, note: 'Street-sign glyphs rain over a solid skyline.' },
  { category: 'backgrounds', slug: 'cyber-circuit', name: 'Cyber Circuit', ours: 'SubwayLines', story: { file: 'SubwayLines', export: 'Playground' }, note: 'Circuit traces become subway lines with trains as the pulses.' },
  { category: 'backgrounds', slug: 'datalines-with-grid', name: 'Datalines With Grid', ours: 'StreetPulse', story: { file: 'StreetPulse', export: 'Playground' }, note: 'Data lines run the avenues of a street grid.' },
  { category: 'backgrounds', slug: 'glyph-city', name: 'Glyph City', ours: 'CitySkyline (also GlyphCity)', story: { file: 'CitySkyline', export: 'Playground' }, note: 'The hero skyline: solid district towers with lit windows.' },
  { category: 'backgrounds', slug: 'grid-floor', name: 'Grid Floor', ours: 'GridFloor', story: { file: 'GridFloor', export: 'Playground' }, note: 'A solid street-grid ground plane with avenue lights.' },
  { category: 'backgrounds', slug: 'grid-scene', name: 'Grid Scene', ours: 'GridScene', story: { file: 'GridScene', export: 'Playground' }, note: 'The street grid as a full scene with a horizon.' },
  { category: 'backgrounds', slug: 'hexagons', name: 'Hexagons', ours: 'CityBlocks', story: { file: 'CityBlocks', export: 'Playground' }, note: 'Hexagon tiles become a tiling of city blocks.' },
  { category: 'backgrounds', slug: 'holographic-terrain', name: 'Holographic Terrain', ours: 'CityHeightfield', story: { file: 'CityHeightfield', export: 'Playground' }, note: 'Terrain becomes a heightfield of rooftops.' },
  { category: 'backgrounds', slug: 'neon-tide', name: 'Neon Tide', ours: 'RiverTide', story: { file: 'RiverTide', export: 'Playground' }, note: 'The tide comes in off the river.' },
  { category: 'backgrounds', slug: 'pluviophile', name: 'Pluviophile', ours: 'RainWindow', story: { file: 'RainWindow', export: 'Playground' }, note: 'Rain on a window over the city at night.' },
  { category: 'buttons', slug: 'corner-cut-button', name: 'Corner Cut Button', ours: '<Button variant="cornerCut">, <IconButton variant="cornerCut">', story: { file: 'Button', export: 'CornerCut' }, stage: 420, note: 'A kit Button variant with a cut corner on a depth plate.' },
  { category: 'cards', slug: 'border-beam-corner-cut-card', name: 'Border Beam Corner Cut Card', ours: '<Card variant="beam">', story: { file: 'Card', export: 'Beam' }, stage: 420, note: 'A light runs the border of a corner-cut card.' },
  { category: 'cards', slug: 'neon-glow-corner-cut-card', name: 'Neon Glow Corner Cut Card', ours: '<Card variant="cornerCut">', story: { file: 'Card', export: 'CornerCut' }, stage: 420, note: 'A solid corner-cut card with an accent glow.' },
  { category: 'cards', slug: 'notch-card', name: 'Notch Card', ours: '<Card variant="notch">', story: { file: 'Card', export: 'Notch' }, stage: 420, note: 'Notched edges, like a setback.' },
  { category: 'charts', slug: 'neon-bar-chart', name: 'Neon Bar Chart', ours: 'NeonBarChart', story: { file: 'NeonBarChart', export: 'Playground' }, note: 'Bars are buildings with lit windows; the tallest wears a crown.' },
  { category: 'charts', slug: 'neon-donut-chart', name: 'Neon Donut Chart', ours: 'NeonDonutChart', story: { file: 'NeonDonutChart', export: 'Playground' }, note: 'A solid medallion with hover dimming, a centre label and a tooltip.' },
  { category: 'charts', slug: 'neon-line-chart', name: 'Neon Line Chart', ours: 'NeonLineChart', story: { file: 'NeonLineChart', export: 'Playground' }, note: 'Thick lines on a royal keyline, with a scrub readout.' },
  { category: 'charts', slug: 'neon-sparkline', name: 'Neon Sparkline', ours: 'NeonSparkline', story: { file: 'NeonSparkline', export: 'Playground' }, stage: 420, note: 'The line plot at word size.' },
  { category: 'charts', slug: 'stat-card', name: 'Stat Card', ours: 'StatCard', story: { file: 'StatCard', export: 'Playground' }, stage: 520, note: 'A scoreboard tile with a sparkline.' },
  { category: 'cursors', slug: 'crosshair', name: 'Crosshair', ours: 'Crosshair', story: { file: 'Cursors', export: 'Reticle' }, preview: { file: 'Cursors', export: 'Drawings' }, stage: 560, note: 'A rounded-square reticle that turns carolina over things you can press.' },
  { category: 'cursors', slug: 'fox-cursor', name: 'Fox Cursor', ours: 'MouseCursor (MouseFace is the drawing; the arrow is PointerCursor)', story: { file: 'Cursors', export: 'Mouse' }, preview: { file: 'Cursors', export: 'Drawings' }, stage: 560, note: 'A geometric line-art mouse face centred on the pointer.' },
  { category: 'elements', slug: 'accent-frame', name: 'Accent Frame', ours: 'AccentFrame', story: { file: 'AccentFrame', export: 'Playground' }, stage: 420, note: 'Cornice and setback corners instead of plain cuts.' },
  { category: 'elements', slug: 'badge', name: 'Badge', ours: '<Badge variant="neon">', story: { file: 'Badge', export: 'Neon' }, stage: 520, note: 'A kit Badge variant: solid, outline or ghost fills.' },
  { category: 'elements', slug: 'neon-modal', name: 'Neon Modal', ours: 'notify.modal(...), <Dialog variant="neon">, notify.*(..., { variant: "neon" })', story: { file: 'Toast', export: 'LiveNeonModal' }, preview: { file: 'Dialog', export: 'Neon' }, stage: 760, note: 'A building-facade modal and neon toasts on sonner.' },
  { category: 'elements', slug: 'timeline', name: 'Timeline', ours: 'Timeline', story: { file: 'Timeline', export: 'Playground' }, stage: 520, note: 'A subway line with stations for events.' },
  { category: 'footers', slug: 'footer', name: 'Footer', ours: 'SiteFooter', story: { file: 'Nav', export: 'Footer' }, anchor: 'bottom', note: 'Minimal, columns, centred and mega footers over a skyline.' },
  { category: 'inputs', slug: 'neon-checkbox', name: 'Neon Checkbox', ours: '<Checkbox variant="neon">', story: { file: 'Checkbox', export: 'Neon' }, stage: 360, note: 'A kit Checkbox variant, also a form field.' },
  { category: 'inputs', slug: 'neon-input', name: 'Neon Input', ours: '<TextField variant="neon">', story: { file: 'TextField', export: 'Neon' }, stage: 420, note: 'A kit TextField variant, also a form field.' },
  { category: 'inputs', slug: 'neon-select', name: 'Neon Select', ours: '<Select variant="neon">', story: { file: 'Select', export: 'Neon' }, stage: 420, note: 'A kit Select variant, also a form field.' },
  { category: 'inputs', slug: 'neon-toggle', name: 'Neon Toggle', ours: '<Switch variant="neon">', story: { file: 'Switch', export: 'Neon' }, stage: 360, note: 'A kit Switch variant, also a form field.' },
  { category: 'navbars', slug: 'navbar', name: 'NavBar', ours: 'NavBar', story: { file: 'Nav', export: 'NavBarStory' }, note: 'A site header with dropdowns and a skyline band.' },
  { category: 'progress', slug: 'arrow-loader', name: 'Arrow Loader', ours: 'ArrowLoader', story: { file: 'ArrowLoader', export: 'Playground' }, stage: 320, note: 'Subway chevrons march along.' },
  { category: 'progress', slug: 'circular-progress', name: 'Circular Progress', ours: 'CircularProgress', story: { file: 'CircularProgress', export: 'Playground' }, stage: 320, note: 'A segmented token ring.' },
  { category: 'progress', slug: 'progress-bar', name: 'Progress Bar', ours: 'ProgressBar', story: { file: 'ProgressBar', export: 'Playground' }, stage: 360, note: 'A skyline builds up block by block.' },
  { category: 'progress', slug: 'rain-loader', name: 'Rain Loader', ours: 'RainLoader (story: Window loader)', story: { file: 'RainLoader', export: 'Playground' }, stage: 260, note: 'Window lights fill in floor by floor.' },
  { category: 'progress', slug: 'turbine-loader', name: 'Turbine Loader', ours: 'TurbineLoader (story: Rooftop loader)', story: { file: 'TurbineLoader', export: 'Playground' }, stage: 260, note: 'A rooftop water tower with a spinning fan.' },
  { category: 'sliders', slug: 'card-slider', name: 'Card Slider', ours: 'CardSlider', story: { file: 'CardSlider', export: 'Playground' }, stage: 900, note: 'Paging cards with autoplay, side buttons and progress.' },
  { category: 'tables', slug: 'neon-table', name: 'Neon Table', ours: '<DataTable variant="neon">', story: { file: 'DataTable', export: 'Neon' }, stage: 760, note: 'A kit DataTable variant: a scoreboard.' },
  { category: 'text', slug: 'glitch-text', name: 'Glitch Text', ours: '<Text variant="glitch">', story: { file: 'TextEffects', export: 'Glitch' }, stage: 300, note: 'A kit Text variant.' },
  { category: 'text', slug: 'neon-glow', name: 'Neon Glow', ours: '<Text variant="neonGlow">', story: { file: 'TextEffects', export: 'NeonGlow' }, stage: 300, note: 'A kit Text variant.' },
  { category: 'text', slug: 'outline-text', name: 'Outline Text', ours: '<Text variant="outline">', story: { file: 'TextEffects', export: 'Outline' }, stage: 300, note: 'A kit Text variant.' },
];

export function siteUrl(e: Pick<CatalogEntry, 'category' | 'slug'>): string {
  return `${NEONBLADE_SITE}/${e.category}/${e.slug}`;
}

/** Categories in the site's order, each with its entries. */
export function byCategory(entries: readonly CatalogEntry[] = CATALOG) {
  const order = Object.keys(CATEGORY_NAMES) as NeonBladeCategory[];
  return order.map((c) => ({ category: c, name: CATEGORY_NAMES[c], entries: entries.filter((e) => e.category === c) })).filter((g) => g.entries.length);
}
