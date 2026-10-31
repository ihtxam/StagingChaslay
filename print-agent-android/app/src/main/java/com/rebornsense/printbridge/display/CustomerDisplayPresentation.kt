package com.rebornsense.printbridge.display

import android.app.Presentation
import android.content.Context
import android.os.Bundle
import android.view.Display
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Full-screen customer-facing CDS page on the Sunmi rear / secondary display.
 */
class CustomerDisplayPresentation(
    outerContext: Context,
    display: Display,
    private val startUrl: String,
) : Presentation(outerContext, display) {

    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val wv = WebView(context)
        webView = wv
        wv.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
        val settings = wv.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.mediaPlaybackRequiresUserGesture = false
        wv.webViewClient = WebViewClient()
        setContentView(wv)
        wv.loadUrl(startUrl)
    }

    fun navigateTo(url: String) {
        val trimmed = url.trim()
        if (trimmed.isBlank()) return
        webView?.loadUrl(trimmed)
    }

    override fun onStop() {
        webView?.stopLoading()
        webView?.loadUrl("about:blank")
        webView?.destroy()
        webView = null
        super.onStop()
    }
}
