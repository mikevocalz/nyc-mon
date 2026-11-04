import type { TriangleCollision } from './triangle-collision.ts';

type Entry = { proxy: TriangleCollision; camera: boolean; body: boolean; visible(): boolean };
const scenes = new Set<Set<Entry>>();
let revision = 0;
const subscribers=new Set<()=>void>();
let notificationQueued=false;
function changedRevision(){
  revision++;
  if(notificationQueued||subscribers.size===0)return;
  notificationQueued=true;
  queueMicrotask(()=>{notificationQueued=false;for(const notify of subscribers)notify();});
}
export function subscribeResidentCollision(notify:()=>void):()=>void {
  subscribers.add(notify);return()=>{subscribers.delete(notify);};
}
export const residentCollisionRevision = () => revision;

/** Scene-owned CPU data only. No renderer/mesh handles cross into serialized state. */
export function createResidentCollisionScene() {
  const entries = new Set<Entry>(); scenes.add(entries); changedRevision();
  let disposed = false;
  return {
    add(proxy: TriangleCollision, policy: { camera: boolean; body: boolean }, visible: () => boolean = () => true) {
      if (disposed) throw new Error('Collision scene disposed');
      if (!proxy.triangles || (!policy.camera && !policy.body)) return () => {};
      const entry = { proxy, ...policy, visible }; entries.add(entry); changedRevision();
      let removed = false;
      return () => { if (removed) return; removed = true; entries.delete(entry); changedRevision(); };
    },
    changed() { changedRevision(); },
    get bytes() { let bytes = 0; for (const entry of entries) bytes += entry.proxy.bytes; return bytes; },
    get triangles() { let triangles = 0; for (const entry of entries) triangles += entry.proxy.triangles; return triangles; },
    dispose() { if (disposed) return; disposed = true; entries.clear(); scenes.delete(entries); changedRevision(); },
  };
}

export function residentSourceBlocked(x: number, y: number, z: number, radius: number, body = false): boolean {
  for (const entries of scenes) for (const entry of entries) {
    if (!(body ? entry.body : entry.camera) || !entry.visible()) continue;
    if (entry.proxy.blocked(x, y, z, radius)) return true;
  }
  return false;
}

export function residentCollisionStats() {
  let bytes = 0, triangles = 0, proxies = 0;
  for (const entries of scenes) for (const entry of entries) { bytes += entry.proxy.bytes; triangles += entry.proxy.triangles; proxies++; }
  return { bytes, triangles, proxies };
}
