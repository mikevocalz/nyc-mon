// Runtime setup adapted from React Native 0.88.0 HermesInstance.cpp.
// Copyright (c) Meta Platforms, Inc. and affiliates. MIT License.
#import "NYCMonRuntimeFactory.h"
#include "NYCMonHermesRuntime.h"
#include <react/featureflags/ReactNativeFeatureFlags.h>
#include <cassert>

namespace nycmon {
class RuntimeFactory final : public facebook::react::JSRuntimeFactory {
 public:
  std::unique_ptr<facebook::react::JSRuntime> createJSRuntime(
      std::shared_ptr<facebook::react::MessageQueueThread> thread) noexcept override {
    assert(thread != nullptr);
    // The game shares the process with Metal resources. Keep live JS data denser
    // than the default 50% heap occupancy without imposing a smaller hard limit.
    const auto gc = hermes::vm::GCConfig::Builder()
        .withMaxHeapSize(3072u << 20)
        .withOccupancyTarget(0.8)
        .withName("NYCMON")
        .build();
    const auto config = hermes::vm::RuntimeConfig::Builder()
        .withGCConfig(gc)
        .withEnableSampleProfiling(true)
        .withMicrotaskQueue(facebook::react::ReactNativeFeatureFlags::enableBridgelessArchitecture())
        .build();
    auto runtime = facebook::hermes::makeHermesRuntime(config);
    auto error = runtime->global().getPropertyAsObject(*runtime, "Error")
        .getPropertyAsObject(*runtime, "prototype");
    error.setProperty(*runtime, "jsEngine", "hermes");
    return std::make_unique<HermesRuntime>(std::move(runtime));
  }
};
}
@implementation NYCMonRuntimeFactory
+ (void *)create {
  NSLog(@"[NYCMON/runtime] Hermes occupancy target 0.8; existing heap ceiling retained");
  return new nycmon::RuntimeFactory();
}
@end
