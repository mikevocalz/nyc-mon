import type { CSSProperties, Ref } from 'react';
import { SANDBOX_ATTRIBUTE } from '../shared/csp.ts';

/**
 * The one element the @acme/ui kit has no primitive for: the sandboxed iframe
 * that holds an MCP Apps view. It adds nothing visual of its own; the classes
 * are kit theme tokens, and the view inside draws its own kit Card.
 */
export function ViewFrame({ ref, title, src, hidden, status, style }: {
  readonly ref?: Ref<HTMLIFrameElement>;
  readonly title: string;
  readonly src: string | undefined;
  readonly hidden?: boolean;
  /** Load state, exposed as data-status for tests. */
  readonly status: 'loading' | 'ready' | 'error';
  readonly style?: CSSProperties;
}) {
  return (
    <iframe
      ref={ref}
      title={title}
      src={src}
      sandbox={SANDBOX_ATTRIBUTE}
      hidden={hidden}
      data-status={status}
      style={style}
      className="block w-full shrink-0 border-0 bg-transparent"
    />
  );
}
