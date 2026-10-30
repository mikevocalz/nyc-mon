import type { CmsPageProps } from '../cms/PageSections';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';
import { LegalDocumentPage } from './LegalDocumentPage';

/** W06 — the terms of use, laid out by LegalDocumentPage. */
export function TermsPage(props: CmsPageProps = {}) {
  return <LegalDocumentPage {...props} doc={LEGAL_COPY.terms} testId="w06-terms" />;
}
