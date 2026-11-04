/** Observes existing native calls only. No acquisition, configuration or
 * presentation is initiated by the probe itself. */
export function observeSurfacePresentation<C extends { usage?: number; format?: string; alphaMode?: string }, T extends { usage: number; width: number; height: number }>(
  context: { configure(config: C): void; getCurrentTexture(): T },
  options: { nativeSurface(): { surface: unknown; width: number; height: number; clientWidth: number; clientHeight: number };
    now(): number; log(sample: Record<string, unknown>): void; onError?(error: unknown): void },
) {
  let warned = false;
  const observe = (fn: () => void) => {
    try { fn(); } catch (error) { if (!warned) { warned = true; options.onError?.(error); } }
  };
  const getTexture = context.getCurrentTexture, configure = context.configure;
  let disposed = false, getTextureCalls = 0, presentAttempts = 0, samples = 0, lastLog = -Infinity;
  let configuredUsage: number | null = null, configuredFormat: string | null = null;
  let textureUsage: number | null = null, texturePointer: string | null = null;
  let textureWidth: number | null = null, textureHeight: number | null = null;
  const observedGet = function () {
    const texture = getTexture.call(context);
    if (!disposed) observe(() => {
      getTextureCalls++; textureUsage = texture.usage; textureWidth = texture.width; textureHeight = texture.height;
      const pointer = (texture as T & { nativePointer?: unknown }).nativePointer;
      texturePointer = pointer == null ? null : String(pointer);
    });
    return texture;
  };
  const observedConfigure = function (config: C) {
    configure.call(context, config);
    if (!disposed) { configuredUsage = config.usage ?? 16; configuredFormat = config.format ?? null; }
  };
  try {
    context.getCurrentTexture = observedGet;
    context.configure = observedConfigure;
  } catch (error) {
    if (context.getCurrentTexture === observedGet) context.getCurrentTexture = getTexture;
    throw error;
  }
  return {
    presentAttempt() {
      if (disposed) return;
      presentAttempts++;
      observe(() => {
      const now = options.now();
      if (samples >= 120 || now - lastLog < 500) return;
      lastLog = now; samples++;
      const native = options.nativeSurface();
      options.log({ sequence: samples, configuredUsage, configuredFormat, textureUsage, texturePointer,
        textureWidth, textureHeight, getTextureCalls, presentAttempts,
        nativeSurface: native.surface == null ? null : String(native.surface),
        nativeWidth: native.width, nativeHeight: native.height, clientWidth: native.clientWidth, clientHeight: native.clientHeight,
        // A positive difference is evidence, not a claim that Present succeeded.
        extraTextureUsage: configuredUsage === null || textureUsage === null ? null : textureUsage & ~configuredUsage,
      });
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (context.getCurrentTexture === observedGet) context.getCurrentTexture = getTexture;
      if (context.configure === observedConfigure) context.configure = configure;
    },
  };
}
