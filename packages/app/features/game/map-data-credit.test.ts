import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { CITY_MAP_SOURCES } from './map-data-credit.ts';

const city = JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')) as {
  sources: { attribution: string; license: string; licenseUrl: string }[];
};

test('Settings map-data credits equal the bundled city sources', () => {
  assert.deepEqual(
    CITY_MAP_SOURCES.map((s) => ({ attribution: s.attribution, license: s.license, licenseUrl: s.licenseUrl })),
    city.sources.map((s) => ({ attribution: s.attribution, license: s.license, licenseUrl: s.licenseUrl })),
  );
});

test('the shared Settings screen renders every map-data source and licence link', () => {
  const settings = readFileSync(new URL('../settings/settings-content.tsx', import.meta.url), 'utf8');
  assert.match(settings, /Legal &amp; credits/);
  assert.match(settings, /CITY_MAP_SOURCES/);
  assert.match(settings, /licenseUrl/);
});

test('the 3D game screen does not mount an OpenStreetMap HUD label', () => {
  const game = readFileSync(new URL('./GameScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(game, /MapAttribution/);
});
