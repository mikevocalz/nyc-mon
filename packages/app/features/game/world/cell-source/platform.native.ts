// Native platform IO: react-native-nitro-fetch for the downloads (through @acme/ui/net, which falls back to the
// platform fetch when the native module is absent), expo-crypto's binary sha256, and the cell cache on disk under
// Paths.cache/vd-cells through expo-file-system's File/Directory API. Writes are atomic: the payload lands in
// <name>.tmp and is moved over the final name, so a crash mid-write never leaves a torn cell.
import { Directory, File, Paths } from 'expo-file-system';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { binaryFetch } from '@acme/ui/net';
import { fetchBytesWithDeadline, type DownloadDeadline } from './deadline.ts';
import type { CellIo, CellStore } from './types.ts';

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function platformIo(deadline?: DownloadDeadline): CellIo {
  return {
    async fetchBytes(url, signal) {
      return fetchBytesWithDeadline(url, signal, deadline, binaryFetch);
    },
    async sha256Hex(b) {
      return hex(await digest(CryptoDigestAlgorithm.SHA256, b as Uint8Array<ArrayBuffer>));
    },
    now: () => Date.now(),
  };
}

export function platformStore(): CellStore {
  const dir = new Directory(Paths.cache, 'vd-cells');
  const ensure = () => {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  };
  const fileOf = (name: string) => new File(dir, name);
  return {
    async list() {
      ensure();
      return dir.list().filter((e): e is File => e instanceof File).map((f) => f.name);
    },
    async read(name) {
      const f = fileOf(name);
      if (!f.exists) return null;
      return new Uint8Array(await f.arrayBuffer());
    },
    async write(name, bytes) {
      ensure();
      const tmp = fileOf(`${name}.tmp`);
      const dest = fileOf(name);
      tmp.create({ intermediates: true, overwrite: true });
      await tmp.write(bytes);
      await tmp.move(dest, { overwrite: true });
    },
    async remove(name) {
      const f = fileOf(name);
      if (f.exists) f.delete();
    },
  };
}
