import { LEGAL_COPY } from './copy';
import { LegalDocumentPage } from './LegalDocumentPage';

/** W06 — the terms of use, laid out by LegalDocumentPage. */
export function TermsPage() {
  return <LegalDocumentPage doc={LEGAL_COPY.terms} testId="w06-terms" />;
}
