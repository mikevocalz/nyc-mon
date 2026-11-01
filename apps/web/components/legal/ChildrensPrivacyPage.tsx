import type { CmsPageProps } from '../cms/PageSections';
import { LEGAL_COPY } from '@acme/app/features/legal/copy.ts';
import { LegalDocumentPage } from './LegalDocumentPage';

/** W06 — the children’s privacy notice (COPPA), laid out by LegalDocumentPage. */
export function ChildrensPrivacyPage(props: CmsPageProps = {}) {
  return <LegalDocumentPage {...props} doc={LEGAL_COPY.childrens} testId="w06-coppa" />;
}
