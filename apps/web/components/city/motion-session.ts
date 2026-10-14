interface MotionPreference {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}
interface MotionTimeline { play(): unknown; revert(): unknown }
interface PhotoMotionOptions {
  preference: MotionPreference;
  observe: (onVisible: () => void) => () => void;
  load: () => Promise<() => MotionTimeline>;
  onError: (error: unknown) => void;
}

/** One finite reveal. Late imports and preference changes never revive a disposed page. */
export function startPhotoMotion(options: PhotoMotionOptions) {
  let disposed = false;
  let triggered = false;
  let reduced = options.preference.matches;
  let timeline: MotionTimeline | null = null;
  let stopObserving: (() => void) | null = null;
  let settled = Promise.resolve();
  const disconnect = () => {
    const stop = stopObserving;
    stopObserving = null;
    stop?.();
  };
  const revert = () => {
    const active = timeline;
    timeline = null;
    try { active?.revert(); } catch (error) { options.onError(error); }
  };
  const onPreference = () => {
    if (!options.preference.matches) return;
    // Once the static variant is selected, changing back does not replay it.
    reduced = true;
    disconnect();
    revert();
  };
  const onVisible = () => {
    if (disposed || reduced || triggered || options.preference.matches) return;
    triggered = true;
    disconnect();
    settled = (async () => {
      const create = await options.load();
      if (disposed || reduced || options.preference.matches) return;
      timeline = create();
      timeline.play();
    })().catch((error: unknown) => {
      revert();
      if (!disposed) options.onError(error);
    });
  };
  options.preference.addEventListener('change', onPreference);
  if (!reduced) {
    stopObserving = options.observe(onVisible);
    // An observer adapter can report its initial state synchronously.
    if (triggered) disconnect();
  }
  return {
    get settled() { return settled; },
    dispose() {
      if (disposed) return;
      disposed = true;
      disconnect();
      options.preference.removeEventListener('change', onPreference);
      revert();
    },
  };
}
