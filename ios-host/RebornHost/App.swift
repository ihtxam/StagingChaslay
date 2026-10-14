import SwiftUI

@main
struct RebornHostApp: App {
    var body: some Scene {
        WindowGroup {
            HostWebView()
                .ignoresSafeArea()
        }
    }
}
