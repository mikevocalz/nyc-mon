'use client';
import { useDocumentInfo, useFormModified } from '@payloadcms/ui';
import { Link, Text } from '@acme/ui/html';
/** An explicit preview action rather than Payload 4's default copy-link icon. */
export function WebsitePreviewButton() {
  const {id} = useDocumentInfo();
  const modified = useFormModified();
  if (!id) return <Text>Save a draft to preview.</Text>;
  return <Link href={`/payload-api/site-preview/start?id=${encodeURIComponent(String(id))}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center px-3 font-semibold underline" aria-label={modified ? 'Preview saved draft. Unsaved changes are not included.' : 'Preview saved draft'}>Preview saved draft</Link>;
}
