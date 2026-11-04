/** Tracks rendered/wanted foliage instead of treating every distant registry family as an animation request. */
export function createSourceVegetationActivity(vegetationCohorts: ReadonlySet<number>) {
  let wanted=false;
  const resident=new Map<number,()=>boolean>();
  return {
    setWanted(ids:readonly number[]){wanted=ids.some(id=>vegetationCohorts.has(id));},
    /** Readiness stays held during fade-out and turns false on actual package eviction. */
    register(id:number,ready:()=>boolean){
      if(!vegetationCohorts.has(id))return ()=>{};
      resident.set(id,ready);
      return ()=>{if(resident.get(id)===ready)resident.delete(id);};
    },
    get animated(){return wanted || [...resident.values()].some(ready=>ready());},
    dispose(){wanted=false;resident.clear();},
  };
}
