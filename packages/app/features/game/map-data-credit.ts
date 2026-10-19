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
