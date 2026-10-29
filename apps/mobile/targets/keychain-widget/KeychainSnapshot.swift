import Foundation

/// The app's snapshot, decoded from the App Group. Mirrors `KeychainSnapshot`
/// in packages/app/features/mon-space/keychain-snapshot.ts (version 1);
/// change both together. Times are epoch milliseconds, as JS writes them.
struct KeychainSnapshot: Codable, Equatable {
  struct Hearts: Codable, Equatable {
    let fullness: Int
    let energy: Int
    let social: Int
  }

  struct Meters: Codable, Equatable {
    let fullness: String
    let energy: String
    let social: String
  }

  struct Text: Codable, Equatable {
    let title: String
    let status: String
    let calling: String
    let detail: String?
    let a11y: String
    let a11yCalling: String
    let stale: String
    let meters: Meters
  }

  static let supportedVersion = 1

  let v: Int
  let monName: String
  let hearts: Hearts
  let attention: String
  let poop: Int
  let cold: Bool
  let asleep: Bool
  let paused: Bool
  let nextCallAt: Double?
  let updatedAt: Double
  let staleAt: Double
  let text: Text

  var isCalling: Bool { attention == "call" }
  var staleDate: Date { Date(timeIntervalSince1970: staleAt / 1000) }
  var nextCallDate: Date? { nextCallAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
}
