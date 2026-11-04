import WatchKit
import WatchConnectivity

final class MonWatchDelegate: NSObject, WKApplicationDelegate {
  private var tasks: [WKWatchConnectivityRefreshBackgroundTask] = []
  private var activation: NSKeyValueObservation?
  private var pending: NSKeyValueObservation?

  func applicationDidFinishLaunching() {
    _ = MonWatchStore.shared
    activation = WCSession.default.observe(\.activationState) { [weak self] _, _ in
      DispatchQueue.main.async { self?.completeTasks() }
    }
    pending = WCSession.default.observe(\.hasContentPending) { [weak self] _, _ in
      DispatchQueue.main.async { self?.completeTasks() }
    }
  }

  func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
    for task in backgroundTasks {
      if let connectivity = task as? WKWatchConnectivityRefreshBackgroundTask { tasks.append(connectivity) }
      else { task.setTaskCompletedWithSnapshot(false) }
    }
    completeTasks()
  }

  private func completeTasks() {
    guard WCSession.default.activationState == .activated,
          !WCSession.default.hasContentPending else { return }
    tasks.forEach { $0.setTaskCompletedWithSnapshot(false) }
    tasks.removeAll()
  }
}
