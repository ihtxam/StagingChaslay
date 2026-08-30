import java.time.Instant
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val localProps = Properties().apply {
    val rootFile = rootProject.projectDir.parentFile?.resolve("local.properties")
    val here = rootProject.file("local.properties")
    when {
        here.exists() -> here.inputStream().use { load(it) }
        rootFile != null && rootFile.exists() -> rootFile.inputStream().use { load(it) }
    }
}
val adyenEnv = (localProps.getProperty("adyenEnv") ?: "test").lowercase()
val hasTestKey = localProps.getProperty("adyenSdkApiKey").orEmpty().isNotBlank()
val hasLiveKey = localProps.getProperty("adyenSdkApiKeyLive").orEmpty().isNotBlank()
val hasAdyenSdk = (adyenEnv == "live" && hasLiveKey) || hasTestKey

android {
    namespace = "com.rebornsense.printbridge"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rebornsense.printbridge"
        // Adyen Tap to Pay requires API 26+; print-only still works on API 24 when SDK absent.
        minSdk = if (hasAdyenSdk) 26 else 24
        targetSdk = 35
        versionCode = 14
        versionName = "0.3.6"
        buildConfigField("boolean", "HAS_ADYEN_SDK", hasAdyenSdk.toString())
    }

    if (hasAdyenSdk) {
        sourceSets {
            getByName("main").java.srcDirs("src/adyen/kotlin")
        }
    }

    signingConfigs {
        create("release") {
            storeFile = signingConfigs.getByName("debug").storeFile
            storePassword = signingConfigs.getByName("debug").storePassword
            keyAlias = signingConfigs.getByName("debug").keyAlias
            keyPassword = signingConfigs.getByName("debug").keyPassword
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("com.sunmi:printerlibrary:1.0.23")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.github.mik3y:usb-serial-for-android:3.9.0")

    if (hasAdyenSdk) {
        val adyenPosVersion = "2.16.0"
        if (adyenEnv == "live" && hasLiveKey) {
            implementation("com.adyen.ipp:pos-mobile-release:$adyenPosVersion")
            implementation("com.adyen.ipp:payment-tap-to-pay-release:$adyenPosVersion")
        } else {
            implementation("com.adyen.ipp:pos-mobile-debug:$adyenPosVersion")
            implementation("com.adyen.ipp:payment-tap-to-pay-debug:$adyenPosVersion")
        }
        implementation("androidx.startup:startup-runtime:1.1.1")
        implementation("com.squareup.okhttp3:okhttp:4.12.0")
    }
}

val copyReleaseApk = tasks.register<Copy>("copyReleaseApkToDownloads") {
    from(layout.buildDirectory.dir("outputs/apk/release"))
    include("app-release.apk", "app-release-unsigned.apk")
    into(rootProject.projectDir.parentFile.resolve("backend/public/downloads"))
    rename { "reborn-print-bridge.apk" }
    doLast {
        val manifest = rootProject.projectDir.parentFile
            .resolve("backend/public/downloads/reborn-print-bridge.json")
        if (manifest.exists()) {
            val builtAt = Instant.now().toString()
            val text = manifest.readText()
            val updated = text.replace(
                Regex("\"builtAt\"\\s*:\\s*\"[^\"]*\"|\"builtAt\"\\s*:\\s*null"),
                "\"builtAt\": \"$builtAt\""
            ).replace(
                Regex("\"signed\"\\s*:\\s*false"),
                "\"signed\": true"
            )
            manifest.writeText(updated)
        }
    }
}

afterEvaluate {
    tasks.named("assembleRelease") {
        finalizedBy(copyReleaseApk)
    }
    copyReleaseApk.configure {
        dependsOn("assembleRelease")
    }
}
