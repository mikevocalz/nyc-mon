import SwiftUI

/// Short, authored check-ins. Replies are stage-gated by the shared content planner on iPhone.
struct MonWatchConversation: View {
  let snapshot: KeychainSnapshot
  @State private var prompt: String?
  @State private var reply: String?
  @State private var characterReply = false
  @Environment(\.isLuminanceReduced) private var dimmed

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      if let watch = snapshot.watch {
        Button {
          prompt = "Hello!"
          reply = watch.hello
          characterReply = true
        } label: {
          MonWatchStage(speciesId: watch.speciesId, name: snapshot.monName)
        }
        .buttonStyle(.plain)
        .disabled(watch.hello.isEmpty || snapshot.asleep || dimmed)
        .accessibilityLabel("Say hello to \(snapshot.monName)")
        .accessibilityHint(snapshot.asleep ? "Your Mon is asleep" : "Tap your Mon for a reply")
      }
      if !dimmed, let prompt, let reply {
        Text(prompt).font(.caption).foregroundStyle(.secondary)
        Text(characterReply ? snapshot.monName : "Status").font(.caption2).foregroundStyle(.secondary)
        Text(reply).font(.body)
          .padding(10)
          .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
          .accessibilityLabel(characterReply ? "\(snapshot.monName): \(reply)" : reply)
      }
      if let watch = snapshot.watch {
        if !watch.hello.isEmpty && !snapshot.asleep && reply == nil {
          Text("Tap your Mon to say hello.").font(.caption).foregroundStyle(.secondary)
        }
        Button("How are you?") {
          prompt = "How are you?"
          reply = snapshot.text.status + (snapshot.text.detail.map { " " + $0 } ?? "")
          characterReply = false
        }
        if snapshot.hearts.fullness <= 1 && !watch.hungry.isEmpty && !snapshot.asleep {
          Button("Hungry?") { prompt = "Hungry?"; reply = watch.hungry; characterReply = true }
        }
      }
    }
    .onChange(of: snapshot.updatedAt) { _, _ in prompt = nil; reply = nil; characterReply = false }
  }
}
