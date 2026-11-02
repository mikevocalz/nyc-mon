import Foundation

extension Bundle {
  /// The App Group the config plugin wrote into Info.plist, or nil on a build without it.
  var appGroupIdentifier: String? {
    guard let value = object(forInfoDictionaryKey: "NYCMonAppGroup") as? String, !value.isEmpty else { return nil }
    return value
  }
}
