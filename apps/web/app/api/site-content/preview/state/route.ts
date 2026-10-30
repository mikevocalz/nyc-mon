import { activePreview, previewDocument } from '../../../../../lib/site-preview';
export async function GET() {
  const preview = await activePreview();
  if (!preview) return Response.json({error: 'Expired'}, {status: 401, headers: {'Cache-Control': 'no-store'}});
  try { const {stamp} = await previewDocument(preview); return Response.json({stamp}, {headers: {'Cache-Control': 'private, no-store'}}); }
  catch { return Response.json({error: 'Unavailable'}, {status: 403, headers: {'Cache-Control': 'no-store'}}); }
}
