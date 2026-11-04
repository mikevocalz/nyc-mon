// Preserve source surface channels; legacy harvest.js remains unchanged.
import { SURFACE_FLAGS, transformSurfaceNormal } from './surface-layout.mjs';

const AUXILIARY = { aFkTr: 3, aPgBody: 4, sgRect: 4, sgBg: 3, sgFg: 3, sgLamp: 3, sgP: 4, sgF: 4 };
export const GVC_ZERO_NORMAL_REPAIR_SHADER = '32e78de07260fc42e78739b0c766cab037abb0972d16290ef4eec4b8d398a0e9';
export const METAL_VC_ZERO_NORMAL_REPAIR_SHADER = '90dafc8a6565b3512e240989827cb1643675097cb4b2cf5ee0b49277fe99adce';
export const SIGN_KIT_NORMAL_REPAIR_SOURCE = '9736faa6153bf9b4f21b8c5e2e10ef9c5316ef89a557f2967c9568d3c122ee46';
const component = (attribute, index, size) => Array.from({ length: size }, (_, c) => attribute.getComponent(index, c));
const finite = (values, field) => { if (!values.every(Number.isFinite)) throw new Error(`VDN3 source ${field} is nonfinite`); return values; };
const transformPosition = (p, e) => [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]];
const determinant = e => e[0] * (e[5] * e[10] - e[9] * e[6]) - e[4] * (e[1] * e[10] - e[9] * e[2]) + e[8] * (e[1] * e[6] - e[5] * e[2]);

/**
 * Harvest exact finest visible triangles. The registry must classify every
 * source material and allocate compact constant-attribute variant rows.
 * Unsupported source attributes/families fail; they never become flat paint.
 */
export function harvestSurfaceTriangles(root, registry) {
  root.updateMatrixWorld(true);
  const vertices = [], indices = [], families = [];
  let omittedZeroAreaTriangles = 0;
  const normalRepairs = [];
  const shadowAudit = [];
  const visit = (object, meshPath) => {
    if (object.visible === false) return;
    if (object.isMesh && object.geometry?.attributes.position) {
      if (!Number.isFinite(object.renderOrder)) throw new Error('VDN3 source mesh renderOrder must be finite');
      const shadow = registry.shadowPolicy?.(object) ?? { castShadow: true, receiveShadow: true, castOwner: 'native-block-owner', receiveOwner: 'native-block-owner', sourceCastShadow: !!object.castShadow, sourceReceiveShadow: !!object.receiveShadow };
      shadowAudit.push({ mesh: object.name, meshPath, ...shadow });
      const geometry = object.geometry, attrs = geometry.attributes;
      const allowed = new Set(['position', 'normal', 'uv', 'color', 'aGrime', 'aWeather', ...Object.keys(AUXILIARY)]);
      for (const name of Object.keys(attrs)) if (!allowed.has(name)) throw new Error(`VDN3 unsupported source attribute ${name}`);
      for (const [name, size] of Object.entries(AUXILIARY)) if (attrs[name] && attrs[name].itemSize !== size) throw new Error(`VDN3 ${name} itemSize differs from source contract`);
      if (attrs.color && attrs.color.itemSize !== 3) throw new Error('VDN3 source vertex alpha needs an explicit encoding revision');
      if (attrs.aWeather && ![3, 4].includes(attrs.aWeather.itemSize)) throw new Error('VDN3 weather requires vec3 or vec4');
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const groups = geometry.groups.length && Array.isArray(object.material) ? geometry.groups : [{ start: 0, count: geometry.index?.count ?? attrs.position.count, materialIndex: 0 }];
      const instances = object.isInstancedMesh ? object.count : 1;
      for (let instance = 0; instance < instances; instance++) {
        const world = object.matrixWorld.clone();
        let localElements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        if (object.isInstancedMesh) {
          const local = object.matrixWorld.clone(); object.getMatrixAt(instance, local);
          localElements = [...local.elements]; world.multiplyMatrices(object.matrixWorld, local);
        }
        const e = world.elements, mirrored = determinant(e) < 0;
        const sourceFrame = {
          meshMatrixWorld: finite([...object.matrixWorld.elements], 'mesh matrix'),
          instanceMatrix: finite(localElements, 'instance matrix'),
          combinedMatrix: finite([...e], 'combined matrix'),
          isInstanced: object.isInstancedMesh === true,
          hasInstanceColor: !!object.instanceColor,
          instanceTranslationXZ: [localElements[12], localElements[14]],
        };
        for (const group of groups) {
          const material = materials[group.materialIndex];
          if (!material || material.visible === false) continue;
          // Opacity below .3 is still authored visible geometry. Preserve its
          // true alpha/blend state in the material registry instead of omitting it.
          const start = Math.max(group.start, geometry.drawRange?.start ?? 0);
          const end = Math.min(group.start + group.count, (geometry.drawRange?.start ?? 0) + (geometry.drawRange?.count ?? Infinity), geometry.index?.count ?? attrs.position.count);
          if (end <= start) continue;
          const surface = registry.material(material, { attributes: attrs, instanceColor: !!object.instanceColor });
          for (let at = start; at + 2 < end; at += 3) {
            const sourceCorners = [0, 1, 2].map(c => geometry.index ? geometry.index.getX(at + c) : at + c);
            const corners = mirrored ? [sourceCorners[0], sourceCorners[2], sourceCorners[1]] : sourceCorners;
            const points = sourceCorners.map(index => component(attrs.position, index, 3));
            const a = points[1].map((value, axis) => value - points[0][axis]);
            const b = points[2].map((value, axis) => value - points[0][axis]);
            const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
            if (cross.every(value => value === 0)) { omittedZeroAreaTriangles++; continue; }
            if (attrs.aWeather && sourceCorners.some(index => component(attrs.aWeather, index, attrs.aWeather.itemSize).some((value, axis) => value !== attrs.aWeather.getComponent(sourceCorners[0], axis)))) {
              throw new Error(`VDN3 weather varies inside a triangle; mesh=${object.name} material=${material.name} triangle=${at / 3}`);
            }
            let repairedNormal;
            if (attrs.normal && sourceCorners.every(index => component(attrs.normal, index, 3).every(value => value === 0))) {
              const shaderSha256 = registry.sourceShaderSha256?.(material);
              const glow = material.name === 'ar33sign:glowvc' && shaderSha256 === GVC_ZERO_NORMAL_REPAIR_SHADER;
              const metal = material.name === 'ar33sign:metalvc' && shaderSha256 === METAL_VC_ZERO_NORMAL_REPAIR_SHADER && registry.sourceSignKitSha256 === SIGN_KIT_NORMAL_REPAIR_SOURCE;
              if (material.type === 'MeshStandardMaterial' && (glow || metal)) {
                const length = Math.hypot(...cross);
                repairedNormal = cross.map(value => value / length);
                normalRepairs.push({ mesh: object.name, meshPath, material: material.name, triangle: at / 3, sourceCross: cross, shaderSha256, sourceClosureSha256: registry.sourceSignKitSha256 });
              }
            }
            const auxiliary = {};
            for (const [name, size] of Object.entries(AUXILIARY)) if (attrs[name]) {
              const value = finite(component(attrs[name], corners[0], size), name);
              for (const corner of corners.slice(1)) if (component(attrs[name], corner, size).some((v, i) => v !== value[i])) throw new Error(`VDN3 ${name} varies inside a triangle; family-specific layout required`);
              auxiliary[name] = value;
            }
            if (object.instanceColor) auxiliary.instanceColor = finite(component(object.instanceColor, instance, 3), 'instanceColor');
            const variant = registry.variant(surface.material, auxiliary, sourceFrame);
            const triangle = [];
            for (const corner of corners) {
              let flags = 0;
              const uv = attrs.uv ? (flags |= SURFACE_FLAGS.uv, finite(component(attrs.uv, corner, 2), 'uv')) : [0, 0];
              let normal = [0, 1, 0];
              if (attrs.normal) {
                flags |= SURFACE_FLAGS.normal;
                try { normal = transformSurfaceNormal(repairedNormal ?? component(attrs.normal, corner, 3), e); }
                catch (error) { throw new Error(`${error.message}; mesh=${object.name} material=${material.name} triangle=${at / 3} corner=${corner} sourceNormal=${JSON.stringify(component(attrs.normal, corner, 3))} trianglePositions=${JSON.stringify(corners.map(index => component(attrs.position, index, 3)))}`); }
              }
              const color = attrs.color ? (flags |= SURFACE_FLAGS.color, finite(component(attrs.color, corner, 3), 'color')) : [1, 1, 1];
              const grime = attrs.aGrime ? (flags |= SURFACE_FLAGS.grime, attrs.aGrime.getX(corner)) : 0;
              const weather = attrs.aWeather ? (flags |= SURFACE_FLAGS.weather, component(attrs.aWeather, corner, attrs.aWeather.itemSize)) : [0, 0, 0, -1];
              if (attrs.aWeather?.itemSize === 4) flags |= SURFACE_FLAGS.weather4;
              if (weather.length === 3) weather.push(-1);
              triangle.push({ position: finite(transformPosition(component(attrs.position, corner, 3), e), 'position'), uv, normal, color, material: surface.material, variant, grime, weather: finite(weather, 'weather'), flags, renderOrder: object.renderOrder,
                castShadow: shadow.castShadow, receiveShadow: shadow.receiveShadow, castOwner: shadow.castOwner, receiveOwner: shadow.receiveOwner,
                sourceCastShadow: shadow.sourceCastShadow, sourceReceiveShadow: shadow.sourceReceiveShadow });
            }
            if (registry.triangle) registry.triangle(triangle, surface.family);
            else for (const vertex of triangle) { vertices.push(vertex); indices.push(indices.length); families.push(surface.family); }
          }
        }
      }
    }
    const children = object.isLOD && object.levels?.length ? [object.levels[0].object] : object.children;
    for (const child of children) visit(child, `${meshPath}/${object.children.indexOf(child)}`);
  };
  visit(root, 'root');
  return { vertices, indices, families, omittedZeroAreaTriangles, normalRepairs, shadowAudit };
}
