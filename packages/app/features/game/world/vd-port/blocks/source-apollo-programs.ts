// Pure settled source identity/schema; source pin2724c79, Three0.185.1.
export const SOURCE_APOLLO_SHADER_BASIS = 'shaderlib-material-template-and-hook-defines-v1';
export interface SourceApolloIdentity { key: string; shaderHash: string; shaderSha256: string; type: string; shaderHashBasis?: string; vertexColors: boolean; hasAlphaTest: boolean; mapRoles: readonly string[] }
export const SOURCE_APOLLO_IDENTITIES = {
  "a32tube0.62,0.68,0.760.22,0.48,1.35": {
    "key": "a32tube0.62,0.68,0.760.22,0.48,1.35",
    "hash": "eb6aedfd",
    "sha256": "74203605390a19a56db1aec7f555db50b6f236310a32f1ca25242176db9f0dda",
    "type": "MeshBasicMaterial",
    "mapRoleSets": [
      []
    ],
    "vertexColorModes": [
      false
    ],
    "alphaTestModes": [
      false
    ],
    "mode": "output"
  },
  "a32tube0.86,0.88,0.920.85,0.92,1.4": {
    "key": "a32tube0.86,0.88,0.920.85,0.92,1.4",
    "hash": "8721a34f",
    "sha256": "373e18c4d4900ad700092682b2735501962a7c8dde733bf2dc86207555fe1342",
    "type": "MeshBasicMaterial",
    "mapRoleSets": [
      []
    ],
    "vertexColorModes": [
      false
    ],
    "alphaTestModes": [
      false
    ],
    "mode": "output"
  },
  "a33led2": {
    "key": "a33led2",
    "hash": "e3c25378",
    "sha256": "b4dbe81600132094f8edd73b89b03d3b962039cd6be75ae430f8d0d8c5074f69",
    "type": "MeshStandardMaterial",
    "mapRoleSets": [
      [
        "emissiveMap",
        "map"
      ]
    ],
    "vertexColorModes": [
      false
    ],
    "alphaTestModes": [
      false
    ],
    "mode": "emission"
  },
  "a32sign": {
    "key": "onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|a32sign",
    "hash": "d40dac0",
    "sha256": "d9391f728ac18f6f3f1927a7afdd3bf0817aa9cda85edf57864858643b1c4886",
    "type": "MeshStandardMaterial",
    "mapRoleSets": [
      [
        "emissiveMap",
        "map"
      ]
    ],
    "vertexColorModes": [
      false
    ],
    "alphaTestModes": [
      true
    ],
    "mode": "emission"
  },
  "a34back": {
    "key": "onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|a34back",
    "hash": "c41e8ba6",
    "sha256": "61f14d3f83279e96d46062dcd9903f61fe9da2aef77d6d82b42024e1bd3c984c",
    "type": "MeshStandardMaterial",
    "mapRoleSets": [
      []
    ],
    "vertexColorModes": [
      false
    ],
    "alphaTestModes": [
      false
    ],
    "mode": "emission"
  },
  "a34cream": {
    "key": "onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|a34cream",
    "hash": "e9e54125",
    "sha256": "a6abcc1e85e2d884eba9c8954737c91ed049b75cbc3ee8b8c2562abf35d386c6",
    "type": "MeshStandardMaterial",
    "mapRoleSets": [
      [
        "map"
      ]
    ],
    "vertexColorModes": [
      false
    ],
    "alphaTestModes": [
      false
    ],
    "mode": "emission"
  },
  "a34field": {
    "key": "onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|a34field",
    "hash": "da9e0c8c",
    "sha256": "60375859f02ff49f1a44d05f0f53d95680a9ca47b4a7ebbf0fe86cb838be9043",
    "type": "MeshStandardMaterial",
    "mapRoleSets": [
      [
        "map"
      ]
    ],
    "vertexColorModes": [
      false
    ],
    "alphaTestModes": [
      false
    ],
    "mode": "emission"
  },
  "a34tube": {
    "key": "onBeforeCompile( /* shaderobject, renderer */ ) {}|lighttrim1,1,1|st34|a34tube",
    "hash": "dd09ee08",
    "sha256": "081fb363d1faf602cf3df840fabaeaf062f718346effd8b6318a1fe9879c691a",
    "type": "MeshStandardMaterial",
    "mapRoleSets": [
      []
    ],
    "vertexColorModes": [
      false
    ],
    "alphaTestModes": [
      false
    ],
    "mode": "emission"
  }
} as const;
export type SourceApolloProgram = keyof typeof SOURCE_APOLLO_IDENTITIES;
export type ApolloProgram = SourceApolloProgram;
export function classifyApolloSource(source: SourceApolloIdentity): SourceApolloProgram {
  if (source.shaderHashBasis !== undefined && source.shaderHashBasis !== SOURCE_APOLLO_SHADER_BASIS) throw new Error('Unverified Apollo shader identity basis');
  for (const [program, expected] of Object.entries(SOURCE_APOLLO_IDENTITIES)) {
    if (source.key === expected.key && source.type === expected.type && source.shaderHash === expected.hash && source.shaderSha256 === expected.sha256) {
      if (!(expected.vertexColorModes as readonly boolean[]).includes(source.vertexColors) || !(expected.alphaTestModes as readonly boolean[]).includes(source.hasAlphaTest) || !expected.mapRoleSets.some(roles => JSON.stringify([...roles].sort()) === JSON.stringify([...source.mapRoles].sort()))) throw new Error('Uncaptured Apollo renderer flags');
      return program as SourceApolloProgram;
    }
  }
  throw new Error(`Unsupported authored Apollo source ${source.key}`);
}
/** Basic tubes consume only their actual diffuse and opacity; no fabricated Standard-only padding. */
export function apolloParameterSchema(source: SourceApolloIdentity) {
  const program = classifyApolloSource(source);
  const material = source.type === 'MeshBasicMaterial'
    ? [{name:'diffuse',size:3 as const},{name:'opacity',size:1 as const}]
    : [{name:'diffuse',size:3 as const},{name:'emissive',size:3 as const},
      ...['opacity','emissiveIntensity','roughness','metalness','envMapIntensity','alphaTest'].map(name=>({name,size:1 as const}))];
  return { program, mode: SOURCE_APOLLO_IDENTITIES[program].mode, mapRoleSets: SOURCE_APOLLO_IDENTITIES[program].mapRoleSets,
    material, variant: [], frame: [] };
}
