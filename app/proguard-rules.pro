-keep class com.chaslay.pos.data.local.entity.** { *; }
-keep class com.chaslay.pos.data.remote.dto.** { *; }
-keep class com.chaslay.pos.update.AppUpdateManifest { *; }
-keep interface com.chaslay.pos.data.remote.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}
-dontwarn com.google.gson.**
-keep class com.google.gson.** { *; }
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-dontwarn javax.xml.stream.**
-keep class org.dhatim.fastexcel.** { *; }
-keep class fi.iki.elonen.** { *; }
-keep class com.adyen.ipp.** { *; }
-dontwarn com.adyen.ipp.**

# OkHttp 5 App Startup (merged from okhttp-android); loaded via reflection by InitializationProvider.
-keep class * implements androidx.startup.Initializer { *; }
-keep class okhttp3.internal.platform.** { *; }

# Sunmi InnerPrinter — bind callbacks must survive release minify.
-keep class com.sunmi.peripheral.printer.** { *; }
-keep class * extends com.sunmi.peripheral.printer.InnerPrinterCallback { *; }
-keep class com.chaslay.pos.printer.SunmiPrinterServiceHolder { *; }
-keep class com.chaslay.pos.printer.SunmiInternalPrinter { *; }
