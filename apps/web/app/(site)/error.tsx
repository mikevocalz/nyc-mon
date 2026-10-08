'use client';

// Deep import: the @acme/app barrel re-exports the schedule editor (Tiptap,
// gesture handler, zod) and this boundary ships with every route in (site).
import { ErrorScreen } from '@acme/app/features/error/screen.tsx';

export default function ErrorPage({ error }: { error: Error }) {
  return <ErrorScreen kind="error" detail={error.message} />;
}
