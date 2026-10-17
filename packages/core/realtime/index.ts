/** Network authority contracts; no Colyseus dependency until adapter lock is pinned. */
export {
  DistrictAuthority,
  DEFAULT_DISTRICT_SPEC,
  normalizeInput,
  type DistrictSpec,
  type DistrictPlayerSnapshot,
  type MoveIntent,
  type MoveRefusal,
  type JoinRefusal,
  type TrustedJoin,
} from './district-authority.ts';
