import {sourceFrameValues} from './surface-frame.mjs';
import {SOURCE_BASE_PARAMETER_FIELDS,SOURCE_VARIANT_PARAMETER_FIELDS,SOURCE_PILOT_FRAME_FIELDS} from '../../../packages/app/features/game/world/vd-port/blocks/source-parameter-layout.ts';
import {sourcePbrParameterSchema,classifySourcePbr} from '../../../packages/app/features/game/world/vd-port/blocks/source-pbr-programs.ts';
import {pilotFkParameterSchema,classifyPilotFk} from '../../../packages/app/features/game/world/vd-port/blocks/source-fk-programs.ts';
import {sourceSignParameterSchema,classifySourceSignMaterial} from '../../../packages/app/features/game/world/vd-port/blocks/source-sign-programs.ts';
import {sourcePbrGlassParameterSchema,classifySourcePbrGlass} from '../../../packages/app/features/game/world/vd-port/blocks/source-glass-programs.ts';
import {sourceStandardParameterSchema,classifySourceStandard} from '../../../packages/app/features/game/world/vd-port/blocks/source-standard-programs.ts';
import {apolloParameterSchema,classifyApolloSource} from '../../../packages/app/features/game/world/vd-port/blocks/source-apollo-programs.ts';
import {customBuildingParameterSchema,customBuildingSourceConstants,classifyCustomBuildingSource} from '../../../packages/app/features/game/world/vd-port/blocks/source-custom-building-programs.ts';
import {vegetationParameterSchema,classifyVegetationSource} from '../../../packages/app/features/game/world/vd-port/blocks/source-vegetation-programs.ts';

const typed=(value,field)=>{
 const values=field.size===1?[value]:value;
 if(!Array.isArray(values)||values.length!==field.size||!values.every(value=>typeof value==='number'&&Number.isFinite(value)&&Number.isFinite(Math.fround(value))))throw new Error(`Missing exact source parameter ${field.name}`);
 return field.size===1?value:[...values];
};
const uvFields=roles=>roles.flatMap(role=>[...[0,1,2].map(column=>({name:`${role}Uv${column}`,size:3})),{name:`${role}Layer`,size:1}]);
const schemas={ 'source-pbr':sourcePbrParameterSchema,'source-fk':pilotFkParameterSchema,'source-sign':sourceSignParameterSchema,
 'source-glass':sourcePbrGlassParameterSchema,'source-standard':sourceStandardParameterSchema,'source-apollo':apolloParameterSchema,
 'source-custom-building':customBuildingParameterSchema,'source-vegetation':vegetationParameterSchema };
const classifiers={'source-pbr':classifySourcePbr,'source-fk':classifyPilotFk,'source-sign':classifySourceSignMaterial,'source-glass':classifySourcePbrGlass,'source-standard':classifySourceStandard,'source-apollo':classifyApolloSource,'source-custom-building':classifyCustomBuildingSource,'source-vegetation':classifyVegetationSource};
const identity=material=>({...material.source,type:material.type,vertexColors:material.vertexColors,hasAlphaTest:material.alphaTest>0,
 mapRoles:Object.keys(material.textureBindings??{}).filter(role=>!role.startsWith('uniform:')).sort(),attributeRoles:material.shader?.attrs??[],normalMapType:material.normalMapType});
function schemaFor(family,material){
 const select=schemas[family.name];if(!select)throw new Error(`Unbound source family ${family.name}`);
 if(family.staticFlags.vertexColors!==material.vertexColors||family.staticFlags.hasAlphaTest!==(material.alphaTest>0))throw new Error('Source family renderer flags disagree with material');
 if(family.name==='source-pbr'&&(!material.pbr||family.staticFlags.pbrSet!==material.pbr.set))throw new Error('Source PBR family set disagrees with descriptor');
 const source=identity(material),schema=select(source);
 const fingerprint=JSON.stringify(classifiers[family.name](source));
 return {...schema,fingerprint,material:family.name==='source-pbr'?[...SOURCE_BASE_PARAMETER_FIELDS,...schema.material]:schema.material};
}
function fieldsUnique(fields){
 const seen=new Map();for(const field of fields){const previous=seen.get(field.name);if(previous&&previous.size!==field.size)throw new Error(`Conflicting source field ${field.name}`);if(!previous)seen.set(field.name,field);}return[...seen.values()];
}
function sourceValue(material,field,family){
 if(field.name==='diffuse')return material.color;
 if(field.name==='envMapIntensity'){
  if(typeof material.environment?.hasMaterialEnvMap!=='boolean')throw new Error('Source environment policy was not captured');
  if(material.environment.hasMaterialEnvMap)throw new Error('Explicit source material environment map needs a reviewed runtime binding');
  return 1;
 }
 if(field.name==='sourceDayNight')return customBuildingSourceConstants(identity(material)).sourceDayNight;
 if(family.name==='source-pbr'){
  const enabled={weatherEnabled:'weatherAttr',grimeEnabled:'grimeAttr',dirtEnabled:'dirtAttr'}[field.name];
  const p=material.pbr?.[enabled??field.name];if(p!==undefined)return typeof p==='boolean'?Number(p):p;
 }
 if(material[field.name]!==undefined)return material[field.name];
 const uniform=material.shader?.uniforms?.[field.name];
 if(uniform?.dynamic)throw new Error(`Dynamic authored uniform ${field.name} needs a runtime binding`);
 return uniform;
}

/** Exact per-family schemas: missing active inputs fail; unused union columns are padding only after dependency validation. */
export function buildSurfaceParameters(registry){
 const materialSchemas=new Map(),materialById=new Map(registry.materials.map(material=>[material.id,material]));
 const familyById=new Map(registry.families.map(family=>[family.id,family]));
 const families=registry.families.map(family=>{
  const members=registry.materials.filter(material=>material.family===family.id);if(!members.length)throw new Error('Empty source family');
  const roles=family.staticFlags.textureRoles??[];
  const layout=schemaFor(family,members[0]);
  const fields=fieldsUnique([...layout.material,...uvFields(roles)]);
  const materials=members.map(material=>{
   const schema=schemaFor(family,material);materialSchemas.set(material.id,schema);
   if(schema.fingerprint!==layout.fingerprint||JSON.stringify(schema.material)!==JSON.stringify(layout.material))throw new Error('Source family combines incompatible parameter layouts');
   const values=Object.fromEntries(schema.material.map(field=>[field.name,sourceValue(material,field,family)]));
   for(const role of roles){
    const binding=material.textureBindings[role in material.textureBindings?role:`uniform:${role}`];
    if(!binding||!Array.isArray(binding.matrix)||binding.matrix.length!==9||!Number.isInteger(binding.layer))throw new Error(`Unbound original texture ${role}`);
    for(let column=0;column<3;column++)values[`${role}Uv${column}`]=binding.matrix.slice(column*3,column*3+3);
    values[`${role}Layer`]=binding.layer;
   }
   return{id:material.id,values:Object.fromEntries(fields.map(field=>[field.name,typed(values[field.name],field)]))};
  });return{id:family.id,fields,materials};
 });
 const aliases={fkTr:'aFkTr',pgBody:'aPgBody'};
 const variants=registry.variants.map((variant,row)=>{
  // Exact dependency metadata is mandatory: field presence cannot identify the consuming source shader.
  if(!Array.isArray(variant.materials)||!variant.materials.length)throw new Error(`Variant ${row} has no material usage audit`);
  const required=new Map();
  for(const id of variant.materials){
   const material=materialById.get(id);if(!material||!familyById.has(material.family))throw new Error(`Variant ${row} references unknown material`);
   const schema=materialSchemas.get(id);for(const field of schema.variant??[])required.set(field.name,field);
  }
  const raw=variant.fields??{};
  const values={...raw,fkTr:raw.aFkTr,pgBody:raw.aPgBody,frameRow:variant.frame};
  const sourceFrame=registry.frames[variant.frame];if(!sourceFrame)throw new Error(`Variant ${row} has an unknown original frame`);
  if((sourceFrame.isInstanced===false||sourceFrame.hasInstanceColor===false)&&!Object.hasOwn(raw,'instanceColor'))values.instanceColor=[1,1,1];
  // The absent instance color has the source's explicit identity semantics; it is not an inferred tint.
  else if(Object.hasOwn(raw,'instanceColor'))values.instanceColor=raw.instanceColor;
  for(const field of required.values())typed(values[field.name],field);
  const output={};
  for(const field of SOURCE_VARIANT_PARAMETER_FIELDS){
   if(field.name==='frameRow'){output[field.name]=typed(values[field.name],field);continue;}
   const key=aliases[field.name]??field.name;
   if(Object.hasOwn(raw,key)||field.name==='instanceColor'&&values.instanceColor!==undefined)output[field.name]=typed(values[field.name],field);
   else if(required.has(field.name))throw new Error(`Missing exact source variant ${field.name}`);
   else output[field.name]=field.size===1?0:Array(field.size).fill(0);
  }return output;
 });
 const frames=registry.frames.map(frame=>{const values=sourceFrameValues(frame);return Object.fromEntries(SOURCE_PILOT_FRAME_FIELDS.map(field=>[field.name,typed(values[field.name],field)]));});
 return{materialCount:registry.materials.length,families,variantFields:SOURCE_VARIANT_PARAMETER_FIELDS,variants,frameFields:SOURCE_PILOT_FRAME_FIELDS,frames};
}
/** Kept for existing pilot bake entry points; the implementation now validates every supported family. */
export const buildPilotSurfaceParameters=buildSurfaceParameters;
