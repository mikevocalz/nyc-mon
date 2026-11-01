import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Node 24 needs the transform flag for parameter properties in the typed runtime modules.
const child = spawn(process.execPath, ['--experimental-transform-types', fileURLToPath(new URL('./nvidia-main.ts', import.meta.url)), ...process.argv.slice(2)], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('NVIDIA companion process could not start.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
