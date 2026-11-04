# Runtime integration source

- Upstream: https://github.com/facebook/react-native
- Installed version: 0.88.0, pinned by this repository's lockfile.
- License: MIT, copied to LICENSE.
- Adaptation date: 2026-11-02.
- Reviewed source: `ReactCommon/react/runtime/hermes/HermesInstance.cpp`,
  `React/Runtime/RCTHermesInstanceFactory.mm`, and the runtime factory headers.
- Adapted portions: Hermes runtime wrapper, inspector/profiler integration,
  runtime initialization, microtask flag and Error prototype engine marker.
- App change: GC occupancy target 0.8 instead of 0.5. The 3 GiB ceiling is unchanged.

This adapter uses the installed React Native runtime/inspector interfaces. It
must be rechecked against the actual native headers when React Native changes.
No React Native or Hermes version was upgraded for this integration.

Reviewed installed HermesInstance.cpp SHA256: `2499065570f9802b1f67e3d9e78880235a5ec20386a0ce1151a8cec1c5c6e127`.
