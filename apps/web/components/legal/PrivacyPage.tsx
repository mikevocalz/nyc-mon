import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';
import { LegalDocumentPage } from './LegalDocumentPage';

/** W06 — the privacy notice, laid out by LegalDocumentPage. */
export function PrivacyPage() {
  return <LegalDocumentPage doc={LEGAL_COPY.privacy} testId="w06-privacy" />;
}
