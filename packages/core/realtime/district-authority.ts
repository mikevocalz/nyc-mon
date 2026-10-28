/**
 * Colyseus 0.18 room-ready deterministic district authority, independent of
 * networking. The Room must verify Better Auth and map client.sessionId to a
 * server-owned member before calling join()/submit(). This code never trusts
 * a player id, scene position or elapsed time from a client message.
 *
 * Scene x/z are metres from the OSM tile origin, not device GPS or a public
 * lat/lon stream. Persistent world saves and Mon inventories stay elsewhere.
 */
export interface DistrictSpec {
  districtId: string;
  /** Half-extent of the baked tile, metres. */
  extentMetres: number;
  maxPlayers: number;
  tickMs: number;
  walkMetresPerSecond: number;
  runMetresPerSecond: number;
  /** Optional server-side wall/road clearance query; never client provided. */
  walkable?: (x:number,z:number) => boolean;
  /**
   * Side of one square cell of the walkability grid, metres. A move is checked
   * against `walkable` at the centre of every cell its segment crosses, so a
   * wall thinner than one tick of movement still blocks it. Default 0.5.
   */
  walkableCellMetres?: number;
}
export interface TrustedJoin {
  /** Session assigned to a verified Colyseus client, not request body. */
  sessionId: string;
  /** Ephemeral in-room identifier, not email or auth principal. */
  callerId: string;
  /** Verified and restored on the trusted server, not client-passed GPS. */
  startX: number;
  startZ: number;
}
export interface MoveIntent {
  seq:number;
  dx:number;
  dz:number;
  run:boolean;
}
export type MoveRefusal = 'unknown_session'|'bad_sequence'|'invalid_vector';
export type JoinRefusal = 'invalid_join'|'room_full'|'outside_bounds'|'blocked_start'|'already_joined';
export interface DistrictPlayerSnapshot {
  callerId:string;
  x:number;
  z:number;
  tick:number;
}
interface Member {
  callerId:string;
  x:number;
  z:number;
  seq:number;
  pending:MoveIntent|null;
}
export const DEFAULT_DISTRICT_SPEC: DistrictSpec = {
  districtId:'harlem-apollo',
  extentMetres:850,
  maxPlayers:16,
  tickMs:50,
  walkMetresPerSecond:4.5,
  runMetresPerSecond:7.5,
};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const safeId=(n:unknown):n is string=>typeof n==='string'&&n.length>0&&n.length<=128;
export const DEFAULT_WALKABLE_CELL_METRES=0.5;
/**
 * Grid DDA (Amanatides & Woo): visits every cell of size `cell` that the
 * segment (x0,z0)->(x1,z1) passes through, in order, excluding the start cell.
 * Returns false as soon as `walkable` refuses a visited cell's centre.
 */
export function segmentCellsWalkable(
  x0:number,z0:number,x1:number,z1:number,cell:number,
  walkable:(x:number,z:number)=>boolean,
):boolean {
  let ix=Math.floor(x0/cell),iz=Math.floor(z0/cell);
  const endX=Math.floor(x1/cell),endZ=Math.floor(z1/cell);
  const dx=x1-x0,dz=z1-z0;
  const stepX=Math.sign(dx),stepZ=Math.sign(dz);
  const tDeltaX=stepX===0?Infinity:cell/Math.abs(dx);
  const tDeltaZ=stepZ===0?Infinity:cell/Math.abs(dz);
  let tMaxX=stepX===0?Infinity:((stepX>0?ix+1:ix)*cell-x0)/dx;
  let tMaxZ=stepZ===0?Infinity:((stepZ>0?iz+1:iz)*cell-z0)/dz;
  // A segment crosses at most |endX-ix|+|endZ-iz| cell boundaries.
  let remaining=Math.abs(endX-ix)+Math.abs(endZ-iz);
  while (remaining-->0) {
    if (tMaxX<tMaxZ) { ix+=stepX; tMaxX+=tDeltaX; }
    else { iz+=stepZ; tMaxZ+=tDeltaZ; }
    if (!walkable((ix+.5)*cell,(iz+.5)*cell)) return false;
  }
  return true;
}
/** Input direction, not displacement: diagonal length is clamped to one. */
export function normalizeInput(dx:number,dz:number):readonly [number,number] {
  const len=Math.hypot(dx,dz);
  return len>1?[dx/len,dz/len]:[dx,dz];
}

export class DistrictAuthority {
  private members = new Map<string,Member>();
  private tickNumber=0;
  readonly spec: DistrictSpec;
  constructor(spec: DistrictSpec = DEFAULT_DISTRICT_SPEC) {
    if (!safeId(spec.districtId) || !Number.isFinite(spec.extentMetres) ||
      spec.extentMetres<=0 || spec.extentMetres>2000 ||
      !Number.isSafeInteger(spec.maxPlayers) || spec.maxPlayers<1 || spec.maxPlayers>100 ||
      !Number.isSafeInteger(spec.tickMs) || spec.tickMs<16 || spec.tickMs>100 ||
      !finite(spec.walkMetresPerSecond) || spec.walkMetresPerSecond<=0 ||
      !finite(spec.runMetresPerSecond) || spec.runMetresPerSecond<spec.walkMetresPerSecond ||
      spec.runMetresPerSecond>15 ||
      (spec.walkableCellMetres!==undefined && (!finite(spec.walkableCellMetres) ||
        spec.walkableCellMetres<=0 || spec.walkableCellMetres>spec.extentMetres))) throw new Error('Invalid district authority specification');
    this.spec=spec;
  }
  join(input:TrustedJoin):JoinRefusal|null {
    if (!safeId(input.sessionId)||!safeId(input.callerId)||!finite(input.startX)||!finite(input.startZ)) return 'invalid_join';
    if (this.members.has(input.sessionId)) return 'already_joined';
    if ([...this.members.values()].some(m=>m.callerId===input.callerId)) return 'already_joined';
    if (this.members.size>=this.spec.maxPlayers) return 'room_full';
    if (Math.abs(input.startX)>this.spec.extentMetres || Math.abs(input.startZ)>this.spec.extentMetres) return 'outside_bounds';
    if (this.spec.walkable && !this.spec.walkable(input.startX,input.startZ)) return 'blocked_start';
    this.members.set(input.sessionId,{callerId:input.callerId,x:input.startX,z:input.startZ,seq:0,pending:null});
    return null;
  }
  /** Accept newer intent only. A burst of packets never applies movement more than once per server tick. */
  submit(sessionId:string,input:MoveIntent):MoveRefusal|null {
    const member=this.members.get(sessionId);
    if (!member) return 'unknown_session';
    if (!Number.isSafeInteger(input?.seq)||input.seq<=member.seq||input.seq<=0) return 'bad_sequence';
    if (!finite(input.dx)||!finite(input.dz)||Math.abs(input.dx)>1||Math.abs(input.dz)>1||
      typeof input.run!=='boolean') return 'invalid_vector';
    member.pending={seq:input.seq,dx:input.dx,dz:input.dz,run:input.run};
    member.seq=input.seq;
    return null;
  }
  /** Fixed server tick. Reject wall intersections; do not trust browser frame dt or elapsed time. */
  step():readonly DistrictPlayerSnapshot[] {
    this.tickNumber++;
    const dt=this.spec.tickMs/1000;
    for(const m of this.members.values()) {
      if (!m.pending) continue;
      const v=m.pending;
      m.pending=null;
      const [dx,dz]=normalizeInput(v.dx,v.dz);
      const speed=v.run?this.spec.runMetresPerSecond:this.spec.walkMetresPerSecond;
      const proposedX=m.x+dx*dt*speed,proposedZ=m.z+dz*dt*speed;
      if (Math.abs(proposedX)>this.spec.extentMetres||Math.abs(proposedZ)>this.spec.extentMetres) continue;
      const walkable=this.spec.walkable;
      if (walkable) {
        if (!walkable(proposedX,proposedZ)) continue;
        const cell=this.spec.walkableCellMetres??DEFAULT_WALKABLE_CELL_METRES;
        if (!segmentCellsWalkable(m.x,m.z,proposedX,proposedZ,cell,walkable)) continue;
      }
      m.x=proposedX;m.z=proposedZ;
    }
    return this.snapshot();
  }
  snapshot():readonly DistrictPlayerSnapshot[] {
    return Array.from(this.members.values(),m=>({callerId:m.callerId,x:m.x,z:m.z,tick:this.tickNumber}));
  }
  leave(sessionId:string):void { this.members.delete(sessionId); }
  clear():void { this.members.clear(); }
}
