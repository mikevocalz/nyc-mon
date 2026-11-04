interface CohortMesh {
  name: string;
  visible: boolean;
  userData: { cell?: number; cellFade?: number };
}

/** One shell cell can be replaced by several family layers and overlapping packs. */
export function createNearCohortMask(onVisibilityChanged?:()=>void) {
  const layers = new Set<string>();
  const cells = new Map<number, Map<string, { expected: number; attached: number; faded: number }>>();
  const complete = new Set<number>();
  const drawable = new Set<number>();
  return {
    /** Register every required package before the first update. Templates have no cell ID. */
    register(layer: string, packages: readonly { num: number }[]) {
      layers.add(layer);
      for (const { num } of packages) {
        let cell = cells.get(num);
        if (!cell) { cell = new Map(); cells.set(num, cell); }
        let count = cell.get(layer);
        if (!count) { count = { expected: 0, attached: 0, faded: 0 }; cell.set(layer, count); }
        count.expected++;
      }
    },
    /** Bounded diagnostics read the last real attachment/fade census, without changing visibility. */
    status(num:number){
      const cell=cells.get(num);let expected=0,attached=0,faded=0;
      for(const count of cell?.values() ?? []){expected+=count.expected;attached+=count.attached;faded+=count.faded;}
      return {expected,attached,faded,drawable:drawable.has(num),complete:complete.has(num)};
    },
    update(meshes: readonly CohortMesh[]): ReadonlySet<number> {
      complete.clear();
      drawable.clear();
      for (const cell of cells.values()) for (const count of cell.values()) count.attached = count.faded = 0;
      for (const mesh of meshes) {
        const num = mesh.userData.cell;
        if (num === undefined) continue;
        const count = cells.get(num)?.get(mesh.name);
        if (!count) continue;
        count.attached++;
        if ((mesh.userData.cellFade ?? 1) >= 1) count.faded++;
      }
      for (const [num, cell] of cells) {
        let attached = true, faded = true;
        for (const count of cell.values()) {
          attached &&= count.attached === count.expected;
          faded &&= count.faded === count.expected;
        }
        if (attached && faded) complete.add(num);
        if (attached) drawable.add(num);
      }
      // No partly assembled facade: keep the shell until every family is attached.
      let changed=false;
      for (const mesh of meshes) if (mesh.userData.cell !== undefined && layers.has(mesh.name)) {
        const visible=drawable.has(mesh.userData.cell);
        if(mesh.visible!==visible){mesh.visible=visible;changed=true;}
      }
      if(changed)onVisibilityChanged?.();
      return complete;
    },
  };
}
