#!/usr/bin/env node
// precompute-skies.mjs — turns each fetched .hdr in manifest.json into a
// committed <id>.json of sky-lighting data, plus a small tonemapped preview
// PNG under previews/. Run fetch-skies.mjs first.
//
//   node scripts/precompute-skies.mjs            # all manifest assets
//   node scripts/precompute-skies.mjs <id> ...   # subset
//
// Everything in the JSON is computed from the decoded HDR — no hand-entered
// numbers. Conventions a consumer (lane L1) needs:
//
//   * Axes: world y-up. Pixel (col, row) of the W×H equirect maps to
//       theta = pi * (row + 0.5) / H          (colatitude from +Y)
//       phi   = 2*pi * (col + 0.5) / W - pi   (azimuth)
//       dir   = (sin(theta) sin(phi), cos(theta), sin(theta) cos(phi))
//     so azimuth 0 is the image CENTRE column facing +Z and azimuth grows
//     toward +X. Poly Haven does not compass-align the image, so azimuth is
//     only self-consistent within one asset.
//   * Radiance stays linear HDR floats (RGBE is already linear); nothing is
//     clipped, so sun values legitimately run into the hundreds/thousands.
//   * skyIrradianceSH: 9 RGB coefficients, Ramamoorthi & Hanrahan (SIGGRAPH
//     2001, "An Efficient Representation for Irradiance Environment Maps")
//     order-2 projection with the cosine lobe folded in:
//       C_i = A_l * ∫ L(w) * Y_i(w) dw,  A = [π, 2π/3 ×3, π/4 ×5]
//     in basis order [1, x, y, z, x*y, y*z, 3y²-1, x*z, x²-z²] (y-up) with
//     normalised constants c0..c4 listed in shConvention of each JSON.
//     Reconstruct:  E(n) = Σ_i C_i * Y_i(n).
//     To reuse evalSH9 in packages/ui/three/cel/cel-shading.ts instead, see
//     shConvention.evalSH9Note in each JSON — its constants already fold A_l,
//     so divide by cosineLobe first and remap indices/signs as documented.

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeHDR } from './decode-hdr.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKIES_DIR = join(HERE, '..');

// ---- SH constants (y-up order-2) -------------------------------------------
const C0 = Math.sqrt(1 / (4 * Math.PI));   // 1
const C1 = Math.sqrt(3 / (4 * Math.PI));   // x, y, z
const C2 = Math.sqrt(15 / (4 * Math.PI));  // xy, yz, xz
const C3 = Math.sqrt(5 / (16 * Math.PI));  // 3y²-1
const C4 = Math.sqrt(15 / (16 * Math.PI)); // x²-z²
// Ramamoorthi–Hanrahan cosine-lobe weights per band (A_0=π, A_1=2π/3, A_2=π/4).
const A_L = [Math.PI, (2 * Math.PI) / 3, (2 * Math.PI) / 3, (2 * Math.PI) / 3,
  Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4];
const SH_BASIS = ['1', 'x', 'y', 'z', 'x*y', 'y*z', '3*y*y-1', 'x*z', 'x*x-z*z'];

const basisAt = (x, y, z) => [
  C0, C1 * x, C1 * y, C1 * z,
  C2 * x * y, C2 * y * z, C3 * (3 * y * y - 1), C2 * x * z, C4 * (x * x - z * z),
];

// ---- minimal PNG writer (8-bit RGB, filter 0) -------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
const encodePNG = (width, height, rgb /* Uint8Array w*h*3 */) => {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), rowStart + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const srgbEncode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const LUM = [0.2126, 0.7152, 0.0722]; // Rec.709 luma

const round = (v, digits = 6) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

const analyse = (id, meta, hdr) => {
  const { width: W, height: H, data } = hdr;
  const solidAnglePerPixel = (2 * Math.PI * Math.PI) / (W * H); // sin(theta) folded in per-pixel below
  const horizonBand = Math.sin((5 * Math.PI) / 180); // |dir.y| <= sin(5°)

  const lum = new Float32Array(W * H);
  let maxLum = 0;
  let maxIndex = 0;
  const mean = [0, 0, 0];
  const horizon = [0, 0, 0];
  let horizonOmega = 0;
  const sh = Array.from({ length: 9 }, () => [0, 0, 0]);
  // Unit direction per pixel, needed twice (SH pass + sun pass).
  const dirs = new Float32Array(W * H * 3);

  for (let row = 0; row < H; row++) {
    const theta = (Math.PI * (row + 0.5)) / H;
    const sinT = Math.sin(theta);
    const dy = Math.cos(theta);
    const dOmega = sinT * solidAnglePerPixel;
    for (let col = 0; col < W; col++) {
      const i = row * W + col;
      const phi = 2 * Math.PI * ((col + 0.5) / W) - Math.PI;
      const dx = sinT * Math.sin(phi);
      const dz = sinT * Math.cos(phi);
      dirs[i * 3] = dx;
      dirs[i * 3 + 1] = dy;
      dirs[i * 3 + 2] = dz;

      const r = data[i * 3];
      const g = data[i * 3 + 1];
      const b = data[i * 3 + 2];
      const l = LUM[0] * r + LUM[1] * g + LUM[2] * b;
      lum[i] = l;
      if (l > maxLum) {
        maxLum = l;
        maxIndex = i;
      }
      mean[0] += r * dOmega;
      mean[1] += g * dOmega;
      mean[2] += b * dOmega;

      const basis = basisAt(dx, dy, dz);
      for (let k = 0; k < 9; k++) {
        const w = basis[k] * dOmega;
        sh[k][0] += r * w;
        sh[k][1] += g * w;
        sh[k][2] += b * w;
      }

      if (Math.abs(dy) <= horizonBand) {
        horizon[0] += r * dOmega;
        horizon[1] += g * dOmega;
        horizon[2] += b * dOmega;
        horizonOmega += dOmega;
      }
    }
  }
  mean[0] /= 4 * Math.PI;
  mean[1] /= 4 * Math.PI;
  mean[2] /= 4 * Math.PI;
  if (horizonOmega > 0) {
    horizon[0] /= horizonOmega;
    horizon[1] /= horizonOmega;
    horizon[2] /= horizonOmega;
  }
  const shIrradiance = sh.map((c, k) => c.map((v) => v * A_L[k]));

  // ---- sun: brightest-cluster centroid -------------------------------------
  // Threshold at half the peak luma isolates the sun disc (it sits orders of
  // magnitude above the sky); pass 1 takes all above-threshold pixels, pass 2
  // keeps only those within 15° of the provisional centroid, then re-centroids.
  const centroid = (mask) => {
    const acc = [0, 0, 0];
    for (let i = 0; i < W * H; i++) {
      if (!mask(i)) continue;
      const w = lum[i];
      acc[0] += dirs[i * 3] * w;
      acc[1] += dirs[i * 3 + 1] * w;
      acc[2] += dirs[i * 3 + 2] * w;
    }
    const len = Math.hypot(acc[0], acc[1], acc[2]);
    return len > 0 ? [acc[0] / len, acc[1] / len, acc[2] / len] : null;
  };
  const threshold = 0.5 * maxLum;
  const c0 = centroid((i) => lum[i] >= threshold);
  if (!c0) throw new Error(`${id}: no sun cluster found`);
  const cos15 = Math.cos((15 * Math.PI) / 180);
  const inCluster = (i) =>
    lum[i] >= threshold &&
    dirs[i * 3] * c0[0] + dirs[i * 3 + 1] * c0[1] + dirs[i * 3 + 2] * c0[2] >= cos15;
  const sunDirection = centroid(inCluster);
  if (!sunDirection) throw new Error(`${id}: empty refined sun cluster`);

  // Cluster irradiance needs the per-row sin(theta), so sum scanline by scanline.
  // Also record the cluster's max angular spread: a few degrees means a real
  // disc, ~20 deg means a broad glow (dusk_1's sun is already below the
  // horizon; the cluster is the sunset glow), sub-degree means a point source
  // (night's brightest cluster is a star, not the moon).
  let clusterOmega = 0;
  let clusterPixels = 0;
  let clusterMinDot = 1;
  const sunMean = [0, 0, 0];
  for (let row = 0; row < H; row++) {
    const dOmega = Math.sin((Math.PI * (row + 0.5)) / H) * solidAnglePerPixel;
    for (let col = 0; col < W; col++) {
      const i = row * W + col;
      if (!inCluster(i)) continue;
      clusterPixels++;
      clusterOmega += dOmega;
      sunMean[0] += data[i * 3] * dOmega;
      sunMean[1] += data[i * 3 + 1] * dOmega;
      sunMean[2] += data[i * 3 + 2] * dOmega;
      const dot =
        dirs[i * 3] * sunDirection[0] + dirs[i * 3 + 1] * sunDirection[1] + dirs[i * 3 + 2] * sunDirection[2];
      if (dot < clusterMinDot) clusterMinDot = dot;
    }
  }
  sunMean[0] /= clusterOmega;
  sunMean[1] /= clusterOmega;
  sunMean[2] /= clusterOmega;
  const clusterSpreadDeg = (Math.acos(Math.max(-1, Math.min(1, clusterMinDot))) * 180) / Math.PI;
  const peak = [data[maxIndex * 3], data[maxIndex * 3 + 1], data[maxIndex * 3 + 2]];

  const elevationDeg = (Math.asin(Math.max(-1, Math.min(1, sunDirection[1]))) * 180) / Math.PI;
  const azimuthDeg = (Math.atan2(sunDirection[0], sunDirection[2]) * 180) / Math.PI;

  // Hex of the horizon hue (normalised so the max channel maps to 1), for
  // palette comparison — the linear value stays authoritative.
  const horizonHex = (() => {
    const m = Math.max(...horizon);
    if (m <= 0) return null;
    const to255 = (v) => Math.round(srgbEncode(v / m) * 255).toString(16).padStart(2, '0');
    return `#${to255(horizon[0])}${to255(horizon[1])}${to255(horizon[2])}`.toUpperCase();
  })();

  const sunHex = (() => {
    const m = Math.max(...sunMean);
    if (m <= 0) return null;
    const to255 = (v) => Math.round(srgbEncode(v / m) * 255).toString(16).padStart(2, '0');
    return `#${to255(sunMean[0])}${to255(sunMean[1])}${to255(sunMean[2])}`.toUpperCase();
  })();

  const json = {
    id,
    kind: 'nyc-mon/sky-lighting/v1',
    generatedAt: new Date().toISOString(),
    generatedBy: 'packages/assets/skies/scripts/precompute-skies.mjs',
    source: {
      assetId: meta.id,
      assetName: meta.name,
      authors: meta.authors,
      assetPage: meta.assetPage,
      apiInfoUrl: meta.apiInfoUrl,
      fileUrl: meta.file.url,
      file: meta.file.path,
      format: 'Radiance RGBE .hdr (equirectangular)',
      resolution: meta.file.resolution,
      width: W,
      height: H,
      sha256: meta.file.sha256,
      md5: meta.file.md5,
      fetchedAt: meta.file.fetchedAt,
      license: meta.license,
    },
    axes: 'y-up right-handed world; dir = (sin(theta)*sin(phi), cos(theta), sin(theta)*cos(phi)), ' +
      'phi = 2*pi*u - pi so azimuth 0 faces +Z at the equirect image centre; ' +
      'azimuth increases toward +X. Azimuth is not compass-aligned.',
    sunDirection: sunDirection.map((v) => round(v)),
    sunElevationDeg: round(elevationDeg, 3),
    sunAzimuthDeg: round(azimuthDeg, 3),
    /** Mean radiance (linear RGB) across the detected sun disc, solid-angle weighted. */
    sunIrradiance: sunMean.map((v) => round(v)),
    sunIrradianceHexNormalised: sunHex,
    sunPeakRadiance: peak.map((v) => round(v)),
    sunClusterSolidAngleSr: round(clusterOmega),
    /** Angular distance from the centroid of the cluster's farthest pixel; degrees. */
    sunClusterSpreadDeg: round(clusterSpreadDeg, 3),
    skyIrradianceSH: shIrradiance.map((c) => c.map((v) => round(v))),
    shConvention: {
      basisOrder: SH_BASIS,
      axes: 'y-up; 6th coefficient uses 3*y^2-1 and the last uses x^2-z^2',
      shConstants: { c0: C0, c1: C1, c2: C2, c3: C3, c4: C4 },
      cosineLobe: { l0: Math.PI, l1: (2 * Math.PI) / 3, l2: Math.PI / 4, foldedIn: true },
      reconstruct: 'E(n) = sum_i skyIrradianceSH[i] * shConstant_i * basis_i(n)',
      reference: 'Ramamoorthi & Hanrahan, SIGGRAPH 2001 (A_l = pi, 2pi/3, pi/4)',
      evalSH9Note:
        'packages/ui/three/cel/cel-shading.ts evalSH9 already folds A_l into SH_L0/L1/L2_* constants ' +
        'and uses z-up basis order [1, y, z, x, xy, yz, 3z^2-1, xz, x^2-y^2] with negated L1. ' +
        'To reuse it: divide these coefficients by cosineLobe per band to recover raw L_lm, ' +
        'feed (sh0,sh1,sh2,sh3) = (-L_y, -L_z, -L_x) per its sign convention, ' +
        '(sh4,sh5,sh6,sh7,sh8) = (L_xy, L_yz, L_3y2-1, L_xz, L_x2-z2), ' +
        'and evaluate with the normal swizzled n -> (x, z, y).',
    },
    /** Mean linear radiance within +/-5 deg of the horizon (dir.y <= sin 5°). */
    horizonColor: horizon.map((v) => round(v)),
    horizonColorHexNormalised: horizonHex,
    stats: {
      meanRadiance: mean.map((v) => round(v)),
      maxLuminance: round(maxLum),
      sunClusterPixels: clusterPixels,
      sunClusterThresholdLuminance: round(threshold),
    },
  };

  return { json, lum, mean };
};

// Tonemapped 512x256 preview: e-clip map v = 1 - exp(-k*c) with k fit so the
// 99.5th-percentile luma lands ~0.95, then sRGB. Preview only — never lighting data.
const previewPNG = (hdr, lum) => {
  const PW = 512;
  const PH = 256;
  const { width: W, height: H, data } = hdr;
  const sample = [];
  for (let i = 0; i < lum.length; i += 64) sample.push(lum[i]);
  sample.sort((a, b) => a - b);
  const p995 = sample[Math.floor(sample.length * 0.995)] || 1;
  const k = -Math.log(1 - 0.95) / p995;
  const px = new Uint8Array(PW * PH * 3);
  for (let y = 0; y < PH; y++) {
    const sy = Math.min(H - 1, Math.floor((y / PH) * H));
    for (let x = 0; x < PW; x++) {
      const sx = Math.min(W - 1, Math.floor((x / PW) * W));
      const si = (sy * W + sx) * 3;
      const o = (y * PW + x) * 3;
      for (let c = 0; c < 3; c++) {
        px[o + c] = Math.round(srgbEncode(Math.min(1, Math.max(0, 1 - Math.exp(-k * data[si + c])))) * 255);
      }
    }
  }
  return encodePNG(PW, PH, px);
};

const main = async () => {
  const manifest = JSON.parse(await readFile(join(SKIES_DIR, 'manifest.json'), 'utf8'));
  const wanted = process.argv.slice(2);
  const ids = Object.keys(manifest.assets).filter((id) => wanted.length === 0 || wanted.includes(id));
  if (ids.length === 0) throw new Error('no manifest assets matched');

  await mkdir(join(SKIES_DIR, 'previews'), { recursive: true });
  for (const id of ids) {
    const meta = manifest.assets[id];
    const hdrPath = join(SKIES_DIR, meta.file.path);
    const buf = await readFile(hdrPath);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    if (meta.file.sha256 && sha256 !== meta.file.sha256) {
      throw new Error(`${id}: sha256 ${sha256} does not match manifest ${meta.file.sha256}`);
    }
    const hdr = decodeHDR(buf);
    console.log(`[decode] ${id}: ${hdr.width}x${hdr.height}`);

    const { json, lum } = analyse(id, meta, hdr);
    const png = previewPNG(hdr, lum);
    await writeFile(join(SKIES_DIR, 'previews', `${id}.png`), png);
    await writeFile(join(SKIES_DIR, `${id}.json`), JSON.stringify(json, null, 2) + '\n');

    console.log(
      `[done] ${id}: sun=[${json.sunDirection}] elev=${json.sunElevationDeg}° ` +
      `horizon=${json.horizonColorHexNormalised} SH0=[${json.skyIrradianceSH[0].map((v) => round(v, 4))}] ` +
      `mean=[${json.stats.meanRadiance.map((v) => round(v, 4))}]`,
    );
  }
};

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
