import { NextRequest, NextResponse } from 'next/server';
import { PREVIEW_COOKIE, verifyPreview, previewTarget, PREVIEW_SECONDS } from '@acme/content/site-preview';
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const grant = verifyPreview(token, process.env.SITE_PREVIEW_SECRET ?? '', process.env.NEXT_PUBLIC_SITE_URL ?? '');
  if (process.env.NYCMON_SITE_EDITOR !== '1' || !grant) return new NextResponse('Preview link expired or invalid.', {status: 403, headers: {'Cache-Control': 'no-store'}});
  const response = NextResponse.redirect(new URL(previewTarget(grant), grant.audience));
  response.cookies.set(PREVIEW_COOKIE, token, {httpOnly: true, secure: grant.audience.startsWith('https:'), sameSite: 'lax', path: '/', maxAge: Math.min(PREVIEW_SECONDS, grant.expires - Math.floor(Date.now()/1000))});
  response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Referrer-Policy', 'no-referrer'); response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
