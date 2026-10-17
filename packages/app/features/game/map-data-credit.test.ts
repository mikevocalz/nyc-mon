import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { CITY_MAP_ATTRIBUTION, CITY_MAP_LICENSE, CITY_MAP_LICENSE_URL } from './map-data-credit.ts';

const city = JSON.parse(readFileSync(new URL('./data/harlem-apollo.json', import.meta.url), 'utf8')) as {
  source: { attribution: string; license: string };
};

test('Settings map-data credits match the bundled city provenance', () => {
  assert.equal(CITY_MAP_ATTRIBUTION, city.source.attribution);
  assert.equal(CITY_MAP_LICENSE, city.source.license);
  assert.equal(CITY_MAP_LICENSE_URL, 'https://www.openstreetmap.org/copyright');
});

test('the shared Settings screen contains the map-data credit and copyright link', () => {
  const settings = readFileSync(new URL('../settings/settings-content.tsx', import.meta.url), 'utf8');
  assert.match(settings, /Legal &amp; credits/);
  assert.match(settings, /CITY_MAP_ATTRIBUTION/);
  assert.match(settings, /CITY_MAP_LICENSE_URL/);
});

test('the 3D game screen does not mount an OpenStreetMap HUD label', () => {
  const game = readFileSync(new URL('./GameScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(game, /MapAttribution/);
});
