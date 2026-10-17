// The city's material colours, every one derived from @acme/theme palette
// steps (no hex literal lives here; the tokens file owns them). Some city
// materials have no single token, so they are a fixed mix of two or three
// steps; docs/implementation/city-world.md lists each recipe. Pure: no three
// import, so node tests can pin the values.
import { palette } from '@acme/theme';

const { orange, royal, carolina, leaf, apple, ink, concrete, signage } = palette;

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Linear blend of two `#RRGGBB` tokens in display space; t = 0 gives `a`. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  const k = Math.max(0, Math.min(1, t));
  const out = ca.map((v, i) => Math.round(v + (cb[i]! - v) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `#RRGGBB` to 0..1 channels, for vertex colours. */
export function hexToRgb(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex);
  return [r / 255, g / 255, b / 255];
}

export const CITY_COLORS = {
  // Sky and air: dusk over Harlem, the zenith going to brand night, a dusty rose haze at the horizon.
  skyZenith: mixHex(royal[900], ink[950], 0.35),
  skyMid: mixHex(royal[600], carolina[700], 0.4),
  skyHorizon: mixHex(orange[300], royal[300], 0.35),
  sunGlow: orange[400],
  sun: orange[200],
  hemiSky: mixHex(carolina[300], royal[300], 0.4),
  hemiGround: concrete[500],
  // Ground and land use.
  ground: mixHex(concrete[200], orange[100], 0.25),
  park: mixHex(leaf[400], leaf[500], 0.35),
  garden: leaf[400],
  grass: leaf[300],
  pitch: leaf[500],
  playground: orange[200],
  plaza: concrete[100],
  parking: concrete[300],
  school: mixHex(concrete[200], orange[200], 0.3),
  water: mixHex(carolina[500], royal[400], 0.3),
  // Streets.
  asphalt: ink[700],
  laneYellow: orange[300],
  laneWhite: concrete[50],
  sidewalk: concrete[300],
  curb: concrete[400],
  // Facades, by material class.
  brownstone: mixHex(orange[900], concrete[700], 0.35),
  brick: mixHex(mixHex(orange[800], apple[800], 0.5), concrete[500], 0.3),
  nycha: mixHex(mixHex(orange[800], apple[900], 0.5), concrete[600], 0.25),
  glass: mixHex(carolina[700], concrete[400], 0.35),
  civic: mixHex(concrete[100], orange[50], 0.5),
  church: mixHex(concrete[400], orange[200], 0.3),
  plain: concrete[200],
  roof: concrete[600],
  window: mixHex(ink[800], carolina[900], 0.4),
  // The rooms behind the glass (L3): warm plaster walls, a wood floor, an
  // acoustic-tile ceiling with a lit panel, dark silhouettes for furniture
  // and doors, venetian blinds and the sill AC. Read at emissive level, so
  // they sit a step or two lighter than the surfaces they stand for.
  roomWall: mixHex(concrete[100], orange[100], 0.35),
  roomWallSide: mixHex(concrete[200], orange[100], 0.3),
  roomFloor: mixHex(orange[900], ink[800], 0.35),
  roomCeiling: concrete[50],
  roomPanel: mixHex(orange[50], concrete[50], 0.5),
  roomDark: mixHex(ink[800], carolina[900], 0.35),
  roomFurniture: mixHex(ink[800], orange[900], 0.2),
  roomDoor: mixHex(orange[900], ink[900], 0.45),
  blind: mixHex(concrete[100], orange[100], 0.3),
  acUnit: concrete[400],
  // Trees and shadow.
  leafLight: leaf[500],
  leafDark: leaf[700],
  trunk: mixHex(orange[950], ink[800], 0.4),
  shadow: ink[900],
  // Landmarks.
  marquee: apple[500],
  marqueeLights: orange[200],
  terracotta: concrete[50],
  beacon: royal[400],
  // The near-future layer: brand neon (the 400 steps where the 500 is too dark to glow), lit windows, street furniture.
  neonOrange: orange[500],
  neonRoyal: royal[400],
  neonCarolina: carolina[400],
  neonApple: apple[400],
  neonLeaf: leaf[400],
  windowWarm: orange[200],
  windowAmber: orange[300],
  windowCool: carolina[200],
  sidewalkGrid: carolina[400],
  curbGlow: royal[400],
  // NYC street-name blade: white on green (leaf 800 sits near the MUTCD sign green).
  signGreen: leaf[800],
  signText: signage.white,
  pole: ink[800],
  lampHead: mixHex(orange[50], carolina[100], 0.5),
  lampHalo: orange[200],
  // Wall tone families, so a block is not one flat colour per class (WALL_TONES).
  brownstoneWarm: mixHex(orange[800], concrete[600], 0.3),
  sandstone: mixHex(orange[700], concrete[500], 0.45),
  brickRed: mixHex(mixHex(apple[800], orange[700], 0.5), concrete[500], 0.2),
  brickDark: mixHex(orange[900], apple[900], 0.5),
  brickBuff: mixHex(orange[400], concrete[400], 0.55),
  limestone: mixHex(concrete[100], orange[100], 0.35),
  stucco: mixHex(concrete[300], orange[200], 0.2),
  glassDark: mixHex(royal[800], carolina[700], 0.5),
  glassTeal: mixHex(carolina[600], leaf[700], 0.3),
  // Window surrounds: pale stone lintels and sills, dark frames.
  lintel: mixHex(concrete[100], orange[100], 0.5),
  // Roll-down shop gates.
  gate: concrete[400],
  // Cast iron: stoop railings, fire escapes, hydrant caps.
  iron: ink[900],
  cornice: mixHex(concrete[600], orange[900], 0.25),
  // Shop awnings.
  awningRed: apple[600],
  awningGreen: leaf[700],
  awningBlue: royal[600],
  awningOrange: orange[600],
  awningBlack: ink[800],
  awningTeal: carolina[700],
  // Water towers: weathered cedar staves, black steel, a tarred roof.
  cedar: mixHex(orange[900], concrete[500], 0.35),
  towerSteel: ink[800],
  towerRoof: ink[700],
  // Street things. The palette has no yellow: taxis take the orange steps the lane lines use.
  taxi: mixHex(orange[300], orange[400], 0.4),
  carSilver: concrete[300],
  carDark: ink[800],
  carBlue: royal[700],
  carRed: apple[700],
  carGrey: concrete[600],
  carGreen: leaf[800],
  carGlass: ink[900],
  tyre: ink[950],
  hydrant: apple[600],
  hydrantCap: concrete[300],
  basket: leaf[900],
  subwayRail: leaf[900],
  subwayGlobe: leaf[400],
  shelterGlass: mixHex(carolina[800], ink[800], 0.4),
  shelterFrame: concrete[600],
  // Time-of-day sky tones for the realism pass (look.ts). The originals
  // above stay the dusk set; these cover a clear morning and a sodium-lit
  // night. All TODO(tune) against Mike's Apollo-block photos before ship.
  morningZenith: mixHex(carolina[700], royal[600], 0.4),
  morningMid: mixHex(carolina[400], concrete[100], 0.3),
  morningHorizon: mixHex(orange[100], carolina[200], 0.45),
  morningGlow: orange[200],
  morningSun: mixHex(concrete[50], orange[100], 0.4),
  morningHemiSky: mixHex(carolina[200], concrete[100], 0.4),
  morningHemiGround: concrete[400],
  nightZenith: mixHex(ink[950], royal[900], 0.3),
  nightMid: mixHex(royal[800], ink[900], 0.5),
  // Harlem's light pollution: the skyline never goes black, it goes sodium.
  nightHorizon: mixHex(ink[800], orange[700], 0.25),
  nightGlow: mixHex(orange[500], ink[800], 0.4),
  // The night key is the moon, not the sun.
  nightMoon: mixHex(carolina[100], concrete[50], 0.5),
  nightHemiSky: mixHex(royal[700], ink[800], 0.4),
  nightHemiGround: ink[700],
} as const;

export type CityColor = keyof typeof CITY_COLORS;

/** Wall tones per material class, one picked per building by a hash of its id (city-mesh.ts). */
export const WALL_TONES = {
  brownstone: ['brownstone', 'brownstoneWarm', 'sandstone'],
  brick: ['brick', 'brickRed', 'brickDark', 'brickBuff'],
  nycha: ['nycha', 'brickDark'],
  glass: ['glass', 'glassDark', 'glassTeal'],
  civic: ['civic', 'limestone'],
  church: ['church', 'limestone', 'sandstone'],
  plain: ['plain', 'limestone', 'stucco'],
} as const satisfies Record<string, readonly CityColor[]>;

export const AWNING_TONES = ['awningRed', 'awningGreen', 'awningBlue', 'awningOrange', 'awningBlack', 'awningTeal'] as const satisfies readonly CityColor[];
export const CAR_TONES = ['carSilver', 'carDark', 'carBlue', 'carRed', 'carGrey', 'carGreen', 'carDark', 'carSilver'] as const satisfies readonly CityColor[];
