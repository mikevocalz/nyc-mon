// `Freeze` from react-freeze 1.0.4 (MIT, Software Mansion), inlined — see
// ../THIRD-PARTY-NOTICES.md. Source:
// https://github.com/software-mansion/react-freeze/blob/main/src/index.tsx
//
// A frozen subtree stays MOUNTED and stops rendering: the Suspender throws a
// thenable that never settles, so React keeps the last committed tree under a
// Suspense boundary instead of unmounting it. Effects keep running, which is
// why `usePaneOpen` exists for content that owns a render loop.
// SOT-KEYWORDS: freeze suspend hidden pane mounted react-freeze
import { Fragment, Suspense, type ReactNode } from 'react';

const NEVER_SETTLES = { then() {} };

function Suspender({ freeze, children }: { freeze: boolean; children: ReactNode }) {
  if (freeze) {
    throw NEVER_SETTLES;
  }
  return <Fragment>{children}</Fragment>;
}

export function Freeze({
  freeze,
  children,
  placeholder = null,
}: {
  freeze: boolean;
  children: ReactNode;
  placeholder?: ReactNode;
}) {
  return (
    <Suspense fallback={placeholder}>
      <Suspender freeze={freeze}>{children}</Suspender>
    </Suspense>
  );
}
