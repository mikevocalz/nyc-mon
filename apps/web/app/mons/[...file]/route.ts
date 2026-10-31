import { NextResponse } from 'next/server';

const STEM_TO_DEX: Record<string, string> = {
  'metro-egg': 'dex-001',
  squeaklet: 'dex-002',
  'lil-ratti': 'dex-003',
};

// Old /mons/<file>.glb links (bundled GLBs were removed): forward to the
// Payload mon-models redirect, which lands on the approved Bunny object.
export function GET(_request: Request, { params }: { params: { file: string[] } }) {
  const name = params.file[0]?.replace(/\.glb$/, '') ?? '';
  const species = name.startsWith('dex-') ? name : STEM_TO_DEX[name];
  if (species === undefined) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(`https://admin.nyc-mon.city/v1/mon-models/glb/${species}`, 302);
}
