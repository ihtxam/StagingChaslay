# Debug minify: keep startup + Hilt shell small so main dex can hold the manifest Application.
-keepattributes Signature
-keepattributes *Annotation*

-keep class com.chaslay.pos.ChaslayPosApp { *; }
-keep class com.chaslay.pos.Hilt_ChaslayPosApp { *; }
-keep class com.chaslay.pos.Hilt_ChaslayPosApp$* { *; }

-keep class com.chaslay.pos.data.local.entity.** { *; }
-keep class com.chaslay.pos.data.remote.dto.** { *; }
-keep class com.chaslay.pos.update.AppUpdateManifest { *; }
-keep interface com.chaslay.pos.data.remote.** { *; }

-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-dontwarn com.google.gson.**
-dontwarn javax.xml.stream.**
-dontwarn com.adyen.ipp.**

# OkHttp 5 App Startup (merged from okhttp-android); loaded via reflection by InitializationProvider.
-keep class * implements androidx.startup.Initializer { *; }
-keep class okhttp3.internal.platform.** { *; }

# Sunmi InnerPrinter — SDK invokes callback methods from another process; R8 must not strip/obfuscate them.
-keep class com.sunmi.peripheral.printer.** { *; }
-keep class * extends com.sunmi.peripheral.printer.InnerPrinterCallback { *; }
-keep class com.chaslay.pos.printer.SunmiPrinterServiceHolder { *; }
