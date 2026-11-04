/** Bake-only tracking: distinguish explicit source writes from Three constructor defaults; preserve values. */
export function installSourceShadowTracking(THREE) {
  const state = new WeakMap();
  const entry = object => { let value = state.get(object); if (!value) { value = {}; state.set(object, value); } return value; };
  for (const name of ['castShadow','receiveShadow']) Object.defineProperty(THREE.Object3D.prototype,name,{
    configurable:true,
    get(){return entry(this)[name]?.value ?? false;},
    set(value){
      const stack = new Error().stack ?? '';
      const constructor = stack.includes('new Object3D ');
      const internalCopy = /\.copy \([^\n]*(?:three\.core|three\.module)/.test(stack);
      const source = stack.split('\n').map(line=>line.match(/https?:\/\/[^\s)]+\/src\/([^\s)]+):(\d+):(\d+)/)).find(Boolean);
      entry(this)[name] = {value,explicit:!constructor&&!internalCopy&&!!source,source:source?{file:`client/src/${source[1]}`,line:Number(source[2])}:null};
    },
  });
  const originalCopy=THREE.Object3D.prototype.copy;
  THREE.Object3D.prototype.copy=function(source,...args){const result=originalCopy.call(this,source,...args);const original=state.get(source);if(original)state.set(this,{...original});return result;};
  return object => {
    const flags=state.get(object)??{};
    const cast=flags.castShadow,receive=flags.receiveShadow;
    return {castShadow:cast?.explicit?!!object.castShadow:true,receiveShadow:receive?.explicit?!!object.receiveShadow:true,
      castOwner:cast?.explicit?'authored-source':'native-block-owner',receiveOwner:receive?.explicit?'authored-source':'native-block-owner',
      sourceCastShadow:!!object.castShadow,sourceReceiveShadow:!!object.receiveShadow,assignments:flags};
  };
}
