import SwiftUI

struct MonWatchView: View {
  @ObservedObject var store: MonWatchStore

  var body: some View {
    TimelineView(.everyMinute) { context in
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          if let snapshot = store.snapshot {
            Text(snapshot.monName).font(.title2.bold()).accessibilityAddTraits(.isHeader)
            if context.date >= snapshot.staleDate {
              if let watch = snapshot.watch {
                MonWatchStage(speciesId: watch.speciesId, name: snapshot.monName).id(watch.speciesId)
              }
              Label(snapshot.text.stale, systemImage: "clock")
              Text("Open NYC-MON on your iPhone to update.").foregroundStyle(.secondary)
            } else {
              MonWatchConversation(snapshot: snapshot).id(snapshot.watch?.speciesId)
              let calling = !snapshot.paused && (snapshot.isCalling ||
                snapshot.nextCallDate.map { context.date >= $0 } == true)
              Label(calling ? snapshot.text.calling : snapshot.text.status,
                    systemImage: calling ? "bell.fill" : snapshot.asleep ? "moon.fill" : "heart.fill")
                .foregroundStyle(calling ? Color.orange : Color.primary)
              NavigationLink("Care status") {
                ScrollView {
                  VStack(alignment: .leading, spacing: 12) {
                    MonWatchMeter(label: snapshot.text.meters.fullness, hearts: snapshot.hearts.fullness)
                    MonWatchMeter(label: snapshot.text.meters.energy, hearts: snapshot.hearts.energy)
                    MonWatchMeter(label: snapshot.text.meters.social, hearts: snapshot.hearts.social)
                    if let detail = snapshot.text.detail { Text(detail).foregroundStyle(.secondary) }
                  }
                }
                .scrollIndicators(.hidden)
                .navigationTitle("Care status")
              }
            }
            Text(Date(timeIntervalSince1970: snapshot.updatedAt / 1000), style: .relative)
              .font(.caption).foregroundStyle(.secondary)
              .accessibilityLabel("Last updated")
          } else {
            Label("Your Mon", systemImage: "heart")
              .font(.title2.bold())
            Text("Open NYC-MON on your paired iPhone to see your Mon here.")
              .foregroundStyle(.secondary)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
      }
      .scrollIndicators(.hidden)
    }
    .navigationTitle("NYC-MON")
  }
}
