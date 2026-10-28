import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { CITY_MAP_DERIVED, CITY_MAP_SOURCES } from './map-data-credit.ts';

const city = JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')) as {
  id: string;
  sources: { attribution: string; license: string; licenseUrl: string }[];
  license?: string;
  licenseUrl?: string;
  licenseNotice?: string;
};

test('Settings map-data credits equal the bundled city sources', () => {
  assert.deepEqual(
    CITY_MAP_SOURCES.map((s) => ({ attribution: s.attribution, license: s.license, licenseUrl: s.licenseUrl })),
    city.sources.map((s) => ({ attribution: s.attribution, license: s.license, licenseUrl: s.licenseUrl })),
  );
});

test('the derived-database credit equals the tile licence grant (ODbL §4.4a)', () => {
  assert.equal(city.license, 'ODbL-1.0');
  assert.equal(city.licenseUrl, 'https://opendatacommons.org/licenses/odbl/1-0/');
  assert.equal(CITY_MAP_DERIVED.license, city.license);
  assert.equal(CITY_MAP_DERIVED.licenseUrl, city.licenseUrl);
  assert.ok(CITY_MAP_DERIVED.attribution.includes(city.id));
  assert.match(city.licenseNotice ?? '', /Derivative Database/);
  assert.match(city.licenseNotice ?? '', /ODbL/);
});

test('the shared Settings screen renders every map-data source and licence link', () => {
  const settings = readFileSync(new URL('../settings/settings-content.tsx', import.meta.url), 'utf8');
  assert.match(settings, /Legal &amp; credits/);
  assert.match(settings, /CITY_MAP_SOURCES/);
  assert.match(settings, /licenseUrl/);
});

test('the 3D game screen mounts the on-map attribution (data/README: any map surface displays it)', () => {
  const game = readFileSync(new URL('./GameScreen.tsx', import.meta.url), 'utf8');
  assert.match(game, /MapAttribution/);
});
