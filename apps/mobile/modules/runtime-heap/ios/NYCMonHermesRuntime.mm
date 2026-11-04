// Adapted from React Native 0.88.0 HermesInstance.cpp.
// Copyright (c) Meta Platforms, Inc. and affiliates. MIT License.
#include "NYCMonHermesRuntime.h"
#include <jsi/instrumentation.h>
#include <utility>

namespace nycmon {
HermesRuntime::HermesRuntime(std::shared_ptr<facebook::hermes::HermesRuntime> runtime)
    : runtime_(std::move(runtime)) {}
facebook::jsi::Runtime &HermesRuntime::getRuntime() noexcept { return *runtime_; }
facebook::react::jsinspector_modern::RuntimeTargetDelegate &HermesRuntime::getRuntimeTargetDelegate() {
  if (!inspector_) inspector_.emplace(runtime_, *runtime_);
  return *inspector_;
}
void HermesRuntime::unstable_initializeOnJsThread() {
  runtime_->registerForProfiling();
  // Diagnostic entry only: measure temporary compiler garbage at the scene handoff.
  // Invoked synchronously on the owning JS thread, never from a GC callback.
  auto collect = facebook::jsi::Function::createFromHostFunction(
      *runtime_, facebook::jsi::PropNameID::forAscii(*runtime_, "__nycmonCollectGarbage"), 0,
      [](facebook::jsi::Runtime &runtime, const facebook::jsi::Value &,
         const facebook::jsi::Value *, size_t) {
        runtime.instrumentation().collectGarbage("NYCMON scene handoff diagnostic");
        return facebook::jsi::Value::undefined();
      });
  runtime_->global().setProperty(*runtime_, "__nycmonCollectGarbage", std::move(collect));
}
}
