import { Section, Paragraph } from '@acme/ui/html';
/** Never show obsolete bundled copy while waiting for managed content or draft authorization. */
export function LoadingContent() {
  return <Section role="status" aria-live="polite" className="mx-auto min-h-80 w-full max-w-screen-xl px-4 py-16"><Paragraph>Loading page…</Paragraph></Section>;
}
