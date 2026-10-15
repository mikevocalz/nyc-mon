// The story iframe gets these from preview-head.html; Vitest's browser runner
// doesn't load that file, so the same shims go here.
const g = globalThis as Record<string, unknown>;
g.global ??= globalThis;
g.process ??= { env: {} };
// Transpiled RN packages read __DEV__ at module scope (packages/ui/rn-globals-shim.ts).
// A story that imports one of them (EggCase imports react-native-reanimated)
// before anything from tw.tsx runs evaluates it before that shim does.
g.__DEV__ ??= (g.process as { env?: { NODE_ENV?: string } }).env?.NODE_ENV !== 'production';
