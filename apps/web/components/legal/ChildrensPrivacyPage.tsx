import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';
import { LegalDocumentPage } from './LegalDocumentPage';

/** W06 — the children’s privacy notice (COPPA), laid out by LegalDocumentPage. */
export function ChildrensPrivacyPage() {
  return <LegalDocumentPage doc={LEGAL_COPY.childrens} testId="w06-coppa" />;
}
