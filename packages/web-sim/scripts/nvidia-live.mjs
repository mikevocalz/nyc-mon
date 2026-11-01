import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Node 24 strip-only mode cannot execute TypeScript parameter properties.
// Keep the necessary native transform flag explicit rather than relying on hidden NODE_OPTIONS.
const child = spawn(process.execPath, ['--experimental-transform-types', fileURLToPath(new URL('./nvidia-live.ts', import.meta.url)), ...process.argv.slice(2)], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('NVIDIA proof process could not start.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
