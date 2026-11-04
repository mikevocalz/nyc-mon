// Pure settled source identity/schema. Helper coverage does not claim a complete bound material factory.
export const SOURCE_VEGETATION_SHADER_BASIS = 'shaderlib-material-template-and-hook-defines-v1';
export interface SourceVegetationIdentity { key:string; shaderHash:string; shaderSha256:string; type:string; shaderHashBasis?:string; vertexColors:boolean; hasAlphaTest:boolean; mapRoles:readonly string[] }
export const SOURCE_VEGETATION_IDENTITIES = [
  {
    "key": "vg37leaf5|snowcap0.6true|cityaon|cs34|lighttrim2.6,2.6,2.6|st34|lf140",
    "hash": "1421a5c1",
    "sha256": "19dcaedaa8b9679d29eb42035addfcc953d170830ae55d9f976c7800416de5bb",
    "type": "MeshStandardMaterial",
    "program": 0,
    "mapRoleSets": [
      [
        "map"
      ]
    ],
    "vertexColorModes": [
      true
    ],
    "alphaTestModes": [
      true
    ]
  },
  {
    "key": "vg37leaf5|snowcap0.6true|cityaon|cs34|lighttrim2.6,2.6,2.6|st34|lf141",
    "hash": "1421a5c1",
    "sha256": "1df016edbca375f0831233184565d923310508921567cf45528875ee355161b2",
    "type": "MeshStandardMaterial",
    "program": 1,
    "mapRoleSets": [
      [
        "map"
      ]
    ],
    "vertexColorModes": [
      true
    ],
    "alphaTestModes": [
      true
    ]
  }
] as const;
export function classifyVegetationSource(source:SourceVegetationIdentity) {
 if(source.shaderHashBasis!==undefined&&source.shaderHashBasis!==SOURCE_VEGETATION_SHADER_BASIS)throw new Error('Unverified vegetation shader basis');
 for(const expected of SOURCE_VEGETATION_IDENTITIES)if(source.key===expected.key&&source.shaderHash===expected.hash&&source.shaderSha256===expected.sha256&&source.type===expected.type){
  if(!(expected.vertexColorModes as readonly boolean[]).includes(source.vertexColors)||!(expected.alphaTestModes as readonly boolean[]).includes(source.hasAlphaTest)||!expected.mapRoleSets.some(roles=>JSON.stringify([...roles].sort())===JSON.stringify([...source.mapRoles].sort())))throw new Error('Uncaptured vegetation renderer flags');
  return expected.program;
 }
 throw new Error(`Unsupported authored vegetation source ${source.key}`);
}
/** Original object/instance frames are mandatory for authored wind; source-world alone is insufficient. */
export function vegetationParameterSchema(source:SourceVegetationIdentity){
 const program=classifyVegetationSource(source);
 return{program,material:[{name:'diffuse',size:3 as const},{name:'emissive',size:3 as const},...['opacity','emissiveIntensity','roughness','metalness','envMapIntensity','alphaTest','uOn14'].map(name=>({name,size:1 as const})),{name:'vg37K',size:4 as const},{name:'uR14',size:4 as const}],
 variant:[{name:'instanceColor',size:3 as const}],frame:['original-mesh-matrix-world','original-instance-matrix','inverse-combined-matrix','is-instanced','instance-translation-xz','source-world-position','source-local-position','source-object-normal'],samplers:['map','vgNrm'],dynamic:['fadeFrame','renderTargetHeight','windT','windAmp','snow','cityAO','cityAORect','cityAOAmt','lb14Gao','night','cs34','cs34Col','st34']};
}
