import { capturedTextureTable } from './surface-capture.mjs';

const SAMPLER = ['colorSpace','wrapS','wrapT','flipY','premultiplyAlpha','unpackAlignment','minFilter','magFilter','anisotropy','generateMipmaps'];
const samePayload = (a,b) => ['sha256','format','type','width','height'].every(key => a[key] === b[key]);

/** Connect captured IDs to exact packed pages; placeholders are never residency. */
export function surfaceBankBindings(capture, bank) {
  const { textures } = capturedTextureTable(capture);
  const semantics = bank.textures.filter(texture => /^(pbr:|env:)/.test(texture.uuid)).sort((a,b)=>a.uuid.localeCompare(b.uuid));
  const semanticTextures = semantics.map((texture,index) => {
    const {uuid,...props}=texture;
    return {...props,id:textures.length+index,semantic:uuid};
  });
  const bySemantic = new Map(semanticTextures.map(texture=>[texture.semantic,texture]));
  return { semanticTextures, resolveTextureBinding({material,role,uniform,initialBinding}) {
    const pbrRole={pbAlb:'albedo',pbNrm:'normal',pbOrm:'orm'}[role];
    const semantic = pbrRole && material.pbr?.set ? `pbr:${material.pbr.set}:${pbrRole}` : uniform?.dynamic === 'cityAO' ? 'env:cityAO' : null;
    if (semantic) {
      const actual=bySemantic.get(semantic);
      if (!actual) throw new Error(`Packed authored resource missing ${semantic}`);
      return {...actual,texture:actual.id};
    }
    if (uniform?.dynamic) throw new Error(`Unresolved dynamic authored sampler ${uniform.dynamic}`);
    const actual=bank.textures.find(texture=>samePayload(texture,initialBinding)&&SAMPLER.every(key=>texture[key]===initialBinding[key]));
    if (!actual) throw new Error(`Captured authored texture page missing ${role}:${initialBinding.sha256}`);
    return {...initialBinding,page:actual.page,layer:actual.layer};
  } };
}
