'use client';

// Deep import: the @acme/app barrel re-exports the schedule editor (Tiptap,
// gesture handler, zod) and this boundary ships with every route in (site).
import { ErrorScreen } from '@acme/app/features/error/screen.tsx';

export default function ErrorPage({ error, retry }: { error: Error; retry: () => void }) {
  // Same "Try again" as the app's root boundary: re-renders the segment that threw.
  return <ErrorScreen kind="error" detail={error.message} onRetry={retry} />;
}
