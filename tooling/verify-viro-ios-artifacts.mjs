import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const archive = fileURLToPath(new URL('vendor/reactvision-react-viro-3.0.3-moyo.1.tgz', root));
const source = JSON.parse(readFileSync(new URL('vendor/reactvision-react-viro-3.0.3-moyo.1.SOURCE.json', root), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha(readFileSync(archive)) !== source.archiveSha256) throw new Error('Viro vendor archive hash mismatch');
for (const path of ['ios/dist/lib/libViroReact.a', 'ios/dist/ViroRenderer/ViroKit.framework/ViroKit']) {
  const bytes = execFileSync('tar', ['-xOf', archive, `package/${path}`], { maxBuffer: 64 * 1024 * 1024 });
  if (bytes.length < 1_000_000 || sha(bytes) !== source.nativeBinaries[path]) throw new Error(`Invalid pinned iOS Viro binary: ${path}`);
  const archiveMagic = bytes.subarray(0, 8).toString() === '!<arch>\n';
  const machoMagic = bytes.readUInt32LE(0) === 0xfeedfacf;
  if (path.endsWith('.a') ? !archiveMagic : !machoMagic) throw new Error(`Unexpected iOS binary format: ${path}`);
}
console.log('Pinned Viro iOS archive and both native binaries verified');
