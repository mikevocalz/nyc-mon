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
  // vd-storefronts.ts, vd-facade-specs.ts and vd-heroes.ts carry Valdrada's measured 125th Street specs (shop signs
  // and colours, wall materials and tints, floor pitch, the four landmark fronts); MIT asks for the copyright notice.
  {
    attribution: '125th Street storefronts, facade materials and landmark fronts measured by Valdrada v0.4.0, © 2026 Mehmet Kerem Turkcan',
    license: 'MIT',
    licenseUrl: 'https://opensource.org/license/mit',
  },
  {
    attribution: 'Park Avenue Viaduct tracks, © OpenStreetMap contributors, via Valdrada',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
];
