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
      spec.runMetresPerSecond>15) throw new Error('Invalid district authority specification');
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
      if (this.spec.walkable&&!this.spec.walkable(proposedX,proposedZ)) continue;
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
