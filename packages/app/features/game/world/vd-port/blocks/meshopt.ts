// meshoptimizer's vertex and index buffer decoders, in plain TypeScript: Hermes has no WebAssembly, so the decoder the
// cell packages use (Valdrada docs/specs/cell-package.md: EXT_meshopt_compression, lossless byte codecs, no filters) runs
// as the reference implementation. Ported from meshoptimizer 1.1.1 js/meshopt_decoder_reference.js (the reference decoder
// by Jasper St. Pierre; MIT License, Copyright (C) 2016-2026, by Arseny Kapoulkine (arseny.kapoulkine@gmail.com)), the
// filter branch dropped (the vd-port packs use none).

function assert(cond: boolean, what: string): asserts cond {
  if (!cond) throw new Error(`meshopt decode: ${what}`);
}

const dezig = (v: number) => ((v & 1) !== 0 ? ~(v >>> 1) : v >>> 1);

/** Decodes `elementCount` elements of `byteStride` bytes from an encodeVertexBuffer stream into `target`. */
export function decodeVertexBuffer(target: Uint8Array, elementCount: number, byteStride: number, source: Uint8Array): void {
  assert(source[0] === 0xa0 || source[0] === 0xa1, 'not a vertex buffer');
  assert(target.length >= elementCount * byteStride, 'target too small');
  const version = source[0]! & 0x0f;
  const maxBlockElements = Math.min((0x2000 / byteStride) & ~0x000f, 0x100);
  const deltas = new Uint8Array(maxBlockElements * byteStride);
  const tailSize = version === 0 ? byteStride : byteStride + byteStride / 4;
  const tailDataOffs = source.length - tailSize;
  const tempData = source.slice(tailDataOffs, tailDataOffs + byteStride);
  const channels = version === 0 ? null : source.slice(tailDataOffs + byteStride, tailDataOffs + tailSize);
  let srcOffs = 1;
  const headerModes = [[0, 2, 4, 8], [0, 1, 2, 4], [1, 2, 4, 8]];

  for (let dstElemBase = 0; dstElemBase < elementCount; dstElemBase += maxBlockElements) {
    const n = Math.min(elementCount - dstElemBase, maxBlockElements);
    const groupCount = ((n + 0x0f) & ~0x0f) >>> 4;
    const headerByteCount = ((groupCount + 0x03) & ~0x03) >>> 2;
    const controlBitsOffs = srcOffs;
    srcOffs += version === 0 ? 0 : byteStride / 4;
    deltas.fill(0);
    for (let byte = 0; byte < byteStride; byte++) {
      const deltaBase = byte * n;
      const controlMode = version === 0 ? 0 : (source[controlBitsOffs + (byte >>> 2)]! >>> ((byte & 0x03) << 1)) & 0x03;
      if (controlMode === 2) continue;
      if (controlMode === 3) {
        deltas.set(source.subarray(srcOffs, srcOffs + n), deltaBase);
        srcOffs += n;
        continue;
      }
      const headerBitsOffs = srcOffs;
      srcOffs += headerByteCount;
      for (let group = 0; group < groupCount; group++) {
        const mode = (source[headerBitsOffs + (group >>> 2)]! >>> ((group & 0x03) << 1)) & 0x03;
        const modeBits = headerModes[version === 0 ? 0 : controlMode + 1]![mode]!;
        const deltaOffs = deltaBase + (group << 4);
        if (modeBits === 0) continue;
        if (modeBits === 1) {
          const srcBase = srcOffs;
          srcOffs += 2;
          for (let m = 0; m < 16; m++) {
            let d = (source[srcBase + (m >>> 3)]! >>> (m & 0x07)) & 0x01;
            if (d === 1) d = source[srcOffs++]!;
            deltas[deltaOffs + m] = d;
          }
        } else if (modeBits === 2) {
          const srcBase = srcOffs;
          srcOffs += 4;
          for (let m = 0; m < 16; m++) {
            let d = (source[srcBase + (m >>> 2)]! >>> (6 - ((m & 0x03) << 1))) & 0x03;
            if (d === 3) d = source[srcOffs++]!;
            deltas[deltaOffs + m] = d;
          }
        } else if (modeBits === 4) {
          const srcBase = srcOffs;
          srcOffs += 8;
          for (let m = 0; m < 16; m++) {
            let d = (source[srcBase + (m >>> 1)]! >>> (4 - ((m & 0x01) << 2))) & 0x0f;
            if (d === 0xf) d = source[srcOffs++]!;
            deltas[deltaOffs + m] = d;
          }
        } else {
          deltas.set(source.subarray(srcOffs, srcOffs + 16), deltaOffs);
          srcOffs += 16;
        }
      }
    }
    for (let elem = 0; elem < n; elem++) {
      const dstElem = dstElemBase + elem;
      for (let byteGroup = 0; byteGroup < byteStride; byteGroup += 4) {
        const channelMode = channels === null ? 0 : channels[byteGroup >>> 2]! & 0x03;
        assert(channelMode !== 0x03, 'channel mode 3');
        if (channelMode === 0) {
          for (let byte = byteGroup; byte < byteGroup + 4; byte++) {
            const t = (tempData[byte]! + dezig(deltas[byte * n + elem]!)) & 0xff;
            target[dstElem * byteStride + byte] = tempData[byte] = t;
          }
        } else if (channelMode === 1) {
          for (let byte = byteGroup; byte < byteGroup + 4; byte += 2) {
            const d = dezig(deltas[byte * n + elem]! + (deltas[(byte + 1) * n + elem]! << 8));
            const t = (tempData[byte]! + (tempData[byte + 1]! << 8) + d) & 0xffff;
            const o = dstElem * byteStride + byte;
            target[o] = tempData[byte] = t & 0xff;
            target[o + 1] = tempData[byte + 1] = t >>> 8;
          }
        } else {
          const byte = byteGroup;
          const d = deltas[byte * n + elem]! + (deltas[(byte + 1) * n + elem]! << 8) + (deltas[(byte + 2) * n + elem]! << 16) + (deltas[(byte + 3) * n + elem]! << 24);
          let t = tempData[byte]! + (tempData[byte + 1]! << 8) + (tempData[byte + 2]! << 16) + (tempData[byte + 3]! << 24);
          const rot = channels![byteGroup >>> 2]! >>> 4;
          t ^= (d >>> rot) | (d << (32 - rot));
          const o = dstElem * byteStride + byte;
          target[o] = tempData[byte] = t & 0xff;
          target[o + 1] = tempData[byte + 1] = (t >>> 8) & 0xff;
          target[o + 2] = tempData[byte + 2] = (t >>> 16) & 0xff;
          target[o + 3] = tempData[byte + 3] = t >>> 24;
        }
      }
    }
  }
  const tailSizePadded = Math.max(tailSize, version === 0 ? 32 : 24);
  assert(srcOffs === source.length - tailSizePadded, 'trailing bytes');
}

function pushfifo(fifo: Uint32Array, n: number) {
  for (let i = fifo.length - 1; i > 0; i--) fifo[i] = fifo[i - 1]!;
  fifo[0] = n;
}

/** Decodes `count` indices from an encodeIndexBuffer stream into `target` (Uint16Array or Uint32Array). */
export function decodeIndexBuffer(target: Uint16Array | Uint32Array, count: number, source: Uint8Array): void {
  assert(source[0] === 0xe1, 'not an index buffer');
  assert(count % 3 === 0 && target.length >= count, 'index count');
  const dst = target;
  const triCount = count / 3;
  let codeOffs = 1;
  let dataOffs = codeOffs + triCount;
  const codeauxOffs = source.length - 0x10;
  const readLEB128 = () => {
    let n = 0;
    for (let i = 0; ; i += 7) {
      const b = source[dataOffs++]!;
      n |= (b & 0x7f) << i;
      if (b < 0x80) return n;
    }
  };
  let next = 0, last = 0;
  const edgefifo = new Uint32Array(32);
  const vertexfifo = new Uint32Array(16);
  const decodeIndex = (v: number) => (last += dezig(v));
  let o = 0;
  for (let i = 0; i < triCount; i++) {
    const code = source[codeOffs++]!;
    const b0 = code >>> 4, b1 = code & 0x0f;
    if (b0 < 0x0f) {
      const a = edgefifo[(b0 << 1) + 0]!, b = edgefifo[(b0 << 1) + 1]!;
      let c = -1;
      if (b1 === 0x00) { c = next++; pushfifo(vertexfifo, c); }
      else if (b1 < 0x0d) c = vertexfifo[b1]!;
      else if (b1 === 0x0d) { c = --last; pushfifo(vertexfifo, c); }
      else if (b1 === 0x0e) { c = ++last; pushfifo(vertexfifo, c); }
      else { c = decodeIndex(readLEB128()); pushfifo(vertexfifo, c); }
      pushfifo(edgefifo, b); pushfifo(edgefifo, c); pushfifo(edgefifo, c); pushfifo(edgefifo, a);
      dst[o++] = a; dst[o++] = b; dst[o++] = c;
    } else {
      let a = -1, b = -1, c = -1;
      if (b1 < 0x0e) {
        const e = source[codeauxOffs + b1]!;
        const z = e >>> 4, w = e & 0x0f;
        a = next++;
        b = z === 0 ? next++ : vertexfifo[z - 1]!;
        c = w === 0 ? next++ : vertexfifo[w - 1]!;
        pushfifo(vertexfifo, a);
        if (z === 0) pushfifo(vertexfifo, b);
        if (w === 0) pushfifo(vertexfifo, c);
      } else {
        const e = source[dataOffs++]!;
        if (e === 0) next = 0;
        const z = e >>> 4, w = e & 0x0f;
        a = b1 === 0x0e ? next++ : decodeIndex(readLEB128());
        b = z === 0 ? next++ : z === 0x0f ? decodeIndex(readLEB128()) : vertexfifo[z - 1]!;
        c = w === 0 ? next++ : w === 0x0f ? decodeIndex(readLEB128()) : vertexfifo[w - 1]!;
        pushfifo(vertexfifo, a);
        if (z === 0 || z === 0x0f) pushfifo(vertexfifo, b);
        if (w === 0 || w === 0x0f) pushfifo(vertexfifo, c);
      }
      pushfifo(edgefifo, a); pushfifo(edgefifo, b); pushfifo(edgefifo, b); pushfifo(edgefifo, c); pushfifo(edgefifo, c); pushfifo(edgefifo, a);
      dst[o++] = a; dst[o++] = b; dst[o++] = c;
    }
  }
}
