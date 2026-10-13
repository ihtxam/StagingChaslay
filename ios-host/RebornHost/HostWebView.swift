import SwiftUI
import WebKit

/// Production Host PWA. Change for staging.
let HOST_PWA_URL = URL(string: "https://app.rebornsense.com/host")!

struct HostWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.scrollView.bounces = false
        view.allowsBackForwardNavigationGestures = true
        view.customUserAgent = "RebornHostiOS/1.0"
        view.load(URLRequest(url: HOST_PWA_URL))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
