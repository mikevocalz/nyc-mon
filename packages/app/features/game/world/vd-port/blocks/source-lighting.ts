import type { Three } from '@acme/ui/three';
import type { Node } from 'three/webgpu';
import { applySourceSpecularTrim, type SourceLightTrim } from './source-light-trim.ts';
import { sourceCityAoFactors, type SourceCityAoInputs } from './source-city-ao.ts';
import { sourceCityReflection, sourcePbrCityReflection } from './source-city-reflection.ts';

type F = Node<'float'>;
type V3 = Node<'vec3'>;
type V4 = Node<'vec4'>;
interface ReflectedLight { directDiffuse: V3; indirectDiffuse: V3; directSpecular: V3; indirectSpecular: V3 }
interface LightingContext { reflectedLight: ReflectedLight; radiance: V3; iblIrradiance: V3 }

export function sourceLightCapture(THREE: Three) {
  return {
    directDiffuse: THREE.TSL.property('vec3'), indirectDiffuse: THREE.TSL.property('vec3'),
    totalSpecular: THREE.TSL.property('vec3'),
  };
}

/** Common source hooks for standard FK/sign/landmark families; no texture or material ownership. */
export function createSourceLightingModel(THREE: Three, options: {
  trim?: SourceLightTrim;
  cityAo?: SourceCityAoInputs;
  cityReflection?: { height: F; cs34: V4; cs34Col: V4; pbrCity: boolean };
  interior?: { indirect: F; direct: F };
  environmentShare?: F;
  capture?: ReturnType<typeof sourceLightCapture>;
  /** Authored edits inserted after city reflection and before physical indirect scattering. */
  radianceEdit?: (radiance: V3) => V3;
}) {
  const T = THREE.TSL;
  const Base = THREE.PhysicalLightingModel;
  const ao = options.cityAo ? sourceCityAoFactors(THREE, options.cityAo) : null;
  return new class extends Base {
    override start(builder: Parameters<InstanceType<typeof Base>['start']>[0]) {
      if (options.trim) applySourceSpecularTrim(THREE, options.trim);
      super.start(builder);
    }
    override indirect(builder: Parameters<InstanceType<typeof Base>['indirect']>[0]) {
      const context = builder.context as LightingContext;
      const city = options.cityReflection;
      if (city) {
        // applyCityRefl owns the specular edit when pbCity is active; CS34 then edits only diffuse.
        if (city.pbrCity) context.radiance.assign(sourcePbrCityReflection(THREE, context.radiance, city.height));
        const edited = sourceCityReflection(THREE, { ...city, radiance: context.radiance,
          iblIrradiance: context.iblIrradiance, pbrCity: T.float(city.pbrCity ? 1 : 0) });
        context.radiance.assign(edited.radiance);
        context.iblIrradiance.assign(edited.iblIrradiance);
      }
      if (options.radianceEdit) context.radiance.assign(options.radianceEdit(context.radiance));
      super.indirect(builder);
    }
    override ambientOcclusion(builder: Parameters<InstanceType<typeof Base>['ambientOcclusion']>[0]) {
      super.ambientOcclusion(builder);
      const { reflectedLight: light } = builder.context as LightingContext;
      if (options.interior) {
        light.indirectDiffuse.mulAssign(options.interior.indirect);
        light.indirectSpecular.mulAssign(options.interior.indirect);
        light.directDiffuse.mulAssign(options.interior.direct);
        light.directSpecular.mulAssign(options.interior.direct);
      }
      if (options.environmentShare) light.indirectSpecular.mulAssign(options.environmentShare);
      if (ao) {
        light.indirectDiffuse.mulAssign(ao.diffuse);
        light.indirectSpecular.mulAssign(ao.specular);
      }
    }
    override finish(builder: Parameters<InstanceType<typeof Base>['finish']>[0]) {
      super.finish(builder);
      if (options.capture) {
        const { reflectedLight: light } = builder.context as LightingContext;
        options.capture.directDiffuse.assign(light.directDiffuse);
        options.capture.indirectDiffuse.assign(light.indirectDiffuse);
        options.capture.totalSpecular.assign(light.directSpecular.add(light.indirectSpecular));
      }
    }
  }();
}
