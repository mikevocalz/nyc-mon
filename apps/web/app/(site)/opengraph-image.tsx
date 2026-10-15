import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { HOME_COPY } from '@acme/spatial/copy';
import { brand, concrete, signage } from '@acme/theme';

// The site-wide share card: daylit concrete, signage-black type, orange only as
// a face (Decision #7: never orange text on concrete). Built once at build
// time; no request data. Brand files come from packages/assets, read relative
// to apps/web (the cwd scripts/next.mjs runs Next from), per the next/og docs.
// Satori reads TTF/OTF/WOFF but not WOFF2, so this uses the .ttf twin of the
// site's display font.

export const alt = `NYC-MON: ${HOME_COPY.tagline} ${HOME_COPY.intro}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ASSETS = join(process.cwd(), '../../packages/assets');
const archivoBlack = await readFile(join(ASSETS, 'fonts/ArchivoBlack-Regular.ttf'));
const logoSrc = `data:image/png;base64,${await readFile(join(ASSETS, 'brand/nyc-mon-logo-640.png'), 'base64')}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: concrete[50],
          color: signage.black,
        }}
      >
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 72px', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: brand.orange }} />
              <div style={{ fontFamily: 'Archivo Black', fontSize: 32, letterSpacing: 1 }}>NYC-MON</div>
            </div>
            <div style={{ fontFamily: 'Archivo Black', fontSize: 92, lineHeight: 1.02, letterSpacing: -1 }}>
              {HOME_COPY.tagline}
            </div>
            <div style={{ fontSize: 30, lineHeight: 1.35, color: concrete[700], maxWidth: 620 }}>{HOME_COPY.intro}</div>
          </div>
          <img src={logoSrc} width={400} height={400} alt="" />
        </div>
        <div style={{ display: 'flex', height: 24, background: brand.orange }} />
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Archivo Black', data: archivoBlack, style: 'normal', weight: 400 }],
    },
  );
}
