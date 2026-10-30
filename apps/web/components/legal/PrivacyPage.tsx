import type { WebsitePageProps } from '../cms/PageContent';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';
import { LegalDocumentPage } from './LegalDocumentPage';

/** W06 — the privacy notice, laid out by LegalDocumentPage. */
export function PrivacyPage(props: WebsitePageProps = {}) {
  return <LegalDocumentPage {...props} doc={LEGAL_COPY.privacy} testId="w06-privacy" />;
}
