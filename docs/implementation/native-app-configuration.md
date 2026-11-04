# NYC-MON native identities and capabilities

Audited November 2, 2026, in `fix/ipad-game-integration`. This covers this repository, not the other apps in the Apple developer account.

| Target | Bundle identifier | Shared storage / transport |
| --- | --- | --- |
| NYCMON | `com.nycmon.app` | `group.com.nycmon.app` with MonKeychain; Watch Connectivity to the paired Watch |
| MonKeychain | `com.nycmon.app.keychain` | `group.com.nycmon.app` |
| MonWatch | `com.nycmon.app.watchkitapp` | Local Watch defaults; snapshots transferred from the paired iPhone |

The App Group is registered and assigned to both iOS targets in Apple's developer portal. Actual signed app and widget entitlements and provisioning profiles agree on that identifier. Sign in with Apple remains enabled for the main App ID and signed app. Profiles were regenerated after the account owner accepted Apple's updated agreement. The Viro 3.0.3 native build installed on the iPad successfully; that earlier install does not include the subsequently added Watch companion.

`with-keychain-widget` and `with-mon-watch` declare their targets under `extra.eas.build.experimental.ios.appExtensions` before EAS credential preparation. Both merge existing configuration and retain any EAS project ID. Expo CLI currently reports `Not logged in`, and the resolved config has no EAS project ID; cloud-project linking is pending owner sign-in. This does not block local Xcode signing. The Watch is a SwiftUI single-target companion, watchOS 10+, with standard device architectures and `WKCompanionAppBundleIdentifier=com.nycmon.app`. It is intentionally not advertised as independent: snapshots currently come from the paired iPhone. App Groups do not transport data between an iPhone and Watch.

The Watch target compiles for arm64 and arm64_32 and signs with Apple Development. Its explicit App ID `com.nycmon.app.watchkitapp` is registered in Apple Developer (resource `Z7Z2U297SR`); the initial generic development build used a wildcard profile, so the final parent build must be checked again after explicit registration. The iOS-only Skia forced linker symbol excludes watchOS applications. The widget and Watch retain distinct privacy resources. Main app and widget declare the App Group UserDefaults reason `1C8F.1`; Watch's own local defaults use `CA92.1`. Existing orientation, scene delegate, spatial window contracts, public Viro metadata and unrelated entitlements remain governed by `tooling/native-platform-contract.mjs`.

## Payments configuration scope

The owner requested configuration readiness, not product catalogs, prices or a checkout implementation. Digital items and subscriptions are the intended purchases.

- The main App ID's **In-App Purchase capability is enabled**, verified in Apple's portal. StoreKit/RevenueCat purchases do not require a new App Group or Apple Pay merchant entitlement. No purchase SDK or payment collection was present in the audited checkout.
- RevenueCat needs an app entry matching `com.nycmon.app` and store-account connections when the integration is implemented. Those external account connections are not established by an iOS entitlement, and are not claimed complete here.
- Stripe, Apple Pay on the web, and PayPal require payment-provider and checkout-domain setup. No live account, merchant certificate, financial agreement, domain verification or payment processing was changed during this audit. The connected Stripe account has not been assigned to NYC-MON by assumption.
- Native Apple Pay Payment Processing remains disabled because the configured native digital purchase path is StoreKit. A merchant ID should be added only for an actual eligible native Apple Pay flow. PayPal and Stripe do not have Apple App Group capabilities.
- No provider secrets were read or added. No charges, products, prices, subscriptions or paid features were created.

References: [Expo extension credentials](https://docs.expo.dev/build-reference/app-extensions/), [Apple payment guidelines](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Apple required-reason API declarations](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype), [RevenueCat Expo integration](https://www.revenuecat.com/docs/getting-started/installation/expo).

## Remaining acceptance

Watch builds and macOS SceneKit format/framing checks are not physical Watch verification. Paired iPhone/Watch delivery, first install, sign-out clearing, background delivery, stale snapshots, wrist-down, Reduce Motion, text scaling and device performance need actual paired hardware. The Watch currently offers authored short check-ins and status replies, not a free-form language-model conversation. The final parent app with the embedded Watch companion built, passed strict signature verification and installed on the iPad at18:08 local. iPadOS currently refuses launch because the iPad is locked; game first-frame/visual acceptance remains pending. No merge is implied by configuration readiness.
