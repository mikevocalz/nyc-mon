// The story iframe gets these from preview-head.html; Vitest's browser runner
// doesn't load that file, so the same shims go here.
const g = globalThis as Record<string, unknown>;
g.global ??= globalThis;
g.process ??= { env: {} };
