/**
 * Where the view fetches Mon GLBs (`/mons/<id>.glb`, served by the web-sim host).
 * NYC_MON_MODEL_ORIGIN for a deployed host; the sim's local origin otherwise.
 * Kept apart from index.ts so build.ts can import it without the MCP server deps.
 */
function modelOrigin(env: Record<string, string | undefined>): string {
  const raw = env.NYC_MON_MODEL_ORIGIN?.trim();
  if (!raw && env.NODE_ENV === 'production') {
    throw new Error('NYC_MON_MODEL_ORIGIN is required in production: the Mon card would fetch models from localhost.');
  }
  return new URL(raw || 'http://localhost:5180').origin;
}

export const MON_MODEL_ORIGIN = modelOrigin(process.env);
