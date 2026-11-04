#pragma once
#include <react/runtime/JSRuntimeFactory.h>
#include <hermes/hermes.h>
#include <reacthermes/HermesRuntimeTargetDelegate.h>
#include <optional>

namespace nycmon {
// Keeps React Native's inspector and sampling-profiler integration.
class HermesRuntime final : public facebook::react::JSRuntime {
 public:
  explicit HermesRuntime(std::shared_ptr<facebook::hermes::HermesRuntime> runtime);
  facebook::jsi::Runtime &getRuntime() noexcept override;
  facebook::react::jsinspector_modern::RuntimeTargetDelegate &getRuntimeTargetDelegate() override;
  void unstable_initializeOnJsThread() override;
 private:
  std::shared_ptr<facebook::hermes::HermesRuntime> runtime_;
  std::optional<facebook::react::jsinspector_modern::HermesRuntimeTargetDelegate> inspector_;
};
}
