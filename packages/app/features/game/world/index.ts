// The Harlem world: sky, ground, the baked city meshes, trees and lights,
// built once per scene from a parsed tile. city-scene.ts owns the camera and
// the actors; this owns everything static. Walkability lives in
// walkability.ts (pure) and bundled-queries.ts (bound to the bundled tile),
// not re-exported here, so the scene chunk never pulls the tile JSON twice.
import type { Three } from '@acme/ui/three';
import type { CityDatasetV3 } from '../city-dataset.ts';
import { buildCityMeshes, SHADOW_BAND_METRES, shadowBands, type CityMeshStats } from './city-mesh.ts';
import { buildStreetProps } from './street-props.ts';
import { buildTrees, type TreeReport } from './foliage.ts';
import { buildStreetFurniture } from './street-furniture.ts';
import { createStreetClearance, createWalkQueries } from './walkability.ts';
import { createCityMaterials, linearColor } from './materials.ts';
import { createPbrCityMaterials, EXPERIMENTAL_WORLD_PBR } from './pbr-materials.ts';
import { createGlassCityMaterials, EXPERIMENTAL_WORLD_GLASS, type GlassTier } from './glass.ts';
import { applyCarPbrMaterial, EXPERIMENTAL_WORLD_CAR_PBR } from './car-materials.ts';
import { createSkyRig, EXPERIMENTAL_SKY_RIG, type SkyName } from './sky-rig.ts';
import { createVdCityMaterials, EXPERIMENTAL_WORLD_VD, type VdWeather } from './vd-materials.ts';
import { VD_LEAN } from './vd-lean.ts';
import { VD_LEANDRAW } from './vd-leandraw.ts';
import { VD_LEANMAT } from './vd-leanmat.ts';
import { buildPrecipitation } from './vd-weather.ts';
import { CURB_HEIGHT, VD_SHADOWS, VD_SHADOW_HALF } from './curb.ts';
import { FUTURE_LAYER, type AdSurface } from './future-layer.ts';
import { loadPhysicalCityMaterials, loadPhysicalFacelift, loadPhysicalNightLights, loadPhysicalRig } from '../physical-graph.ts';
import { LIGHT_POLE_HEIGHT } from './signage.ts';
// Static: the living city's bundled-topology.ts evaluates topology.ts in every build, so a lazy load here saves nothing.
import { buildLaneTopology } from '../living-city/topology.ts';
import { createCellStream, type CellStream, type Vec3 } from './cells/cell-stream.ts';
import { buildVdPort, vdNight } from './vd-port/index.ts';
import { vdHiddenBuildings } from './vd-port/blocks/index.ts';
import { vdLampSites } from './vd-port/furniture/index.ts';
import { VD_POOLS } from './vd-port/furniture/data/instances.ts';
import type { WorldPreset } from '../perf/tier-presets.ts';

// Lane G1 "GPU budget" (EXPO_PUBLIC_WORLD_BUNDLES) was deleted 2026-11: the
// recorded bundle replayed the record-frame camera pose forever — three r186
// never re-uploads the shared camera UBO for bundled render objects
// (upstream issue 30701, "missing binding updates" for static bundles) —
// and the working flag bought only ~1 ms of encode anyway
// (docs/performance/gpu-budget-2026-10-17.md). Re-recording on camera moves
// costs the whole encode the bundle exists to skip, so there is no honest
// BundleGroup lane here until upstream fixes replay.

/**
 * The optional "future layer" (future-layer.ts): NYC roof furniture, the
 * NYCHA exterior facelift kit and the AdSurface inventory, as an additive
 * overlay on the record city (docs/implementation/MOBILE_WORLD_PR_PACK.md).
 * Defaults to EXPO_PUBLIC_WORLD_FUTURE: on unless set to 0.
 */
export const EXPERIMENTAL_WORLD_FUTURE = FUTURE_LAYER;

/** How far the focus moves before the physical fire escapes re-sort near/far, metres (near band: FIRE_ESCAPE.nearDistance, 30 m). */
export const FIRE_ESCAPE_RESORT_METRES = 1;

/**
 * Dusk sun, low in the south-west (about 25 degrees up): long light on the
 * west and south walls, the rest of the city in the cel mid band, where the
 * neon and the lit windows read. Unit vector, scene axes.
 */
export const SUN: readonly [number, number, number] = (() => {
  const v = [-0.62, 0.45, 0.64];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l] as const;
})();

export interface CityWorldStats extends CityMeshStats {
  trees: number; signs: number; streetlights: number;
  /** Trees the street clearance moved, shrank or dropped. */
  treeClearance: TreeReport;
  props: ReturnType<typeof buildStreetProps>['stats'];
}

export interface CityWorldOptions {
  /**
   * Lane L1 "one light" rig: dome, sun, exp² fog and env from one committed
   * sky JSON. Defaults to EXPO_PUBLIC_WORLD_SKY_RIG — off unless set.
   */
  skyRig?: boolean;
  /** Which sky preset when skyRig is on; default 'dusk'. */
  sky?: SkyName;
  /**
   * Lane L2 "real surfaces": the city's lit materials become
   * MeshStandardNodeMaterial (pbr-materials.ts). Defaults to
   * EXPO_PUBLIC_WORLD_PBR — off unless set. Unlit layers, the graphs and the
   * per-vertex surface attributes are shared either way.
   */
  pbr?: boolean;
  /**
   * Lane L3 "glass and rooms": the two wall materials become window glass
   * with interior-mapped rooms (glass.ts). Defaults to
   * EXPO_PUBLIC_WORLD_GLASS — off unless set. With `pbr` it composes over
   * the L2 material set; alone it sits on the unflagged city.
   */
  glass?: boolean;
  /** L3 interior tier — 'full' maps room boxes, 'flat' is the cheap phone path. Default 'full'. */
  glassTier?: GlassTier;
  /**
   * L6 tier pick: the sky rig's environment equirect width (PMREM cube =
   * width/4 — 1024 → 256px, 2048 → 512px). Only read while `skyRig` is
   * on; default SKY_RIG.envWidth.
   */
  envWidth?: number;
  /** L3 lit-room share by time of day, 0 = day … 1 = night. Default comes from `sky`. */
  timeOfDay?: number;
  /**
   * Lane L4 "cars": the parked-car/taxi material becomes a flagged
   * MeshPhysicalNodeMaterial — clearcoat paint, tinted-clearcoat glass,
   * chrome bumpers and emissive lamps that light on dusk/night skies
   * (car-materials.ts). Defaults to EXPO_PUBLIC_WORLD_CAR_PBR — off unless
   * set. The lamp switch reads the resolved sky pick (the rig's name, dusk
   * when unflagged). Works over either lane's other materials.
   */
  carPbr?: boolean;
  /**
   * The vd lane: Valdrada's facades, ground and weather ported to TSL over
   * the PBR body (vd-materials.ts). Defaults to EXPO_PUBLIC_WORLD_VD — on
   * unless set to 0. Takes precedence over `pbr` and `glass`. With
   * `physical` the two compose: the physical rig lights, shadows and night
   * pools a city wearing Valdrada's masonry, roads, sidewalks, roofs, trees
   * and weather, while the physical curtain-wall glass, road paint, fire
   * escapes and facelift stay.
   */
  vd?: boolean;
  /**
   * vd lane "lean materials": unlit MeshBasicNodeMaterial bodies on the
   * city's lit surfaces and the tree pools (vd-leanmat.ts). Defaults to
   * EXPO_PUBLIC_WORLD_VD_LEANMAT — off unless set. Only read while `vd`
   * is on.
   */
  leanMat?: boolean;
  /**
   * vd lane "lean draws": the near and mid tree tiers merge across species
   * into one draw each and the far trunk cross folds into the far leaf mesh
   * (vd-leandraw.ts) — the world drops under the ~40-draw floor the Duo's
   * per-draw submit encode needs. Defaults to EXPO_PUBLIC_WORLD_VD_LEANDRAW
   * — off unless set. Only read while `vd` is on.
   */
  leanDraw?: boolean;
  /**
   * The future layer: roofscape furniture, the NYCHA facelift kit and the
   * addressable ad-surface inventory (EXPERIMENTAL_WORLD_FUTURE). The
   * overlays are merged into the shared buffers, so draw calls stay flat.
   */
  future?: boolean;
  /**
   * EXPO_PUBLIC_WORLD_PHYSICAL: Slop's facade, interior, road and sidewalk
   * materials replace the four city materials one for one, and road paint
   * and fire escapes are added (world/physical/). Off unless set.
   */
  physical?: boolean;
  /**
   * Pool sizes for the physical city's streetlamp and storefront PointLights
   * (world/physical/night-lights.ts), from the tier row. Read only with
   * `physical`; city-scene passes it only when ClusteredLighting is mounted.
   * Absent, no light is built.
   */
  nightLights?: { streetlamps: number; storefronts: number };
  /**
   * Cell streaming (cells/cell-stream.ts): the merged near-detail layers are packaged into 256 m chunks after the bake
   * and only the preset's want set is built; the shells and the ground stay whole. Absent, the whole tile is built.
   */
  stream?: { preset: WorldPreset; log?: (line: string, data: Record<string, unknown>) => void } | null;
}

export function buildCityWorld(THREE: Three, dataset: CityDatasetV3, options: CityWorldOptions = {}) {
  const skyRig = (options.skyRig ?? EXPERIMENTAL_SKY_RIG)
    ? createSkyRig(THREE, { sky: options.sky, envWidth: options.envWidth })
    : null;
  // One sun direction feeds everything: the rig's JSON sunDirection when
  // flagged, the hardcoded dusk SUN otherwise — the cel key, the contact
  // shadows, the DirectionalLight and the PBR dome glow all stay consistent.
  const sunDirection = skyRig?.sunDirection ?? SUN;
  const pbr = options.pbr ?? EXPERIMENTAL_WORLD_PBR;
  const glass = options.glass ?? EXPERIMENTAL_WORLD_GLASS;
  // Lit-room share follows the sky preset when no override is given:
  // morning light leaves interiors dark, dusk and night turn them on.
  // PR08: the same pick feeds every material lane — before, only the
  // flagged glass lane consumed it and the cel/PBR facades glowed at the
  // authored dusk share regardless of the sky the clock picked.
  const TOD_BY_SKY: Record<SkyName, number> = { morning: 0.15, dusk: 0.8, night: 1 };
  const tod = options.timeOfDay ?? TOD_BY_SKY[skyRig ? (options.sky ?? 'dusk') : 'dusk'];
  const vd = options.vd ?? EXPERIMENTAL_WORLD_VD;
  const leanMat = options.leanMat ?? VD_LEANMAT;
  // Under the physical stack the merged cross-species tree draws are the
  // default: the per-species near tier cost 50 shader modules, 30 pipelines
  // and 45 draws on the iPad frame (city-scene.physical-first-frame.test.ts)
  // for the same picture. EXPO_PUBLIC_WORLD_VD_LEANDRAW=0 restores it.
  const leanDraw = options.leanDraw ?? (VD_LEANDRAW || (options.physical === true && process.env.EXPO_PUBLIC_WORLD_VD_LEANDRAW?.trim() !== '0'));
  // Under the physical stack the vd colours decode to linear (sRGB output, ACES in the pipeline).
  const vdMaterials = vd ? createVdCityMaterials(THREE, { sunDirection, timeOfDay: tod, physical: options.physical === true }, leanMat) : null;
  const materials = vdMaterials ?? (glass
    ? createGlassCityMaterials(THREE, {
        sunDirection,
        pbr,
        tier: options.glassTier,
        timeOfDay: tod,
      })
    : pbr
      ? createPbrCityMaterials(THREE, { sunDirection, timeOfDay: tod })
      : createCityMaterials(THREE, sunDirection, { timeOfDay: tod }));
  // Lane L4: the same InstancedMesh keeps its paint-marker contract; only
  // the material changes. The lamp switch seeds off the resolved sky pick.
  const carPbr = (options.carPbr ?? EXPERIMENTAL_WORLD_CAR_PBR)
    ? applyCarPbrMaterial(THREE, materials, { sky: skyRig?.name })
    : null;
  const group = new THREE.Group();
  group.name = 'city:world';
  // Contact shadows lean away from the sun, along the ground.
  const away: [number, number] = (() => {
    const l = Math.hypot(sunDirection[0], sunDirection[2]) || 1;
    return [-sunDirection[0] / l, -sunDirection[2] / l];
  })();

  // Big unlit dome around the camera; city-scene.ts keeps it centred and sized to the far plane.
  const skyGeometry = new THREE.SphereGeometry(1, 32, 16);
  const sky = new THREE.Mesh(skyGeometry, skyRig?.dome ?? materials.sky);
  sky.name = 'city:sky';
  sky.renderOrder = -10;
  sky.frustumCulled = false;

  const groundSize = (dataset.extentMeters + 1500) * 2;
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeometry, materials.ground);
  ground.name = 'city:ground';
  if (CURB_HEIGHT > 0) {
    // The ground is the raised block level; see city-mesh.ts for the underlay order.
    ground.position.y = CURB_HEIGHT;
    ground.renderOrder = -4;
    (materials.ground as InstanceType<Three['Material']>).depthWrite = false;
  }

  // One street-clearance index for every tree, pole, sign, stoop and prop.
  const clearance = createStreetClearance(dataset);
  // The physical modules load only on this branch (physical-graph.ts).
  const phys = options.physical
    ? loadPhysicalCityMaterials().buildPhysicalCityMaterials(
        THREE, loadPhysicalRig().cityUniforms(THREE), dataset, { topology: buildLaneTopology(dataset) },
      )
    : null;
  const future = options.future ?? EXPERIMENTAL_WORLD_FUTURE;
  const faceliftModule = phys && future ? loadPhysicalFacelift() : null;
  const nightPools = phys ? options.nightLights : undefined;
  // vd + physical: Valdrada's photo masonry, asphalt and flags take the wall
  // and ground draws; the physical curtain wall keeps the glass class (Valdrada
  // gives its curtain-wall styles no photo either).
  const cityMaterials = phys
    ? vdMaterials
      ? { ...materials, glass: phys.glass }
      : { ...materials, masonry: phys.masonry, glass: phys.glass, roads: phys.roads, sidewalks: phys.sidewalks }
    : materials;
  // The bundled tile's buildings the vd port's blocks replace leave the city mesh, their placeholder signs and fronts with
  // them (vd-port/blocks: Valdrada's facade-kit buildings and replace-mode landmarks); colliders and walkability keep them.
  const vdHide = vd ? vdHiddenBuildings() : null;
  const meshDataset = vdHide ? { ...dataset, buildings: dataset.buildings.filter((b) => !vdHide.has(b.id)) } : dataset;
  const city = phys
    ? buildCityMeshes(
        THREE, meshDataset,
        cityMaterials,
        away, clearance, future,
        {
          facadeAttributes: true, fireEscapes: true, facelift: faceliftModule?.faceliftBakePicks(meshDataset),
          ...(nightPools ? { storefronts: true } : {}),
        },
      )
    : buildCityMeshes(THREE, meshDataset, materials, away, clearance, future);
  // The facelift reads the built masonry walls, so it follows buildCityMeshes.
  const facelift = faceliftModule ? faceliftModule.buildPhysicalFacelift(THREE, meshDataset, city.meshes, clearance) : null;
  const trees = buildTrees(THREE, dataset, materials, clearance, vd, VD_LEAN, leanMat, leanDraw, phys !== null);
  // The facelift's LED streetlights: the furniture lamps pool in the LED colour instead of sodium.
  const ledPools = faceliftModule ? faceliftModule.createFaceliftLampPools(THREE) : null;
  const furniture = buildStreetFurniture(THREE, dataset, ledPools ? { ...materials, lampPools: ledPools } : materials, clearance, city.texts);
  const props = buildStreetProps(THREE, dataset, materials, clearance, furniture.signs, furniture.lights);
  // The vd port's lane C draws Valdrada's own furniture (vd-port/furniture: lamps, signals, sign poles, hydrants,
  // shelters, kiosks, racks, subway entrances, roof plant). With it, the bundled tile's furniture meshes and the
  // non-vehicle props stay out of the scene, so nothing stands twice; their placements still feed the props' layout.
  const vdFurniture = vd && VD_POOLS.length > 0;
  const VD_REPLACED_PROPS = new Set(['city:street-props', 'city:transit', 'city:transit-lights']);
  const furnitureDrawn = vdFurniture ? [] : furniture.objects;
  const propsDrawn = vdFurniture ? props.objects.filter((o) => !VD_REPLACED_PROPS.has(o.name)) : props.objects;
  // Real night light at the lamp heads and under the awnings, in the LED colour with the facelift.
  const night = nightPools
    ? (() => {
        const m = loadPhysicalNightLights();
        return m.createNightLights(THREE, {
          streetlamps: vdFurniture
            ? m.vdStreetlampSites(vdLampSites(), createWalkQueries(dataset).groundHeight)
            : m.streetlampSites(furniture.lights, LIGHT_POLE_HEIGHT - 0.05 + CURB_HEIGHT),
          storefronts: m.storefrontSites(city.physical?.storefronts ?? [], CURB_HEIGHT),
          streetlampCount: nightPools.streetlamps,
          storefrontCount: nightPools.storefronts,
          led: faceliftModule !== null,
        });
      })()
    : null;
  const bandMinZ = -dataset.extentMeters - SHADOW_BAND_METRES;
  const bandCount = Math.max(1, Math.ceil((dataset.extentMeters * 2 + SHADOW_BAND_METRES * 2) / SHADOW_BAND_METRES) + 1);

  // vd: Valdrada keys sun 5 over hemi ≈0.6, but it also has an env map,
  // a warm bounce light and an SH probe. With hemi as the only fill, shade
  // walls went near-black on the Duo (2026-10-18), so the fill stays high.
  // TODO(tune) on the Duo.
  const hemi = new THREE.HemisphereLight(linearColor(THREE, 'hemiSky'), linearColor(THREE, 'hemiGround'), vd ? 2.6 : 1.6);
  const sun = skyRig?.sun ?? new THREE.DirectionalLight(linearColor(THREE, 'sun'), vd ? 3.2 : 2.2);
  const precipitation = vdMaterials ? buildPrecipitation(THREE, vdMaterials.weather) : null;
  precipitation?.update();
  if (!skyRig) sun.position.set(SUN[0] * 1000, SUN[1] * 1000, SUN[2] * 1000);
  // The physical rig's SunLight cascades replace this sun and its shadow
  // (city-scene hides it and applyPhysicalShadowRoles sets the roles), so the
  // vd lane's own shadow box only runs without the physical stack.
  const vdShadows = VD_SHADOWS && phys === null;
  if (vdShadows) {
    // An orthographic shadow box that follows the Caller (setFocus); the
    // whole tile would spread 2048 texels over 1.7 km.
    sun.castShadow = true;
    // 1024 over the 140 m caller-centred box: ~14 cm texels, soft but
    // readable for trees/props; halves the shadow pass fill on the Duo.
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.left = -VD_SHADOW_HALF; cam.right = VD_SHADOW_HALF; cam.top = VD_SHADOW_HALF; cam.bottom = -VD_SHADOW_HALF;
    cam.near = 1; cam.far = 600;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    cam.updateProjectionMatrix();
    const casters = new Set(['city:walls-masonry', 'city:walls-glass', 'city:roofs', 'city:landmarks', 'city:street-detail', 'city:poles']);
    const receivers = new Set(['city:ground', 'city:areas', 'city:sidewalks', 'city:roads', 'city:walls-masonry', 'city:walls-glass', 'city:roofs']);
    for (const o of [ground, ...city.meshes, ...trees.objects, ...furnitureDrawn, ...propsDrawn]) {
      // Only the full tree models cast; the mid level, the far cross-cards and the plain crowns do not.
      const tree = o.name.startsWith('city:trees-vd-bark-') || o.name.startsWith('city:trees-vd-leaf-');
      o.castShadow = casters.has(o.name) || tree;
      o.receiveShadow = receivers.has(o.name);
    }
  }
  group.add(ground, ...city.meshes, ...trees.objects, ...furnitureDrawn, ...propsDrawn, hemi, sun, sun.target);
  if (precipitation) group.add(precipitation.mesh);
  if (phys?.roadPaint) group.add(phys.roadPaint);
  if (phys) group.add(...phys.fireEscapes.meshes);
  if (facelift?.mesh) group.add(facelift.mesh);
  if (night) group.add(night.group);
  // The vd port: Valdrada's kits and data for the blocks, landmarks, storefronts and furniture in bounds (vd-port/).
  const vdPort = vd
    ? buildVdPort(THREE, dataset, {
        physical: phys !== null,
        night: vdNight(tod),
        groundY: createWalkQueries(dataset).groundHeight,
        sunDirection: sunDirection,
        sunColor: linearColor(THREE, 'sun').toArray() as [number, number, number],
        horizon: (skyRig?.horizon ?? linearColor(THREE, 'skyHorizon')).toArray() as [number, number, number],
        weather: vdMaterials?.weather ?? null,
      })
    : null;
  if (vdPort) group.add(vdPort.group);

  // Cell streaming: after every scene-graph pass above has run on the source meshes (shadow casters), so the
  // templates carry it. Landmark buildings' chunks are pinned resident (Valdrada never evicts a landmark).
  const landmarkBoxes = dataset.landmarks.flatMap((l) => {
    const b = dataset.buildings.find((x) => x.id === l.buildingId);
    if (!b) return [[l.x, l.z, l.x, l.z] as const];
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < b.ring.length; i += 2) {
      x0 = Math.min(x0, b.ring[i]!); x1 = Math.max(x1, b.ring[i]!);
      z0 = Math.min(z0, b.ring[i + 1]!); z1 = Math.max(z1, b.ring[i + 1]!);
    }
    return [[x0, z0, x1, z1] as const];
  });
  const stream: CellStream | null = options.stream
    ? createCellStream(THREE, [...city.meshes, ...(facelift?.mesh ? [facelift.mesh] : []), ...(phys?.roadPaint ? [phys.roadPaint] : []), ...(vdPort?.streamMeshes ?? [])], {
        preset: options.stream.preset,
        log: options.stream.log,
        external: vdPort?.streamLayers ?? [],
        pinned: (x0, z0, size) => landmarkBoxes.some(([a, b, c, d]) => c >= x0 && a < x0 + size && d >= z0 && b < z0 + size),
      })
    : null;

  const horizon = skyRig?.horizon ?? linearColor(THREE, 'skyHorizon');
  const fog = skyRig?.fog ?? new THREE.Fog(horizon, 600, 2500);

  const stats: CityWorldStats = {
    ...city.stats, trees: trees.count, signs: furniture.stats.signs, streetlights: furniture.stats.streetlights, treeClearance: trees.report,
    props: props.stats,
    drawCalls: city.stats.drawCalls + trees.objects.length + furnitureDrawn.length + propsDrawn.length + 2 + (facelift?.mesh ? 1 : 0),
  };
  let viewDistance = 220;
  const nightCamera = { x: 0, y: 0, z: 0, fwdX: 0, fwdZ: 1 };
  const bands: [number, number] = [0, 0];
  // Infinity so the first setFocus always places the escapes.
  const escapeFocus = { x: Infinity, z: Infinity };
  return {
    group,
    sky,
    fog,
    horizon,
    /** The L1 rig when flagged, else null — city-scene uses it to attach env. */
    skyRig,
    /** vd lane weather levels, null on the other lanes. */
    weather: (vdMaterials?.weather ?? null) as VdWeather | null,
    /** Rain and snow, 0..1 each; a no-op off the vd lane. */
    setWeather(rain: number, snowLevel: number) {
      if (!vdMaterials) return;
      vdMaterials.weather.wet.value = Math.max(0, Math.min(1, rain));
      vdMaterials.weather.snow.value = Math.max(0, Math.min(1, snowLevel));
      precipitation?.update();
    },
    stats,
    /**
     * The AdSurface inventory for the LED panels this build drew
     * (future-layer.ts): stable ids, geo, orientation, dimensions and
     * campaign eligibility — the data-driven registry the CMS fills later.
     */
    adSurfaces: city.adSurfaces as readonly AdSurface[],
    /** Level of detail and air from the camera's distance to its target, metres. */
    setViewDistance(distance: number, far: number) {
      viewDistance = distance;
      furniture.setDistance(distance);
      props.setDistance(distance);
      if (fog instanceof THREE.Fog) {
        // FogExp2 has no near/far — the rigged fog's density is constant.
        fog.near = distance * 1.4 + 250;
        fog.far = Math.max(fog.near + 400, Math.min(far * 0.9, distance * 5 + 1600));
      }
    },
    /**
     * The Caller (the camera's look-at point). Trees, contact shadows, sign
     * lettering and light pools draw around it; each refresh is
     * allocation-free and only runs after it has moved about 10 m.
     */
    setFocus(x: number, z: number) {
      if (vdShadows) {
        // Keep the shadow box centred on the Caller, the sun 400 m out along its direction.
        sun.target.position.set(x, 0, z);
        sun.position.set(x + sunDirection[0] * 400, sunDirection[1] * 400, z + sunDirection[2] * 400);
        sun.target.updateMatrixWorld();
        sun.updateMatrixWorld();
      }
      trees.update(x, z, viewDistance);
      // Streamed, the contact shadows and the street detail are per-cell meshes chosen by screen error, not a band.
      if (!stream) city.setFocus(x, z);
      furniture.setFocus(x, z);
      shadowBands(z, bandMinZ, bandCount, bands);
      props.setFocus(x, z, bands[0], bands[1]);
      // The escapes re-sort near/far on a 1 m step, not every frame: each sort
      // rewrites and re-uploads up to FIRE_ESCAPE.maxEscapes instance matrices.
      if (phys && city.physical && Math.hypot(x - escapeFocus.x, z - escapeFocus.z) >= FIRE_ESCAPE_RESORT_METRES) {
        escapeFocus.x = x; escapeFocus.z = z;
        phys.fireEscapes.update(city.physical.fireEscapes, x, z);
      }
    },
    /**
     * Re-ranks the streetlamp and storefront PointLights for the camera
     * (position and unit ground-plane forward) and scales them by the
     * preset's interior glow: off at midday, on from dusk. No-op without the
     * night pools.
     */
    updateNightLights(x: number, y: number, z: number, fwdX: number, fwdZ: number, interiorGlow: number) {
      if (!night) return;
      nightCamera.x = x; nightCamera.y = y; nightCamera.z = z; nightCamera.fwdX = fwdX; nightCamera.fwdZ = fwdZ;
      night.update(nightCamera, interiorGlow);
    },
    /** The cell streamer, null when the whole tile is built. */
    stream,
    /**
     * Builds the START set (stream.prime): cells within `startRadius` of the camera, now. `k` is the screen-error
     * scale (perf/tier-presets.ts screenErrorScale). No-op without streaming.
     */
    primeStream(camera: Vec3, k: number, startRadius: number) {
      stream?.prime(camera, k, startRadius);
    },
    /** One streaming frame; true while cells are still to build or fading. No-op (false) without streaming. */
    updateStream(camera: Vec3, k: number, nowS: number): boolean {
      const busy = stream ? stream.update(camera, k, nowS) : false;
      // After the cells moved: the vd port's near mask reads which near cells are in.
      vdPort?.update(nowS);
      return busy;
    },
    /** The night light pools, null unless `nightLights` was passed under `physical`. */
    nightLights: night,
    /** Advances the facelift's LED sweep; holds it still under Reduce Motion. No-op without the facelift. */
    updateFacelift(time: number, reducedMotion: boolean) {
      facelift?.update(time, reducedMotion);
    },
    /** The vd port (vd-port/), null off the vd lane. */
    vdPort,
    dispose() {
      stream?.dispose();
      vdPort?.dispose();
      night?.dispose();
      facelift?.dispose();
      ledPools?.dispose();
      city.dispose();
      phys?.dispose();
      trees.dispose();
      furniture.dispose();
      props.dispose();
      skyGeometry.dispose();
      groundGeometry.dispose();
      skyRig?.dispose();
      // Lights hold shadow maps and node state; the rig's sun is the rig's to dispose.
      hemi.dispose();
      if (!skyRig) sun.dispose();
      carPbr?.dispose();
      precipitation?.dispose();
      materials.dispose();
    },
  };
}

export type CityWorld = ReturnType<typeof buildCityWorld>;
