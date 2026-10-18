// Valdrada tile decoder for nyc-mon's offline Harlem bake.
//
// Verbatim port of the upstream decoder — Valdrada @ v0.4.0 (2724c79):
//   client/src/world/tiledata.js            (139 lines — parseTile, buildingsOf, holesOf,
//                                            roadsOf, furnitureOf, inRing, applyReadOverride, rw13WinW)
//   client/src/shared/geo.js                (85 lines — LAT0..TILE, FURN, STYLE, BF, project, unproject)
//   client/src/shared/landmarkSpec.js       (LANDMARKS, BUILDING_OVERRIDES and the read-time override
//                                            pushes at L219–L328 — applied unconditionally, which is
//                                            what a browser produces on a default load)
//   client/src/city/tk/tkOverrides.js       (TW_TOWERS — colour/style pushes only)
//
// Copyright (c) 2026 Mehmet Kerem Turkcan. MIT License — see upstream valdrada/LICENSE;
// tile bytes are ODbL 1.0, see upstream LICENSING.md.
//
// Coordinates: bldgXZ / roadVerts / furniture x,z are TILE-LOCAL; +header.origin gives
// Valdrada world metres (east +x, south +z); `toScene` goes WGS84 via geo.js inverse then
// nyc-mon's projectToScene. Vertical values (baseY, height, furniture y) are Valdrada's
// height datum, not coordinates — passed through unmodified.

const DEG = Math.PI / 180;
const round1 = (v) => Math.round(v * 10) / 10;

// --- geo.js L2–19 --------------------------------------------------------------
export const LAT0 = 40.7831;
export const LON0 = -73.9712;
export const M_PER_DEG_LAT = 111132.0;
export const M_PER_DEG_LON = 111320.0 * Math.cos((LAT0 * Math.PI) / 180); // ~84,300
export const TILE = 512;
export const MACRO = 2048;
export const FT = 0.3048;
export function project(lon, lat) {
  return [(lon - LON0) * M_PER_DEG_LON, -(lat - LAT0) * M_PER_DEG_LAT];
}
export function unproject(x, z) {
  return [x / M_PER_DEG_LON + LON0, -z / M_PER_DEG_LAT + LAT0];
}
export const tileId = (x, z) => `${Math.floor(x / TILE)}_${Math.floor(z / TILE)}`;

// --- geo.js L22–29 (FURN), L32–79 (STYLE), L82–85 (BF) ---------------------------
export const FURN = {
  TREE: 1, LAMP_COBRA: 2, LAMP_CROOK: 3, HYDRANT: 4, SIGNAL_MAST: 5, SIGNAL_PED: 6,
  STREET_SIGN: 7, LITTER: 8, MAILBOX: 9, BUS_SHELTER: 10, SUBWAY_ENTRANCE: 11,
  LINKNYC: 12, NEWSSTAND: 13, SCAFFOLD: 14, BENCH: 15, AWNING: 16, BIKE_RACK: 17,
  PHONE: 18, PLANTER: 19, STOOP: 20, FIRE_ESCAPE: 21, WATER_TOWER: 22, ROOF_AC: 23,
  ROOF_BULKHEAD: 24, CHIMNEY_POT: 25, STANDPIPE: 26, CONE: 27, FLAG: 28, MARQUEE: 29,
  CHURCH_TOWER: 30, CROSSING_BEACON: 31, PARKING_METER: 32,
};
// compile.mjs emits kinds past FURN's end — decode passes them through by `k`:
export const FURN_PIER = 33;      // viaduct pier: p0 lift, p1 width (compile.mjs L3012)
export const FURN_SIGN_POLE = 34; // sign pole (compile.mjs L4477)
export const FURN_DUMPSTER = 38;  // back-lot dumpster (compile.mjs L4482)
// Kinds whose placement is a public record (compile.mjs L4611–4615, G2 default). Tree p2:
// 1 = census / TI14 census-derived infill (L4528, L4603), 2 = yard, 4 = median, 0 = other
// generated — a G2 merge should keep only p2==1 trees.
export const RECORD_FURN = [FURN.TREE, FURN.HYDRANT, FURN.BUS_SHELTER, FURN.SUBWAY_ENTRANCE, FURN.LINKNYC, FURN.BIKE_RACK];

export const STYLE = {
  TENEMENT: 0, PREWAR_APT: 1, POSTWAR_BRICK: 2, MODERN_GLASS: 3, DECO_MASONRY: 4,
  ROWHOUSE: 5, LOFT_CASTIRON: 6, INDUSTRIAL: 7, CIVIC_STONE: 8, CHURCH: 9,
  RETAIL_STRIP: 10, GLASS_TOWER_BLUE: 11, PROJECT_BRICK: 12, RETAIL_MODERN: 13,
  FRAME_HOUSE: 14, CONDO_NEW: 15,
};
export const BF = {
  WATERTOWER: 1, CORNICE: 2, FIRE_ESCAPE: 4, STOREFRONT: 8, SETBACKS: 16,
  LANDMARK: 32, STOOP: 64, GABLE: 128,
};

// --- landmarkSpec.js L6–111, TW fix L114–117 baked in ---------------------------
// Each: { id, key, name, lat, lon, mode } — mode 'replace' | 'decorate'; on the wire the
// sign of landmarkId carries it (+id replace, −id decorate, compile.mjs L1551, L1571).
// The TW fix rewrites ids 23/31/32/50/60 unconditionally at module load — applied here.
export const LANDMARKS = (() => {
  const list = [
    { id: 1, key: 'lowLibrary', name: 'Low Memorial Library', lat: 40.80800, lon: -73.96188, mode: 'replace' },
    { id: 2, key: 'butlerLibrary', name: 'Butler Library', lat: 40.80642, lon: -73.96319, mode: 'replace' },
    { id: 3, key: 'stPaulsChapel', name: "St. Paul's Chapel (Columbia)", lat: 40.807854, lon: -73.960942, mode: 'replace' },
    { id: 4, key: 'riversideChurch', name: 'Riverside Church', lat: 40.81110, lon: -73.96420, mode: 'replace' },
    { id: 5, key: 'grantsTomb', name: 'General Grant National Memorial', lat: 40.81340, lon: -73.96320, mode: 'replace' },
    { id: 6, key: 'stJohnDivine', name: 'Cathedral of St. John the Divine', lat: 40.80390, lon: -73.96180, mode: 'replace' },
    { id: 7, key: 'shepardHall', name: 'Shepard Hall (City College)', lat: 40.81985, lon: -73.94935, mode: 'replace' },
    { id: 8, key: 'apolloTheater', name: 'Apollo Theater', lat: 40.81007, lon: -73.95003, mode: 'decorate' },
    { id: 9, key: 'hotelTheresa', name: 'Hotel Theresa', lat: 40.80920, lon: -73.94910, mode: 'decorate' },
    { id: 10, key: 'acpStateOffice', name: 'A.C. Powell Jr. State Office Bldg', lat: 40.80950, lon: -73.94830, mode: 'decorate' },
    { id: 11, key: 'hamiltonGrange', name: 'Hamilton Grange', lat: 40.82140, lon: -73.94710, mode: 'replace' },
    { id: 12, key: 'schomburg', name: 'Schomburg Center', lat: 40.81460, lon: -73.94075, mode: 'decorate' },
    { id: 13, key: 'abyssinian', name: 'Abyssinian Baptist Church', lat: 40.81635, lon: -73.94085, mode: 'replace' },
    { id: 14, key: 'whittierHall', name: 'Whittier Hall (Teachers College)', lat: 40.80987, lon: -73.95935, mode: 'decorate' },
    { id: 20, key: 'empireState', name: 'Empire State Building', lat: 40.74842, lon: -73.98566, mode: 'replace' },
    { id: 21, key: 'chrysler', name: 'Chrysler Building', lat: 40.75162, lon: -73.97550, mode: 'replace' },
    { id: 22, key: 'oneWTC', name: 'One World Trade Center', lat: 40.71274, lon: -74.01339, mode: 'replace' },
    { id: 23, key: 'thirtyRock', name: '30 Rockefeller Plaza', lat: 40.75874, lon: -73.97870, mode: 'replace' },
    { id: 24, key: 'flatiron', name: 'Flatiron Building', lat: 40.74106, lon: -73.98964, mode: 'replace' },
    { id: 25, key: 'metLife', name: 'MetLife Building', lat: 40.75410, lon: -73.97640, mode: 'replace' },
    { id: 26, key: 'woolworth', name: 'Woolworth Building', lat: 40.71240, lon: -74.00834, mode: 'replace' },
    { id: 27, key: 'oneVanderbilt', name: 'One Vanderbilt', lat: 40.75290, lon: -73.97869, mode: 'replace' },
    { id: 28, key: 'p432park', name: '432 Park Avenue', lat: 40.76160, lon: -73.97190, mode: 'replace' },
    { id: 29, key: 'cpTower', name: 'Central Park Tower', lat: 40.76632, lon: -73.98103, mode: 'replace' },
    { id: 30, key: 'steinway', name: '111 West 57th (Steinway)', lat: 40.76470, lon: -73.97760, mode: 'replace' },
    { id: 31, key: 'hearst', name: 'Hearst Tower', lat: 40.76655, lon: -73.98565, mode: 'replace' },
    { id: 32, key: 'citigroup', name: 'Citigroup Center', lat: 40.75880, lon: -73.97020, mode: 'replace' },
    { id: 33, key: 'unSecretariat', name: 'UN Secretariat', lat: 40.74900, lon: -73.96800, mode: 'replace' },
    { id: 34, key: 'grandCentral', name: 'Grand Central Terminal', lat: 40.75266, lon: -73.97733, mode: 'replace' },
    { id: 35, key: 'nypl', name: 'NY Public Library', lat: 40.75320, lon: -73.98220, mode: 'replace' },
    { id: 36, key: 'stPatricks', name: "St. Patrick's Cathedral", lat: 40.75850, lon: -73.97600, mode: 'replace' },
    { id: 37, key: 'trinityChurch', name: 'Trinity Church', lat: 40.70810, lon: -74.01200, mode: 'replace' },
    { id: 38, key: 'federalHall', name: 'Federal Hall', lat: 40.70740, lon: -74.01020, mode: 'replace' },
    { id: 39, key: 'nyse', name: 'NY Stock Exchange', lat: 40.70690, lon: -74.01130, mode: 'replace' },
    { id: 40, key: 'municipalBldg', name: 'Municipal Building', lat: 40.71270, lon: -74.00410, mode: 'replace' },
    { id: 41, key: 'p56leonard', name: '56 Leonard', lat: 40.71790, lon: -74.00480, mode: 'replace' },
    { id: 42, key: 'p8spruce', name: '8 Spruce Street', lat: 40.71100, lon: -74.00550, mode: 'replace' },
    { id: 43, key: 'msg', name: 'Madison Square Garden', lat: 40.75050, lon: -73.99340, mode: 'replace' },
    { id: 44, key: 'metMuseum', name: 'The Met', lat: 40.77940, lon: -73.96320, mode: 'replace' },
    { id: 45, key: 'guggenheim', name: 'Guggenheim Museum', lat: 40.78300, lon: -73.95900, mode: 'replace' },
    { id: 46, key: 'amnh', name: 'Museum of Natural History', lat: 40.78130, lon: -73.97400, mode: 'replace' },
    { id: 47, key: 'dakota', name: 'The Dakota', lat: 40.77650, lon: -73.97610, mode: 'decorate' },
    { id: 48, key: 'sanRemo', name: 'The San Remo', lat: 40.777914, lon: -73.975386, mode: 'replace' },
    { id: 49, key: 'plaza', name: 'The Plaza', lat: 40.76450, lon: -73.97440, mode: 'decorate' },
    { id: 50, key: 'waldorf', name: 'Waldorf Astoria', lat: 40.75640, lon: -73.97430, mode: 'decorate' },
    { id: 51, key: 'p40wall', name: '40 Wall Street', lat: 40.70740, lon: -74.00890, mode: 'replace' },
    { id: 52, key: 'p70pine', name: '70 Pine Street', lat: 40.70630, lon: -74.00740, mode: 'replace' },
    { id: 53, key: 'p28liberty', name: '28 Liberty', lat: 40.70805, lon: -74.00885, mode: 'replace' },
    { id: 54, key: 'seagram', name: 'Seagram Building', lat: 40.75850, lon: -73.97220, mode: 'replace' },
    { id: 55, key: 'leverHouse', name: 'Lever House', lat: 40.75980, lon: -73.97240, mode: 'replace' },
    { id: 56, key: 'metOpera', name: 'Metropolitan Opera House', lat: 40.77280, lon: -73.98430, mode: 'replace' },
    { id: 57, key: 'oneTimesSquare', name: 'One Times Square', lat: 40.75630, lon: -73.98660, mode: 'replace' },
    { id: 58, key: 'boaTower', name: 'Bank of America Tower', lat: 40.75550, lon: -73.98450, mode: 'replace' },
    { id: 59, key: 'p30hudson', name: '30 Hudson Yards', lat: 40.75390, lon: -74.00110, mode: 'replace' },
    { id: 60, key: 'one57', name: 'One57', lat: 40.76545, lon: -73.97875, mode: 'replace' },
    { id: 61, key: 'essexHouse', name: 'Essex House (160 Central Park South)', lat: 40.766182, lon: -73.978516, mode: 'decorate' },
    { id: 62, key: 'hampshireHouse', name: 'Hampshire House (150 Central Park South)', lat: 40.766044, lon: -73.977978, mode: 'decorate' },
    { id: 63, key: 'majestic', name: 'The Majestic (115 Central Park West)', lat: 40.775957, lon: -73.976454, mode: 'replace' },
    { id: 64, key: 'century', name: 'The Century (25 Central Park West)', lat: 40.770316, lon: -73.980561, mode: 'replace' },
    { id: 65, key: 'eldorado', name: 'The Eldorado (300 Central Park West)', lat: 40.788273, lon: -73.967478, mode: 'replace' },
    { id: 66, key: 'beresford', name: 'The Beresford (211 Central Park West)', lat: 40.782497, lon: -73.971690, mode: 'replace' },
    { id: 67, key: 'statueOfLiberty', name: 'Statue of Liberty (Liberty Enlightening the World), pedestal and Fort Wood', lat: 40.689266, lon: -74.044581, mode: 'replace' },
    { id: 68, key: 'libertyIslandBuilding', name: 'Liberty Island building (city/libertyIsland.js)', lat: 40.690849, lon: -74.046412, mode: 'replace' },
    { id: 70, key: 'tw220cps', name: '220 Central Park South', lat: 40.767050, lon: -73.980337, mode: 'replace' },
    { id: 71, key: 'twTimeWarner', name: 'Deutsche Bank Center (Time Warner Center)', lat: 40.768470, lon: -73.982969, mode: 'replace' },
    { id: 72, key: 'twGM', name: 'General Motors Building', lat: 40.763562, lon: -73.972301, mode: 'replace' },
    { id: 73, key: 'twSherry', name: 'The Sherry-Netherland', lat: 40.764318, lon: -73.972531, mode: 'replace' },
    { id: 74, key: 'twTrumpIntl', name: '1 Central Park West', lat: 40.769118, lon: -73.981570, mode: 'replace' },
    { id: 75, key: 'tw53w53', name: '53 West 53rd', lat: 40.761815, lon: -73.978094, mode: 'replace' },
    { id: 76, key: 'tw520park', name: '520 Park Avenue', lat: 40.764030, lon: -73.970024, mode: 'replace' },
    { id: 77, key: 'tw270park', name: '270 Park Avenue', lat: 40.755978, lon: -73.975968, mode: 'replace' },
    { id: 78, key: 'amnhNorth', name: 'Museum of Natural History, north side (Gilder Center, 81st Street terrace)', lat: 40.781899, lon: -73.974332, mode: 'replace' },
  ];
  const fix = { 23: [40.758977, -73.979196], 31: [40.766518, -73.983557], 32: [40.758504, -73.970086], 50: [40.756511, -73.973347], 60: [40.765590, -73.979071] };
  for (const l of list) if (fix[l.id]) { l.lat = fix[l.id][0]; l.lon = fix[l.id][1]; }
  // AR32C (landmarkSpec.js L122–126): the browser renames id 8's key; the compiled footprint
  // keeps its landmark id. Key change only — reproduced for completeness.
  const a = list.find((l) => l.id === 8);
  if (a) a.key = 'apolloTheaterAR32C';
  return list;
})();

// --- BUILDING_OVERRIDES — landmarkSpec.js L148–209 + pushes L219–L328 ------------
// A default browser load pushes every block (AR32C is the only one gated ON `location`;
// the rest are `!q || param !== '0'`). Fields per landmarkSpec.js L142–147: style (STYLE
// key), color [r,g,b], roofKind shape (0 flat, 1 gable, 2 hip), floors, floorH, winW,
// storeH, set/clear (BF names), wall/base (dresser-only), roof/memb (campus roof),
// landmarkId, height.
export const BUILDING_OVERRIDES = (() => {
  const list = [
    { key: 'muddHall', name: 'Seeley W. Mudd Hall (Columbia Engineering, 1961)', lat: 40.80939, lon: -73.96005,
      style: 'PROJECT_BRICK', color: [112, 60, 46], roofKind: 0, floors: 14, floorH: 4.6, winW: 1.8, storeH: 0,
      clear: ['CORNICE', 'WATERTOWER', 'STOREFRONT', 'SETBACKS', 'FIRE_ESCAPE'] },
    { key: 'schapiroCepsr', name: 'Schapiro CEPSR (Columbia, 1992)', lat: 40.809604, lon: -73.960750,
      style: 'POSTWAR_BRICK', color: [150, 78, 58], roofKind: 2, storeH: 0, roof: { form: 'mansard', tone: 'pale', dormers: 0 },
      clear: ['CORNICE', 'WATERTOWER', 'STOREFRONT', 'SETBACKS'] },
    { key: 'whittierHall', name: 'Whittier Hall (Teachers College, 1901): red brick, limestone base', lat: 40.80978, lon: -73.95914,
      style: 'PREWAR_APT', color: [158, 74, 52], roofKind: 0, storeH: 0, floors: 11, floorH: 3.65,
      set: ['CORNICE'], clear: ['STOREFRONT', 'WATERTOWER', 'FIRE_ESCAPE'] },
    { key: 'tcLowWing', name: 'Teachers College low wing on W 120th', lat: 40.80983, lon: -73.95953,
      style: 'PREWAR_APT', color: [158, 74, 52], roofKind: 0, storeH: 0, clear: ['STOREFRONT', 'WATERTOWER'] },
    { key: 'cuHavemeyer', name: 'Havemeyer Hall', lat: 40.809311, lon: -73.962214, roofKind: 2, roof: { form: 'mansard', tone: 'pale', dormers: 1, chimneys: 2 } },
    { key: 'cuSchermerhorn', name: 'Schermerhorn Hall', lat: 40.808560, lon: -73.960426, roofKind: 2, roof: { form: 'mansard', tone: 'mint', dormers: 0.8, chimneys: 2 } },
    { key: 'cuAvery', name: 'Avery Hall', lat: 40.808379, lon: -73.960863, roofKind: 2, roof: { form: 'hip', tone: 'mint', dormers: 0 } },
    { key: 'cuFayerweather', name: 'Fayerweather Hall (the chapel landmark had been placed here)', lat: 40.808131, lon: -73.960432, landmarkId: 0, roofKind: 2, roof: { form: 'hip', tone: 'mint', dormers: 0 } },
    { key: 'cuStPauls', name: "St. Paul's Chapel footprint (landmark builder)", lat: 40.807854, lon: -73.960942, landmarkId: 3 },
    { key: 'cuPhilosophy', name: 'Philosophy Hall', lat: 40.807489, lon: -73.960901, roofKind: 2, roof: { form: 'hip', tone: 'mint', dormers: 0.6, chimneys: 2 } },
    { key: 'cuBuell', name: "Buell Hall (1885): slate", lat: 40.807715, lon: -73.961427, roofKind: 2, roof: { form: 'hip', tone: 'slate', dormers: 0, pitch: 42 } },
    { key: 'cuEarl', name: 'Earl Hall: pale dome', lat: 40.808602, lon: -73.962707, roofKind: 2, roof: { form: 'dome', tone: 'lead' } },
    { key: 'cuMathematics', name: 'Mathematics Hall', lat: 40.809107, lon: -73.962674, roofKind: 2, roof: { form: 'hip', tone: 'mint', dormers: 0.6 } },
    { key: 'cuLewisohn', name: 'Lewisohn Hall', lat: 40.808349, lon: -73.963224, roofKind: 2, roof: { form: 'hip', tone: 'mint', dormers: 0.7 } },
    { key: 'cuJournalism', name: 'Pulitzer Hall (Journalism)', lat: 40.808064, lon: -73.963401, roofKind: 2, roof: { form: 'mansard', tone: 'pale', dormers: 1 } },
    { key: 'cuKent', name: 'Kent Hall', lat: 40.807235, lon: -73.961388, roofKind: 2, roof: { form: 'mansard', tone: 'pale', dormers: 1, chimneys: 2 } },
    { key: 'cuDodge', name: 'Dodge Hall', lat: 40.807530, lon: -73.963326, roofKind: 2, roof: { form: 'mansard', tone: 'mint', dormers: 1 } },
    { key: 'cuFurnald', name: 'Furnald Hall', lat: 40.807502, lon: -73.963830, roofKind: 2, roof: { form: 'mansard', tone: 'mint', dormers: 1.2, chimneys: 3 } },
    { key: 'cuHamilton', name: 'Hamilton Hall', lat: 40.806881, lon: -73.961770, roofKind: 2, roof: { form: 'mansard', tone: 'pale', dormers: 1, chimneys: 2 } },
    { key: 'cuHartley', name: 'Hartley Hall', lat: 40.806325, lon: -73.961760, roofKind: 2, roof: { form: 'mansard', tone: 'mint', dormers: 1.2, chimneys: 3 } },
    { key: 'cuWallach', name: 'Wallach Hall', lat: 40.806041, lon: -73.961968, roofKind: 2, roof: { form: 'mansard', tone: 'mint', dormers: 1.2, chimneys: 3 } },
    { key: 'cuJohnJay', name: 'John Jay Hall', lat: 40.805905, lon: -73.962362, roofKind: 2, roof: { form: 'mansard', tone: 'mint', dormers: 1.2, chimneys: 4 } },
    { key: 'cuPupin', name: 'Pupin Hall: copper with the Rutherfurd Observatory domes', lat: 40.809925, lon: -73.961203, roofKind: 2, roof: { form: 'mansard', tone: 'mint', dormers: 0.6, domes: 2 } },
    { key: 'cuNwCorner', name: 'Northwest Corner Building', lat: 40.810180, lon: -73.961882, roofKind: 0, roof: { form: 'flat' } },
    { key: 'cuFairchild', name: 'Sherman Fairchild Center', lat: 40.809139, lon: -73.960331, roofKind: 0, roof: { form: 'flat' } },
    { key: 'cuEngTerrace', name: 'Engineering Terrace', lat: 40.809040, lon: -73.959845, roofKind: 0, roof: { form: 'flat' } },
    { key: 'cuSchermerhornExt', name: 'Schermerhorn Extension', lat: 40.808653, lon: -73.960064, roofKind: 0, roof: { form: 'flat' } },
    { key: 'cuUris', name: 'Uris Hall', lat: 40.809021, lon: -73.961266, roofKind: 0, roof: { form: 'flat' } },
    { key: 'cuChandler', name: 'Chandler Hall', lat: 40.809612, lon: -73.962291, roofKind: 0, roof: { form: 'flat' } },
    { key: 'cuAveryPlaza', name: 'the plaza over the Avery extension', lat: 40.808294, lon: -73.960603, roofKind: 0, memb: 3, roof: { form: 'flat' } },
    { key: 'cuLerner', name: 'Alfred Lerner Hall', lat: 40.806864, lon: -73.963942, roofKind: 0, roof: { form: 'flat' } },
    { key: 'cuCarman', name: 'Carman Hall', lat: 40.806719, lon: -73.964391, roofKind: 0, roof: { form: 'flat' } },
    { key: 'amst1225', name: 'NE corner: 1225 Amsterdam, tan pre-war apartments over Appletree Market', lat: 40.80945, lon: -73.95873,
      style: 'PREWAR_APT', color: [196, 172, 132], wall: 'brickTan', base: { wall: 'limestone', floors: 2 }, roofKind: 0, set: ['CORNICE'], clear: ['FIRE_ESCAPE', 'STOREFRONT'] },
    { key: 'amstSE120', name: 'SE corner: 1217-1219 Amsterdam, buff brick over a limestone base, Hartley Chemist', lat: 40.80897, lon: -73.95900,
      style: 'PREWAR_APT', color: [190, 166, 128], wall: 'brickTan', base: { wall: 'limestone', floors: 3 }, roofKind: 0, set: ['CORNICE'], clear: ['FIRE_ESCAPE', 'STOREFRONT'] },
  ];
  // L219–228 — AR32C: the only `q &&`-gated block (skipped by a literal node import);
  // a default browser pushes it, so this port does too.
  list.push(
    { key: 'ar32cShopRow', name: 'shop row at 125th St and ACP Blvd (not the Theresa)', lat: 40.808924, lon: -73.949173, landmarkId: 0 },
    { key: 'ar32cTheresa', name: 'Hotel Theresa (1913, George & Edward Blum): white terracotta, 13 storeys', lat: 40.808761, lon: -73.948930,
      landmarkId: -9, color: [226, 223, 214], wall: 'limestone' },
    { key: 'ar32cWestOfAcp', name: 'block west of ACP Blvd (not the State Office Building)', lat: 40.809595, lon: -73.948399, landmarkId: 0 },
    { key: 'ar32cStateOffice', name: 'Adam Clayton Powell Jr. State Office Building (1973), 19 storeys', lat: 40.809219, lon: -73.947423, landmarkId: -10 },
    { key: 'ar32cApollo', name: 'Apollo Theater lobby, 253 W 125th St', lat: 40.809923, lon: -73.950126, clear: ['STOREFRONT'] },
  );
  // L243–252 — CP33
  list.push(
    { key: 'cp33SanRemo', name: 'The San Remo, 145-146 Central Park West (tile -1_1 #13)', lat: 40.777914, lon: -73.975386, landmarkId: 48 },
    { key: 'cp33NotSanRemo', name: 'the 18-storey block at Columbus and W 73rd that id 48 had replaced (tile -1_1 #36)', lat: 40.775502, lon: -73.976816, landmarkId: 0 },
    { key: 'cp33NotOne57', name: 'the 9-storey building beside One57 that id 60 had replaced (tile -2_3 #81)', lat: 40.765646, lon: -73.978591, landmarkId: 0 },
    { key: 'cp33Plaza', name: 'The Plaza (1907): white glazed brick and marble', lat: 40.764439, lon: -73.974378, color: [236, 232, 222], wall: 'limestone',
      clear: ['SETBACKS'] },
    { key: 'cp33Essex', name: 'Essex House (1931): the roof sign', lat: 40.766182, lon: -73.978516, landmarkId: -61 },
    { key: 'cp33Hampshire', name: 'Hampshire House (1937): the steep copper roof with its chimneys (city/lmPlaza.js)', lat: 40.766089, lon: -73.977909,
      landmarkId: -62, clear: ['SETBACKS'] },
  );
  // L258–263 — CW38
  list.push(
    { key: 'cw38Majestic', name: 'The Majestic, 115 Central Park West (tile -1_1 #6)', lat: 40.775957, lon: -73.976454, landmarkId: 63 },
    { key: 'cw38Century', name: 'The Century, 25 Central Park West (tile -2_2 #22)', lat: 40.770316, lon: -73.980561, landmarkId: 64 },
    { key: 'cw38Eldorado', name: 'The Eldorado, 300 Central Park West (tile 0_-2 #73)', lat: 40.788273, lon: -73.967478, landmarkId: 65 },
    { key: 'cw38Beresford', name: 'The Beresford, 211 Central Park West (tile -1_0 #175)', lat: 40.782497, lon: -73.971690, landmarkId: 66 },
  );
  // L270–273 — LM16 AMNH
  list.push(
    { key: 'lm16Amnh', name: 'American Museum of Natural History, 77th Street to the Rose Center (tile -1_0 #82)', lat: 40.781112, lon: -73.974907, landmarkId: 46 },
    { key: 'lm16AmnhNorth', name: 'AMNH north side: Gilder Center, 81st Street terrace (tile -1_0 #211)', lat: 40.781899, lon: -73.974332, landmarkId: 78 },
  );
  // L279–285 — LB39
  list.push(
    { key: 'lb39Liberty', name: 'Fort Wood under the Statue of Liberty (tile -13_20)', lat: 40.689266, lon: -74.044581, landmarkId: 67 },
    ...[[40.69039, -74.046758], [40.690731, -74.047042], [40.689683, -74.044913], [40.689867, -74.04714], [40.690849, -74.046412],
      [40.69049, -74.046494], [40.689993, -74.046065], [40.690506, -74.04694], [40.689622, -74.046235], [40.689741, -74.044259]]
      .map(([lat, lon], i) => ({ key: 'lb39Island' + i, name: 'Liberty Island compiled footprint (city/libertyIsland.js draws the island)', lat, lon, landmarkId: 68 })),
  );
  // L294–313 — TW landmark ids
  list.push(
    { key: 'twOne57', name: 'One57 (tile -2_3 #13)', lat: 40.765590, lon: -73.979071, landmarkId: 60 },
    { key: 'twHearst', name: 'Hearst Tower, 959 Eighth Avenue (tile -3_3 #212)', lat: 40.766518, lon: -73.983557, landmarkId: 31 },
    { key: 'twNotHearst', name: '347 W 55th St, which id 31 had replaced (tile -3_3 #126)', lat: 40.766393, lon: -73.985586, landmarkId: 0 },
    { key: 'twCitigroup', name: 'Citigroup Center, 601 Lexington (tile 0_5 #208)', lat: 40.758504, lon: -73.970086, landmarkId: 32 },
    { key: 'twNotCitigroup', name: '641 Lexington, which id 32 had replaced (tile 0_5 #51)', lat: 40.758986, lon: -73.969887, landmarkId: 0 },
    { key: 'twWaldorf', name: 'Waldorf Astoria, 301 Park (tile -1_5 #82)', lat: 40.756511, lon: -73.973347, landmarkId: -50 },
    { key: 'twNotWaldorf', name: '299 Park, which id 50 had decorated (tile -1_5 #20)', lat: 40.756039, lon: -73.974177, landmarkId: 0 },
    { key: 'tw30Rock', name: '30 Rockefeller Plaza (tile -2_5 #177; #179 in runs 7-9)', lat: 40.758977, lon: -73.979196, landmarkId: 23, height: 259, floors: 70 },
    { key: 'twNot30Rock', name: 'the 4.6 m building id 23 had replaced (tile -2_5 #169)', lat: 40.758856, lon: -73.978291, landmarkId: 0 },
    { key: 'twNot30Rock7', name: 'the 3.7 m building id 23 fell to in runs 7-9 (tile -2_5 #178)', lat: 40.758458, lon: -73.978577, landmarkId: 0 },
    { key: 'tw220cps', name: '220 Central Park South (tile -2_3 #57)', lat: 40.767050, lon: -73.980337, landmarkId: 70 },
    { key: 'twTimeWarner', name: 'Deutsche Bank Center (tile -2_3 #4)', lat: 40.768470, lon: -73.982969, landmarkId: 71 },
    { key: 'twGM', name: 'General Motors Building (tile -1_4 #56)', lat: 40.763562, lon: -73.972301, landmarkId: 72 },
    { key: 'twSherry', name: 'The Sherry-Netherland (tile -1_4 #147)', lat: 40.764318, lon: -73.972531, landmarkId: 73 },
    { key: 'twTrumpIntl', name: '1 Central Park West (tile -2_3 #14)', lat: 40.769118, lon: -73.981570, landmarkId: 74 },
    { key: 'tw53w53', name: '53 West 53rd (LF39, BIN 1090777)', lat: 40.761815, lon: -73.978094, landmarkId: 75 },
    { key: 'tw520park', name: '520 Park Avenue (tile 0_4 #194)', lat: 40.764030, lon: -73.970024, landmarkId: 76 },
    { key: 'tw270park', name: '270 Park Avenue (tile -1_5 #106)', lat: 40.755978, lon: -73.975968, landmarkId: 77 },
  );
  // L315–317 — TW_TOWERS colour/style (tkOverrides.js; entries with neither — plaza — skipped)
  const TW_TOWERS = [
    { key: 'essexHouse', lat: 40.766180, lon: -73.978513, color: [186, 160, 132] },
    { key: 'hampshireHouse', lat: 40.766061, lon: -73.977898, color: [222, 216, 204] },
    { key: 'parkLane', lat: 40.764861, lon: -73.975382, color: [222, 218, 208] },
    { key: 'trumpParc', lat: 40.765721, lon: -73.977057, color: [196, 160, 124] },
    { key: 'metTower', lat: 40.764767, lon: -73.979201, color: [40, 42, 46], style: 'MODERN_GLASS' },
    { key: 'carnegieTower', lat: 40.764778, lon: -73.979625, color: [150, 88, 66] },
    { key: 'citySpire', lat: 40.764190, lon: -73.979520, color: [204, 186, 158] },
    { key: 'cpw15', lat: 40.770040, lon: -73.981744, color: [216, 206, 186] },
    { key: 'cpw15house', lat: 40.769689, lon: -73.981013, color: [216, 206, 186] },
    { key: 'solow', lat: 40.763881, lon: -73.975007, color: [60, 62, 66], style: 'MODERN_GLASS' },
    { key: 'trumpTower', lat: 40.762343, lon: -73.973816, color: [52, 44, 38], style: 'MODERN_GLASS' },
    { key: 'cps240', lat: 40.767312, lon: -73.981272, color: [160, 98, 74] },
    { key: 'cps200', lat: 40.766777, lon: -73.979680, color: [220, 214, 202] },
  ];
  for (const t of TW_TOWERS) {
    if (t.color || t.style) {
      list.push({ key: `tw:${t.key}`, lat: t.lat, lon: t.lon, ...(t.color ? { color: t.color } : {}), ...(t.style ? { style: t.style } : {}) });
    }
  }
  // L326–328 — MET16
  list.push({ key: 'lm16Met', name: 'The Metropolitan Museum of Art (city/lmMetMuseum.js)', lat: 40.77940, lon: -73.96320, landmarkId: 44 });
  return list;
})();

// --- tiledata.js L3–15 ---------------------------------------------------------
// RW13 window-width bridge and the RTO table — both gated off upstream by ?rw13=0 / ?rto=0,
// both ON in this port (the default browser behaviour).
const RW13 = true;
const rw13WinW = (style, w) => (RW13 && style === 5 && w >= 2.3 ? 1.75 : w);
const RT_OVR = BUILDING_OVERRIDES.map((o) => { const [x, z] = project(o.lon, o.lat); return { o, x, z }; });

// tiledata.js L16–23 — XZ tile-local, ox/oz the tile origin; (x,z) the world-space probe point.
function inRing(XZ, start, len, ox, oz, x, z) {
  let inside = false;
  for (let i = 0, j = len - 1; i < len; j = i++) {
    const xi = XZ[(start + i) * 2] + ox, zi = XZ[(start + i) * 2 + 1] + oz;
    const xj = XZ[(start + j) * 2] + ox, zj = XZ[(start + j) * 2 + 1] + oz;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
// tiledata.js L24–42 — mutates the decoded record. `wall`/`baseWall`/`baseFloors`/`campusRoof`
// are upstream runtime dresser fields; kept on the record for fidelity, unused downstream.
function applyReadOverride(b, o) {
  if (o.style && STYLE[o.style] != null) b.style = STYLE[o.style];
  if (o.color) { b.r = o.color[0]; b.g = o.color[1]; b.b = o.color[2]; }
  if (o.roofKind != null) b.roofKind = (b.roofKind & ~7) | o.roofKind;
  for (const f of o.set || []) if (BF[f]) b.flags |= BF[f];
  for (const f of o.clear || []) if (BF[f]) b.flags &= ~BF[f];
  if (o.floors) b.floors = o.floors;
  if (o.floorH) b.floorH = o.floorH;
  if (o.winW) b.winW = o.winW;
  if (o.storeH != null) b.storeH = o.storeH;
  if (o.wall) b.wall = o.wall;
  if (o.base) { b.baseWall = o.base.wall; b.baseFloors = o.base.floors; }
  if (o.roof) b.campusRoof = o.roof;
  if (o.memb != null) b.roofKind = (b.roofKind & ~24) | ((o.memb & 3) << 3);
  if (o.landmarkId != null) b.landmarkId = o.landmarkId;
  if (o.height) b.height = o.height;
}

// --- tiledata.js L44–57 ---------------------------------------------------------
const MAGIC = 0x43544c31;
const CTORS = { Float32Array, Uint8Array, Uint32Array, Int16Array, Uint16Array };
export function parseTile(buf) {
  const dv = new DataView(buf);
  const magic = dv.getUint32(0, true);
  if (magic !== MAGIC) throw new Error('bad tile magic');
  const hLen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hLen)));
  const base = 8 + hLen + ((4 - ((8 + hLen) % 4)) % 4);
  const S = {};
  for (const s of header.sections) {
    const C = CTORS[s.type];
    if (!C) throw new Error(`unknown section type ${s.type}`); // fail on unknown section type (spec §5.1)
    S[s.name] = new C(buf, base + s.offset, s.length);
  }
  return { header, S };
}

// --- tiledata.js L59–84 ---------------------------------------------------------
// Record layout (compile.mjs L5809–5825): u32 start, u16 len, i16 landmarkId, f32 baseY,
// f32 height, u8 floors, u8 style, u8 r,g,b, u8 roofKind, u8 flags, u8 lit, f32 floorH,
// f32 winW, f32 storeH, u32 blind, u16 area, u8 colorVar, u8 frontIdx+1.
export function* buildingsOf(tile) {
  const meta = tile.S.bldg;
  const dv = new DataView(meta.buffer, meta.byteOffset, meta.byteLength);
  const n = meta.byteLength / 44;
  // overrides whose point falls near this tile (a footprint may reach a little past its tile's square)
  const org = tile.header && tile.header.origin;
  const near = org ? RT_OVR.filter((r) => r.x > org[0] - 150 && r.x < org[0] + 662 && r.z > org[1] - 150 && r.z < org[1] + 662) : [];
  for (let i = 0; i < n; i++) {
    const o = i * 44;
    const b = {
      i,
      start: dv.getUint32(o, true), len: dv.getUint16(o + 4, true),
      landmarkId: dv.getInt16(o + 6, true),
      baseY: dv.getFloat32(o + 8, true), height: dv.getFloat32(o + 12, true),
      floors: dv.getUint8(o + 16), style: dv.getUint8(o + 17),
      r: dv.getUint8(o + 18), g: dv.getUint8(o + 19), b: dv.getUint8(o + 20),
      roofKind: dv.getUint8(o + 21), flags: dv.getUint8(o + 22), lit: dv.getUint8(o + 23) / 255,
      floorH: dv.getFloat32(o + 24, true), winW: rw13WinW(dv.getUint8(o + 17), dv.getFloat32(o + 28, true)),   // RW13
      storeH: dv.getFloat32(o + 32, true), blind: dv.getUint32(o + 36, true),
      area: dv.getUint16(o + 40, true), colorVar: dv.getUint8(o + 42) / 255,
      frontIdx: dv.getUint8(o + 43) - 1, // -1 = unknown (old tiles / no street frontage)
    };
    for (const r of near) if (inRing(tile.S.bldgXZ, b.start, b.len, org[0], org[1], r.x, r.z)) applyReadOverride(b, r.o);
    yield b;
  }
}
// tiledata.js L90–107 — Map parentIndex -> [{start,len,flags,area}]
export function holesOf(tile) {
  const m = new Map();
  const meta = tile.S.bholes;
  if (!meta || !meta.byteLength) return m;
  const dv = new DataView(meta.buffer, meta.byteOffset, meta.byteLength);
  const n = (meta.byteLength / 12) | 0;
  for (let i = 0; i < n; i++) {
    const o = i * 12;
    const b = dv.getUint32(o, true);
    let a = m.get(b);
    if (!a) m.set(b, (a = []));
    a.push({
      start: dv.getUint32(o + 4, true), len: dv.getUint16(o + 8, true),
      flags: dv.getUint8(o + 10), area: dv.getUint8(o + 11) * 4,
    });
  }
  return m;
}
// tiledata.js L108–125 — yields start/len; the caller slices roadVerts triplets (tile-local).
export function* roadsOf(tile) {
  const meta = tile.S.roads;
  if (!meta || !meta.byteLength) return;
  const dv = new DataView(meta.buffer, meta.byteOffset, meta.byteLength);
  const n = meta.byteLength / 24;
  for (let i = 0; i < n; i++) {
    const o = i * 24;
    yield {
      start: dv.getUint32(o, true), len: dv.getUint16(o + 4, true),
      rclass: dv.getUint8(o + 6) & 0x7f, noTraffic: !!(dv.getUint8(o + 6) & 0x80), oneway: dv.getInt8(o + 7),
      width: dv.getFloat32(o + 8, true),
      lanes: dv.getUint8(o + 12), park: dv.getUint8(o + 13),
      level: dv.getUint8(o + 14), speed: dv.getUint8(o + 15),
      nameIdx: dv.getUint16(o + 16, true), segId: dv.getUint32(o + 20, true),
      mouthA: dv.getUint8(o + 18) / 4, mouthB: dv.getUint8(o + 19) / 4,
    };
  }
}
// tiledata.js L126–139 — x/z tile-local (writer subtracts origin, compile.mjs L5864–5866), y absolute.
export function* furnitureOf(tile) {
  const meta = tile.S.furn;
  if (!meta || !meta.byteLength) return;
  const dv = new DataView(meta.buffer, meta.byteOffset, meta.byteLength);
  const n = meta.byteLength / 20;
  for (let i = 0; i < n; i++) {
    const o = i * 20;
    yield {
      k: dv.getUint8(o), p0: dv.getUint8(o + 1), p1: dv.getUint8(o + 2), p2: dv.getUint8(o + 3),
      x: dv.getFloat32(o + 4, true), y: dv.getFloat32(o + 8, true), z: dv.getFloat32(o + 12, true),
      rot: dv.getFloat32(o + 16, true),
    };
  }
}

// --- nyc-mon reprojection -------------------------------------------------------
// projectToScene duplicated from packages/core/world/transform.ts L36–41 — same convention
// as tooling/city/build.mjs L28–32 ("bit-for-bit identical"; tooling runs under plain Node
// and cannot import the TS package). decode.test.mjs pins this arithmetic to transform.ts.
const R_M = 6_371_008.8;
export const ORIGIN = { longitude: -73.94975, latitude: 40.81005 }; // data/harlem-apollo.json L1
export const EXTENT_METERS = 850; // data/harlem-apollo.json L1 extentMeters
const projectToScene = (position, origin) => ({
  x: (position.longitude - origin.longitude) * DEG * R_M * Math.cos(origin.latitude * DEG),
  z: -(position.latitude - origin.latitude) * DEG * R_M,
});
// Valdrada world (x,z) -> WGS84 via geo.js inverse -> nyc-mon scene metres, rounded to the
// repo's 0.1 m standard (city-world.md; build.mjs L60).
export const toScene = (x, z) => {
  const [lon, lat] = unproject(x, z);
  const p = projectToScene({ longitude: lon, latitude: lat }, ORIGIN);
  return [round1(p.x), round1(p.z)];
};
// Intentionally WRONG transform kept as the N3 negative control: treats Valdrada metres as
// scene metres after a pure translation. Valdrada's m/deg constants differ from
// transform.ts's (84,290 vs 84,161 lon; 111,132 vs 111,195 lat), so it is off by >0.5 m
// well inside the square.
export const toSceneNaive = (x, z) => {
  const [ox, oz] = project(ORIGIN.longitude, ORIGIN.latitude);
  return [round1(x - ox), round1(z - oz)];
};

// Tile ids covering the square centred on ORIGIN with the given half-extent, in Valdrada
// tile space. fetch.mjs uses this; the 850 m tile + 40 m margin needs x 1..5 × z −8..−5
// (20 tiles) — coverage verified in the P0 findings doc.
export function tileIdsForSquare(halfExtentMeters = EXTENT_METERS, margin = 40) {
  const [ox, oz] = project(ORIGIN.longitude, ORIGIN.latitude);
  const half = halfExtentMeters + margin;
  const tx0 = Math.floor((ox - half) / TILE), tz0 = Math.floor((oz - half) / TILE);
  const tx1 = Math.floor((ox + half) / TILE), tz1 = Math.floor((oz + half) / TILE);
  const ids = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let tz = tz0; tz <= tz1; tz++) ids.push(`t_${tx}_${tz}`);
  return ids;
}

// Slice a ring out of bldgXZ and move it to Valdrada world space (pairs are tile-local;
// start/len are PAIR indices, compile.mjs L5836).
const worldRing = (XZ, start, len, org) => {
  const out = new Array(len);
  for (let i = 0; i < len; i++) out[i] = [XZ[(start + i) * 2] + org[0], XZ[(start + i) * 2 + 1] + org[1]];
  return out;
};

// Full decode of one tile for the bake: parse, apply read-time overrides (inside
// buildingsOf), attach geometry, reproject to nyc-mon scene metres.
export function decodeTile(buf) {
  const tile = parseTile(buf);
  if (tile.header.v !== 1) throw new Error(`unknown tile version ${tile.header.v}`);
  const [ox, oz] = tile.header.origin;
  const holesByB = holesOf(tile);
  const names = tile.header.names || [];
  const buildings = [...buildingsOf(tile)].map((b) => ({
    ...b,
    ring: worldRing(tile.S.bldgXZ, b.start, b.len, tile.header.origin).map(([x, z]) => toScene(x, z)),
    holes: (holesByB.get(b.i) ?? []).map((h) => ({
      flags: h.flags, area: h.area,
      ring: worldRing(tile.S.bldgXZ, h.start, h.len, tile.header.origin).map(([x, z]) => toScene(x, z)),
    })),
  }));
  const V = tile.S.roadVerts;
  const roads = [...roadsOf(tile)].map((r) => ({
    ...r,
    name: names[r.nameIdx] || '',
    pts: Array.from({ length: r.len }, (_, j) => {
      const [x, z] = toScene(V[(r.start + j) * 3] + ox, V[(r.start + j) * 3 + 2] + oz);
      return [x, V[(r.start + j) * 3 + 1], z];
    }),
  }));
  const furniture = [...furnitureOf(tile)].map((f) => {
    const [x, z] = toScene(f.x + ox, f.z + oz);
    return { ...f, x, z };
  });
  let terrain = null;
  if (tile.S.terrain) {
    let min = Infinity, max = -Infinity;
    for (const v of tile.S.terrain) { if (v < min) min = v; if (v > max) max = v; }
    terrain = { res: tile.header.res | 0, nodes: (tile.header.res | 0) + 1, minY: round1(min), maxY: round1(max) };
  }
  return { key: `t_${tile.header.tx}_${tile.header.tz}`, origin: tile.header.origin, names, buildings, roads, furniture, terrain, tile };
}
