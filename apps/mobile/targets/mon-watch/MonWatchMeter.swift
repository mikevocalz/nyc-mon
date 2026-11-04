import SwiftUI

struct MonWatchMeter: View {
  let label: String
  let hearts: Int

  var body: some View {
    HStack {
      Text(label).font(.body)
      Spacer(minLength: 4)
      HStack(spacing: 3) {
        ForEach(0..<4) { index in
          Image(systemName: index < hearts ? "heart.fill" : "heart")
            .foregroundStyle(index < hearts ? Color.cyan : Color.secondary)
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(label)
    .accessibilityValue("\(hearts) of 4 hearts")
  }
}
