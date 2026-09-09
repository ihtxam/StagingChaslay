import java.time.Instant
import java.util.Properties

plugins {
    id("com.android.application")
    // AGP 9 already registers the Kotlin Android extension. Applying
    // org.jetbrains.kotlin.android again fails: "Cannot add extension 'kotlin'".
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
val hasAdyenSdkKeys = hasTestKey || hasLiveKey
val tapToPayUsesLiveArtifacts = hasLiveKey && (adyenEnv == "live" || !hasTestKey)

android {
    namespace = "com.rebornsense.printbridge"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rebornsense.printbridge"
        targetSdk = 35
        versionCode = 20
        versionName = "0.4.2"
    }

    flavorDimensions += "edition"
    productFlavors {
        create("print") {
            dimension = "edition"
            minSdk = 24
            buildConfigField("boolean", "HAS_ADYEN_SDK", "false")
            resValue("string", "app_name", "Bridge Reborn Print")
        }
        create("tapToPay") {
            dimension = "edition"
            minSdk = 26
            val hasSdk = hasAdyenSdkKeys.toString()
            buildConfigField("boolean", "HAS_ADYEN_SDK", hasSdk)
            resValue("string", "app_name", "Bridge Reborn")
        }
    }

    sourceSets {
        getByName("tapToPay") {
            java.directories.add("src/adyen/kotlin")
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

    buildFeatures {
        buildConfig = true
        resValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
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

    if (hasAdyenSdkKeys) {
        val adyenPosVersion = "2.16.0"
        if (tapToPayUsesLiveArtifacts) {
            add("tapToPayImplementation", "com.adyen.ipp:pos-mobile-release:$adyenPosVersion")
            add("tapToPayImplementation", "com.adyen.ipp:payment-tap-to-pay-release:$adyenPosVersion")
        } else {
            add("tapToPayImplementation", "com.adyen.ipp:pos-mobile-debug:$adyenPosVersion")
            add("tapToPayImplementation", "com.adyen.ipp:payment-tap-to-pay-debug:$adyenPosVersion")
        }
        add("tapToPayImplementation", "androidx.startup:startup-runtime:1.1.1")
        add("tapToPayImplementation", "com.squareup.okhttp3:okhttp:4.12.0")
    }
}

fun registerCopyApk(
    taskName: String,
    variant: String,
    outputName: String,
    manifestName: String,
) {
    tasks.register<Copy>(taskName) {
        from(layout.buildDirectory.dir("outputs/apk/$variant/release"))
        include("app-$variant-release.apk", "app-$variant-release-unsigned.apk")
        into(rootProject.projectDir.parentFile.resolve("backend/public/downloads"))
        rename { outputName }
        doLast {
            val manifest = rootProject.projectDir.parentFile
                .resolve("backend/public/downloads/$manifestName")
            val builtAt = Instant.now().toString()
            val version = android.defaultConfig.versionName
            val editionLabel = if (variant == "print") "reborn-print-bridge-print" else "reborn-print-bridge"
            manifest.writeText(
                """
                {
                  "name": "$editionLabel",
                  "version": "$version",
                  "apkFile": "$outputName",
                  "builtAt": "$builtAt",
                  "platform": "android",
                  "edition": "$variant",
                  "hasTapToPay": ${variant == "tapToPay"},
                  "signed": true
                }
                """.trimIndent() + "\n"
            )
        }
    }
}

registerCopyApk(
    taskName = "copyPrintReleaseApkToDownloads",
    variant = "print",
    outputName = "reborn-print-bridge-print.apk",
    manifestName = "reborn-print-bridge-print.json",
)
registerCopyApk(
    taskName = "copyTapToPayReleaseApkToDownloads",
    variant = "tapToPay",
    outputName = "reborn-print-bridge.apk",
    manifestName = "reborn-print-bridge.json",
)

afterEvaluate {
    tasks.named("assemblePrintRelease") {
        finalizedBy("copyPrintReleaseApkToDownloads")
    }
    tasks.named("assembleTapToPayRelease") {
        finalizedBy("copyTapToPayReleaseApkToDownloads")
    }
    tasks.named("copyPrintReleaseApkToDownloads") {
        dependsOn("assemblePrintRelease")
    }
    tasks.named("copyTapToPayReleaseApkToDownloads") {
        dependsOn("assembleTapToPayRelease")
    }
}
