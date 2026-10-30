'use client';
import { Avatar } from '../Avatar';
import { AVATAR_CLIP_PATH } from '../avatar-look';
import { useInstanceStore, useStore } from '../use-instance-store';
import { callerAvatarPresentation } from './caller-avatar';

export interface CallerAvatarProps {
  userId: string;
  imageUri?: string | null;
}

/**
 * Staff-console photo tile. A generic kit avatar remains underneath while
 * loading and after a missing/broken URL. Never derive initials from masked
 * names or emails. The browser fetches the photo without sending a referrer.
 */
export function CallerAvatar({ userId, imageUri }: CallerAvatarProps) {
  const store = useInstanceStore<{ failedSource: string | null }>(() => ({ failedSource: null }));
  const failedSource = useStore(store, (state) => state.failedSource);
  const { source, label } = callerAvatarPresentation(imageUri, failedSource, userId);

  return (
    <div role="img" aria-label={label} className="relative inline-flex h-11 w-11 shrink-0" data-testid="caller-avatar">
      <div aria-hidden="true"><Avatar name="Caller" size="md" /></div>
      {source ? (
        // A direct browser image avoids an optimizer proxying user-supplied URLs.
        <img
          key={source}
          src={source}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: AVATAR_CLIP_PATH }}
          onError={() => store.setState({ failedSource: source })}
        />
      ) : null}
    </div>
  );
}
