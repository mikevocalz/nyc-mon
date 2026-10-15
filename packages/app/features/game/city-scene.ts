import type { ThreeContext, ThreeScene } from '@acme/ui/three';
import { parseCityDataset, projectCityPoint, type CityDataset } from './city-dataset.ts';

export interface CityCamera {
  x: number;
  z: number;
  yaw: number;
  distance: number;
}
export interface CitySceneParams { dataset: CityDataset; camera: CityCamera }
/** Small-tile renderer; the streaming/merged-geometry pass will raise this measured budget. */
const MAX_SCENE_FEATURES = 256;
export function createCityScene({ THREE }: ThreeContext, initial: CitySceneParams): ThreeScene<CitySceneParams> {
  if (![initial.camera.x,initial.camera.z,initial.camera.yaw,initial.camera.distance].every(Number.isFinite)) throw new Error('Invalid city camera');
  const dataset = parseCityDataset(initial.dataset);
  if (dataset.features.length > MAX_SCENE_FEATURES) throw new Error('City scene feature budget exceeded');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dce5ec');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 10_000);
  const material = new THREE.MeshStandardMaterial({ color: '#a6b1be', roughness: 0.95 });
  const roadMaterial = new THREE.MeshStandardMaterial({ color: '#495460', roughness: 1 });
  const groundMaterial = new THREE.MeshStandardMaterial({ color: '#c8c9bc', roughness: 1 });
  const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
  const groundGeometry = new THREE.PlaneGeometry(4200, 4200);
  geometries.push(groundGeometry);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground, new THREE.HemisphereLight('#ffffff', '#667080', 2));
  const sun = new THREE.DirectionalLight('#fff5e6', 2);
  sun.position.set(-200, 400, 100);
  scene.add(sun);
  try {
    for (const feature of dataset.features) {
      const points = feature.points.map((p) => projectCityPoint(p, dataset.origin));
      if (feature.kind === 'building') {
        // Extrude in XY, then rotate so +Z extrusion becomes world +Y.
        const shape = new THREE.Shape(points.slice(0, -1).map(([x,z]) => new THREE.Vector2(x,-z)));
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: feature.heightMeters, bevelEnabled: false, steps: 1 });
        geometries.push(geometry);
        geometry.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = feature.id;
        scene.add(mesh);
      } else {
        // One merged triangle strip per road, rather than one draw call per segment.
        const positions: number[] = [];
        for (let i = 1; i < points.length; i++) {
          const [ax,az] = points[i-1]!; const [bx,bz] = points[i]!;
          const length = Math.hypot(bx-ax,bz-az);
          if (length === 0) continue;
          const nx = -(bz-az) / length * feature.widthMeters / 2;
          const nz = (bx-ax) / length * feature.widthMeters / 2;
          positions.push(ax+nx,0,az+nz, bx+nx,0,bz+nz, ax-nx,0,az-nz,
            ax-nx,0,az-nz, bx+nx,0,bz+nz, bx-nx,0,bz-nz);
        }
        const geometry = new THREE.BufferGeometry();
        geometries.push(geometry);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, roadMaterial);
        mesh.name = feature.id;
        scene.add(mesh);
      }
    }
  } catch (error) {
    for (const geometry of geometries) geometry.dispose();
    material.dispose(); roadMaterial.dispose(); groundMaterial.dispose();
    throw error;
  }
  function positionCamera(value: CityCamera) {
    if (![value.x,value.z,value.yaw,value.distance].every(Number.isFinite)) throw new Error('Invalid city camera');
    const distance = Math.max(30,Math.min(3000,value.distance));
    camera.position.set(value.x + Math.sin(value.yaw)*distance, distance*0.8, value.z + Math.cos(value.yaw)*distance);
    camera.lookAt(value.x,0,value.z);
  }
  positionCamera(initial.camera);
  let disposed = false;
  return {
    scene, camera,
    update: (_frame,params) => {
      if (params.dataset !== initial.dataset) throw new Error('Remount city scene when changing datasets');
      positionCamera(params.camera);
    },
    resize: (width,height) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      camera.aspect = width/height;
      camera.updateProjectionMatrix();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      material.dispose(); roadMaterial.dispose(); groundMaterial.dispose();
      scene.clear();
    },
  };
}
