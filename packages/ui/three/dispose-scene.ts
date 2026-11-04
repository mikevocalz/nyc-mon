/** Stop scene-owned asynchronous work before releasing its renderer. Idle teardown stays synchronous. */
export function disposeSceneResources(options: {
  disposeScene(): void | Promise<void>;
  releaseRenderer(): void | Promise<void>;
  onError(error: unknown): void;
}): void | Promise<void> {
  const release = () => {
    try {
      const result=options.releaseRenderer();
      if(result)return result.catch(options.onError);
    } catch(error){options.onError(error);}
  };
  try {
    const drain=options.disposeScene();
    if(drain)return drain.catch(options.onError).then(release);
  } catch(error){options.onError(error);}
  return release();
}
