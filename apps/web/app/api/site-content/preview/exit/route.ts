import { NextResponse } from 'next/server';
import { PREVIEW_COOKIE, previewTarget } from '@acme/content/site-preview';
import { activePreview } from '../../../../../lib/site-preview';
export async function GET() {
  const preview = await activePreview();
  const target = preview ? previewTarget(preview.grant) : '/';
  const response = NextResponse.redirect(new URL(target, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'));
  response.cookies.set(PREVIEW_COOKIE, '', {httpOnly: true, secure: (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https:'), sameSite: 'lax', path: '/', maxAge: 0});
  response.headers.set('Cache-Control', 'private, no-store'); return response;
}
