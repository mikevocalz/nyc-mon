'use client';
import { useDocumentInfo, useFormModified } from '@payloadcms/ui';
import { Link, Text } from '@acme/ui/html';
/**
 * An explicit preview action rather than Payload 4's default copy-link icon.
 * It renders inside Payload's edit view, outside the console's Tailwind
 * scope, so it is styled by `.nycmon-preview-link` in apps/admin-vite/src/editor.css.
 */
export function WebsitePreviewButton() {
  const {id} = useDocumentInfo();
  const modified = useFormModified();
  if (!id) return <Text>Save a draft to preview.</Text>;
  return <Link href={`/payload-api/site-preview/start?id=${encodeURIComponent(String(id))}`} target="_blank" rel="noopener noreferrer" className="nycmon-preview-link" aria-label={modified ? 'Preview saved draft. Unsaved changes are not included.' : 'Preview saved draft'}>Preview saved draft</Link>;
}
