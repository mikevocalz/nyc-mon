// Downloads the OpenStreetMap data for the Harlem / Apollo Theater tile into tooling/city/.cache/.
// Run: node tooling/city/fetch.mjs [--refresh]   (then node tooling/city/build.mjs)
// Adapted from vg-demos-all scripts/osm/{fetch,build}.mjs (MIT, see LICENSE in https://github.com/vietgangzz/vg-demos-all)
// Data © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '.cache');
// Public Overpass mirrors, tried in turn when one is busy or rate-limits us
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const USER_AGENT = 'nyc-mon-city-build/1.0 (offline tile bake)';

// Must match build.mjs and the app: the world save format depends on this origin
const ORIGIN = [-73.94975, 40.81005];
const R = 850;
const FETCH_R = R + 120;
const RAD = Math.PI / 180;
const EARTH = 6_371_008.8;
const dLat = FETCH_R / (RAD * EARTH);
const dLon = FETCH_R / (RAD * EARTH * Math.cos(ORIGIN[1] * RAD));
const f = (v) => v.toFixed(6);
// Overpass bbox order: south, west, north, east
export const BBOX = `${f(ORIGIN[1] - dLat)},${f(ORIGIN[0] - dLon)},${f(ORIGIN[1] + dLat)},${f(ORIGIN[0] + dLon)}`;

const AREA_FILTERS = [
  '["leisure"~"^(park|garden|playground|pitch|track|nature_reserve|dog_park)$"]',
  '["landuse"~"^(grass|recreation_ground|village_green|cemetery|religious)$"]',
  '["natural"="water"]',
  '["waterway"="riverbank"]',
  '["amenity"="parking"]',
  '["place"="square"]',
  '["highway"="pedestrian"]["area"="yes"]',
  '["amenity"="school"]',
];

const queries = {
  // Relations need body verbosity: "out geom tags" drops the member list and its geometry
  buildings: `way["building"](${BBOX});
out geom tags;
relation["building"](${BBOX});
out geom;`,
  roads: `way["highway"](${BBOX});
out geom tags;`,
  areas: `(${AREA_FILTERS.map((q) => `way${q}(${BBOX});`).join(' ')});
out geom tags;
(${AREA_FILTERS.map((q) => `relation${q}(${BBOX});`).join(' ')});
out geom;`,
  trees: `node["natural"="tree"](${BBOX});
out;`,
  landmarks: `(nwr["name"~"Apollo Theater|Hotel Theresa|Theresa|Adam Clayton Powell"](${BBOX}););
out center tags;`,
};

async function query(body) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: `[out:json][timeout:180];${body}` }),
      });
      if (res.ok) return await res.json();
      lastError = new Error(`HTTP ${res.status} from ${endpoint}`);
    } catch (error) {
      lastError = error;
    }
    console.warn(`  attempt ${attempt + 1} failed: ${lastError.message}`);
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  throw lastError;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(CACHE, { recursive: true });
  const refresh = process.argv.includes('--refresh');
  console.log(`bbox ${BBOX}`);
  for (const [name, body] of Object.entries(queries)) {
    const file = join(CACHE, `${name}.json`);
    if (!refresh && (await access(file).then(() => true, () => false))) {
      console.log(`${name}: cached`);
      continue;
    }
    process.stdout.write(`Fetching ${name}… `);
    const json = await query(body);
    await writeFile(file, JSON.stringify(json));
    const counts = {};
    for (const e of json.elements) counts[e.type] = (counts[e.type] ?? 0) + 1;
    console.log(`${json.elements.length} elements ${JSON.stringify(counts)}`);
  }
}
