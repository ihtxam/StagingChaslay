# Reborn Host — native iOS wrapper

Thin WKWebView shell that loads the production Host PWA at `https://app.rebornsense.com/host`.

The guest app is out of scope this round.

## Open in Xcode

1. On a Mac with Xcode 15+:
   ```bash
   open ios-host/RebornHost.xcodeproj
   ```
   If the project file is missing after a fresh clone, create a new **App** target named `RebornHost` (iOS 16+, Swift, Storyboard or SwiftUI) and replace the generated files with the sources in `ios-host/RebornHost/`.
2. Set the bundle identifier (e.g. `com.rebornsense.host`).
3. Signing & Capabilities → your team. No App Store pipeline is required for device/simulator runs.
4. Run on a simulator or a signed iPhone. The webview opens `/host` (login + Host station). Add-to-Home-Screen on Safari is the same PWA (`host.webmanifest`).

## Files

- `RebornHost/App.swift` — SwiftUI entry
- `RebornHost/HostWebView.swift` — WKWebView pointed at the Host PWA
- `RebornHost/Info.plist` — ATS + portrait

Change `HOST_PWA_URL` in `HostWebView.swift` for staging.
