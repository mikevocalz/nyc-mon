// Lightweight map-data credits for Settings. Avoid importing the 1 MB city
// dataset (and its GPU/world dependencies) into the shared settings screen.
// map-data-credit.test.ts asserts these entries equal the bundled tile's
// `sources` (schema v3), so the list must be regenerated when the tile is.
export interface CityMapSourceCredit {
  readonly attribution: string;
  readonly license: string;
  readonly licenseUrl: string;
}

export const CITY_MAP_SOURCES: readonly CityMapSourceCredit[] = [
  {
    attribution: '© OpenStreetMap contributors',
    license: 'ODbL-1.0',
    licenseUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    attribution: 'Valdrada v0.4.0 (commit 2724c79), Mehmet Kerem Turkcan',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
  {
    attribution: 'NYC Building Footprints (DOITT), via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: 'PLUTO (NYC Planning), via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: 'DOB NOW Facades compliance filings (FISP/Local Law 11), via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: 'NYC Street Centerline (CSCL), via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: '2015 Street Tree Census (NYC Parks), via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: 'NYCDEP Citywide Hydrants, via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: 'NYC Bus Stop Shelters, via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: 'LinkNYC Kiosks, via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: 'NYC DOT Bicycle Parking (CityRacks), via Valdrada',
    license: 'NYC Open Data Terms of Use',
    licenseUrl: 'https://opendata.cityofnewyork.us/overview/',
  },
  {
    attribution: 'MTA Subway Entrances and Exits (2024), via Valdrada',
    license: 'NY Open Data Terms of Use',
    licenseUrl: 'https://data.ny.gov/',
  },
];

// Map data that streams in on demand rather than shipping in the bundled tile: the far tier's L4/L6 chunks and
// landmark silhouettes (world/vd-port/far-tier), baked from the Valdrada tile set at
// huggingface.co/datasets/mehmetkeremturkcan/valdrada rev 09b583662e760b5976d636d341d0e5f81a7c7fcf and served through
// the cell source (world/cell-source, hash-pinned per file). Derivative works of the tile set: ODbL 1.0 rides along.
export const CITY_MAP_STREAMED: readonly CityMapSourceCredit[] = [
  {
    attribution: 'Valdrada far-tier chunks and landmarks (rev 09b5836), Mehmet Kerem Turkcan',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
  {
    // ring 1 (Columbia / Morningside Heights / Grant's Tomb / Riverside Church): the ring's block near/lite cells
    // (world/vd-port/blocks/data-ring1) and lane-C structure cells (furniture/cells/ring1) bake from the same pinned
    // tile set and stream through the same hash-pinned cell source (ring1-*/structures-ring1 manifest keys)
    attribution: 'Valdrada ring-1 near and structure cells (rev 09b5836), Mehmet Kerem Turkcan',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
  {
    // ring 2 (City College / Hamilton Heights / Hamilton Grange): the ring's block near/lite cells
    // (world/vd-port/blocks/data-ring2) and lane-C structure cells (furniture/cells/ring2) bake from the same pinned
    // tile set and stream through the same hash-pinned cell source (ring2-*/structures-ring2 manifest keys)
    attribution: 'Valdrada ring-2 near and structure cells (rev 09b5836), Mehmet Kerem Turkcan',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
  {
    // ring 3 (Central Park north / Harlem Meer / the Conservatory Garden): the ring's block near/lite cells
    // (world/vd-port/blocks/data-ring3) and lane-C structure cells (furniture/cells/ring3) bake from the same pinned
    // tile set and stream through the same hash-pinned cell source (ring3-*/structures-ring3 manifest keys)
    attribution: 'Valdrada ring-3 near and structure cells (rev 09b5836), Mehmet Kerem Turkcan',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
];

// ODbL §4.4(a): the bundled tile is itself a Derivative Database of the
// ODbL sources above — its own licence grant sits beside the source
// licences. map-data-credit.test.ts asserts this equals the tile's
// top-level licence fields.
export const CITY_MAP_DERIVED: CityMapSourceCredit = {
  attribution: 'harlem-apollo-20261017 (Derivative Database)',
  license: 'ODbL-1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
};

// Bundled model/texture assets, separate from the map-data records above:
// the vd lane ships compiled tree and car models and baked textures
// (vd-trees.ts, vd-cars.ts, vd-textures.ts). CC BY requires the author
// credit in-app.
export const CITY_MAP_ASSETS: readonly CityMapSourceCredit[] = [
  {
    attribution: 'Street tree models (Valdrada bxtrees), M. K. Turkcan',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    attribution: 'Car models (Lincoln, SUV, van, Mercedes, Charger), CARLA Simulator (carla.org), via Valdrada',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    attribution: 'Taxi model (Nissan NV200), memoov on Sketchfab, TLC build by Valdrada',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    attribution: 'Leaf textures (ambientCG), via Valdrada',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    attribution: 'Wall and ground surface textures, via Valdrada',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    // world/vd-port: the 125th Street buildings, landmarks, storefronts and street furniture are baked from Valdrada's
    // own kits (client/src/city: the facade kit, landmarks.js, the w125 area parts, the furniture kits), its persistent
    // tier format and far material, and its far window grid texture (textures/far_windows_fw14.png)
    attribution: 'Valdrada v0.4.0 (commit 2724c79) city kits, shaders and far window texture, Mehmet Kerem Turkcan',
    license: 'MIT',
    licenseUrl: 'https://github.com/mkturkcan/valdrada/blob/main/LICENSE',
  },
  {
    // the far tier's Statue of Liberty silhouette (valdrada-public NOTICE_liberty.md): derived from jerryfisher's
    // photogrammetry scan of a 19th-century bronze, via Objaverse 1.0
    attribution: 'Statue of Liberty model, jerryfisher (Sketchfab), via Objaverse and Valdrada',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    // the far tier's bridge silhouettes and the Liberty pedestal/island geometry are built from the Historic American
    // Engineering Record's measured drawings (HAER NY-138, public domain)
    attribution: 'Bridge and Statue of Liberty site geometry from HAER NY-138 drawings, via Valdrada',
    license: 'Public domain',
    licenseUrl: 'https://www.loc.gov/pictures/item/ny1254/',
  },
  {
    attribution: 'meshoptimizer decoder (reference implementation), Arseny Kapoulkine and Jasper St. Pierre',
    license: 'MIT',
    licenseUrl: 'https://github.com/zeux/meshoptimizer/blob/master/LICENSE.md',
  },
];
