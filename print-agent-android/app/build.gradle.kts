plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.rebornsense.printbridge"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rebornsense.printbridge"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
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
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    implementation("com.sunmi:printerlibrary:1.0.23")
}

val copyReleaseApk = tasks.register<Copy>("copyReleaseApkToDownloads") {
    dependsOn("assembleRelease")
    from(layout.buildDirectory.dir("outputs/apk/release"))
    include("app-release.apk", "app-release-unsigned.apk")
    into(rootProject.projectDir.parentFile.resolve("backend/public/downloads"))
    rename { "reborn-print-bridge.apk" }
    doLast {
        val manifest = rootProject.projectDir.parentFile
            .resolve("backend/public/downloads/reborn-print-bridge.json")
        if (manifest.exists()) {
            val text = manifest.readText()
            val updated = text.replace(
                Regex("\"builtAt\"\\s*:\\s*null"),
                "\"builtAt\": \"${java.time.Instant.now()}\""
            )
            manifest.writeText(updated)
        }
    }
}

tasks.named("assembleRelease") {
    finalizedBy(copyReleaseApk)
}
