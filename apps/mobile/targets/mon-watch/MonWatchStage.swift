import SwiftUI
import SceneKit

struct MonWatchStage: View {
  @StateObject private var model: MonWatchScene
  @Environment(\.scenePhase) private var phase
  @Environment(\.isLuminanceReduced) private var dimmed
  @Environment(\.accessibilityReduceMotion) private var reducedMotion
  let name: String

  init(speciesId: String, name: String) {
    _model = StateObject(wrappedValue: MonWatchScene(speciesId: speciesId))
    self.name = name
  }

  var body: some View {
    Group {
      if let scene = model.scene {
        SceneView(scene: scene, pointOfView: scene.rootNode.childNode(withName: "MonCamera", recursively: false),
                  preferredFramesPerSecond: 20, antialiasingMode: .multisampling2X)
          .onAppear { scene.isPaused = phase != .active || dimmed || reducedMotion }
          .onChange(of: phase) { _, value in scene.isPaused = value != .active || dimmed || reducedMotion }
          .onChange(of: dimmed) { _, value in scene.isPaused = value || phase != .active || reducedMotion }
          .onChange(of: reducedMotion) { _, value in scene.isPaused = value || phase != .active || dimmed }
      } else if model.failed {
        Text("This Mon’s 3D view is unavailable.").font(.caption)
      } else {
        ProgressView("Loading Mon")
      }
    }
    .frame(height: 116)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("3D view of \(name)")
  }
}
