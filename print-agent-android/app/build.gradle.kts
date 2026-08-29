import java.time.Instant

plugins {
    id("com.android.application")
}

android {
    namespace = "com.rebornsense.printbridge"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rebornsense.printbridge"
        minSdk = 24
        targetSdk = 35
        versionCode = 7
        versionName = "0.2.5"
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
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("com.sunmi:printerlibrary:1.0.23")
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
