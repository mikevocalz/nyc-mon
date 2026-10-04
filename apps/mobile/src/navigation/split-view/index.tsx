// TS resolution anchor. Bundlers load the platform forks: index.ios.tsx
// (expo-router's UISplitViewController), index.android.tsx and index.web.tsx
// (both AdaptiveSplitView).
//
// MUST be .tsx, matching the forks' extension. Metro resolves in the order
// .android.ts | .native.ts | .ts | .android.tsx | .native.tsx | .tsx, so a
// `.ts` anchor beside `.tsx` forks wins on native.
//
// It re-exports the adaptive implementation, never the iOS fork: on any
// platform without its own fork this file IS the bundle, and expo-router's
// SplitView outside iOS warns and renders a bare <Slot />, so the sidebar and
// list columns never mount.
export * from './AdaptiveSplitView';
