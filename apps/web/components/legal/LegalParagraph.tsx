import { Link } from 'solito/link';
import { Paragraph } from '@acme/ui/html';
import type { LegalParagraph as LegalParagraphCopy } from './copy';

const PARAGRAPH = 'my-0 text-base leading-7 text-text-secondary';

/** A stable React key for a legal paragraph, plain or linked. */
export function legalParagraphKey(paragraph: LegalParagraphCopy): string {
  return typeof paragraph === 'string' ? paragraph : `${paragraph.before}${paragraph.link.label}${paragraph.after}`;
}

/** One body paragraph of a legal document, with its inline link when it has one. */
export function LegalParagraph({ paragraph }: { paragraph: LegalParagraphCopy }) {
  if (typeof paragraph === 'string') return <Paragraph className={PARAGRAPH}>{paragraph}</Paragraph>;
  return (
    <Paragraph className={PARAGRAPH}>
      {paragraph.before}
      <Link href={paragraph.link.href} className="text-text underline underline-offset-4">
        {paragraph.link.label}
      </Link>
      {paragraph.after}
    </Paragraph>
  );
}
