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
import { createStreetClearance } from './walkability.ts';
import { createCityMaterials, linearColor } from './materials.ts';
import { createPbrCityMaterials, EXPERIMENTAL_WORLD_PBR } from './pbr-materials.ts';
import { createGlassCityMaterials, EXPERIMENTAL_WORLD_GLASS, type GlassTier } from './glass.ts';
import { applyCarPbrMaterial, EXPERIMENTAL_WORLD_CAR_PBR } from './car-materials.ts';
import { createSkyRig, EXPERIMENTAL_SKY_RIG, type SkyName } from './sky-rig.ts';
import { createVdCityMaterials, EXPERIMENTAL_WORLD_VD, type VdWeather } from './vd-materials.ts';
import { buildPrecipitation } from './vd-weather.ts';
import { CURB_HEIGHT, VD_SHADOWS, VD_SHADOW_HALF } from './curb.ts';
import { FUTURE_LAYER, type AdSurface } from './future-layer.ts';

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
 * Defaults to EXPO_PUBLIC_WORLD_FUTURE — off unless set.
 */
export const EXPERIMENTAL_WORLD_FUTURE = FUTURE_LAYER;

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
   * the PBR body (vd-materials.ts). Defaults to EXPO_PUBLIC_WORLD_VD — off
   * unless set. Takes precedence over `pbr` and `glass`.
   */
  vd?: boolean;
  /**
   * The future layer: roofscape furniture, the NYCHA facelift kit and the
   * addressable ad-surface inventory (EXPERIMENTAL_WORLD_FUTURE). The
   * overlays are merged into the shared buffers, so draw calls stay flat.
   */
  future?: boolean;
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
  const vdMaterials = vd ? createVdCityMaterials(THREE, { sunDirection, timeOfDay: tod }) : null;
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
  const city = buildCityMeshes(THREE, dataset, materials, away, clearance, options.future ?? EXPERIMENTAL_WORLD_FUTURE);
  const trees = buildTrees(THREE, dataset, materials, clearance, vd);
  const furniture = buildStreetFurniture(THREE, dataset, materials, clearance, city.texts);
  const props = buildStreetProps(THREE, dataset, materials, clearance, furniture.signs, furniture.lights);
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
  if (VD_SHADOWS) {
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
    for (const o of [ground, ...city.meshes, ...trees.objects, ...furniture.objects, ...props.objects]) {
      // Only the full tree models cast; the mid level, the far cross-cards and the plain crowns do not.
      const tree = o.name.startsWith('city:trees-vd-bark-') || o.name.startsWith('city:trees-vd-leaf-');
      o.castShadow = casters.has(o.name) || tree;
      o.receiveShadow = receivers.has(o.name);
    }
  }
  group.add(ground, ...city.meshes, ...trees.objects, ...furniture.objects, ...props.objects, hemi, sun, sun.target);
  if (precipitation) group.add(precipitation.mesh);

  const horizon = skyRig?.horizon ?? linearColor(THREE, 'skyHorizon');
  const fog = skyRig?.fog ?? new THREE.Fog(horizon, 600, 2500);

  const stats: CityWorldStats = {
    ...city.stats, trees: trees.count, signs: furniture.stats.signs, streetlights: furniture.stats.streetlights, treeClearance: trees.report,
    props: props.stats,
    drawCalls: city.stats.drawCalls + trees.objects.length + furniture.objects.length + props.objects.length + 2,
  };
  let viewDistance = 220;
  const bands: [number, number] = [0, 0];
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
      if (VD_SHADOWS) {
        // Keep the shadow box centred on the Caller, the sun 400 m out along its direction.
        sun.target.position.set(x, 0, z);
        sun.position.set(x + sunDirection[0] * 400, sunDirection[1] * 400, z + sunDirection[2] * 400);
        sun.target.updateMatrixWorld();
        sun.updateMatrixWorld();
      }
      trees.update(x, z, viewDistance);
      city.setFocus(x, z);
      furniture.setFocus(x, z);
      shadowBands(z, bandMinZ, bandCount, bands);
      props.setFocus(x, z, bands[0], bands[1]);
    },
    dispose() {
      city.dispose();
      trees.dispose();
      furniture.dispose();
      props.dispose();
      skyGeometry.dispose();
      groundGeometry.dispose();
      skyRig?.dispose();
      carPbr?.dispose();
      precipitation?.dispose();
      materials.dispose();
    },
  };
}

export type CityWorld = ReturnType<typeof buildCityWorld>;
