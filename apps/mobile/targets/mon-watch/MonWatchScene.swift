import SceneKit
import Combine

/// Owns a single native scene, loaded off the UI queue and released with its stage.
final class MonWatchScene: ObservableObject {
  @Published private(set) var scene: SCNScene?
  @Published private(set) var failed = false

  init(speciesId: String) {
    let name: String
    switch speciesId {
    case "dex-002": name = "squeaklet"
    case "dex-003": name = "lil-ratti"
    default: failed = true; return
    }
    DispatchQueue(label: "com.nycmon.watch.model", qos: .userInitiated).async {
      guard let url = Bundle.main.url(forResource: name, withExtension: "usdz"),
            let source = try? SCNScene(url: url, options: [.convertToYUp: true]) else {
        DispatchQueue.main.async { self.failed = true }
        return
      }
      let scene = SCNScene()
      let model = SCNNode()
      for node in source.rootNode.childNodes { model.addChildNode(node) }
      let (low, high) = model.boundingBox
      let height = max(0.001, high.y - low.y)
      let scale = Float(1.5) / height
      model.scale = SCNVector3(scale, scale, scale)
      model.position = SCNVector3(-(low.x + high.x) * scale / 2, -low.y * scale,
                                 -(low.z + high.z) * scale / 2)
      scene.rootNode.addChildNode(model)
      let breatheIn = SCNAction.scale(by: 1.012, duration: 1.3)
      let breatheOut = SCNAction.scale(by: 1 / 1.012, duration: 1.3)
      breatheIn.timingMode = .easeInEaseOut
      breatheOut.timingMode = .easeInEaseOut
      model.runAction(.repeatForever(.sequence([breatheIn, breatheOut])), forKey: "MonBreathing")
      let camera = SCNNode()
      camera.name = "MonCamera"
      camera.camera = SCNCamera()
      camera.camera?.fieldOfView = 38
      camera.position = SCNVector3(0, 0.75, 3.4)
      scene.rootNode.addChildNode(camera)
      let key = SCNNode()
      key.light = SCNLight()
      key.light?.type = .omni
      key.light?.intensity = 600
      key.position = SCNVector3(-2, 3, 4)
      scene.rootNode.addChildNode(key)
      let fill = SCNNode()
      fill.light = SCNLight()
      fill.light?.type = .ambient
      fill.light?.intensity = 250
      scene.rootNode.addChildNode(fill)
      DispatchQueue.main.async { self.scene = scene }
    }
  }
}
