// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx, matching the forks' extension: Metro resolves .ts before
// .native.tsx, so a .ts anchor beside .tsx forks would win on native.
// Mobbin: see PaneListHeader.native.tsx — the forks carry the structure citations.
export { PaneListHeader, type PaneListHeaderProps } from './PaneListHeader.web';
