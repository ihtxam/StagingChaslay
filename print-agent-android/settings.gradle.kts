pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("com.android.application") version "9.3.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}

val localProps = java.util.Properties().apply {
    val rootFile = rootProject.projectDir.parentFile?.resolve("local.properties")
    val here = rootProject.file("local.properties")
    when {
        here.exists() -> here.inputStream().use { load(it) }
        rootFile != null && rootFile.exists() -> rootFile.inputStream().use { load(it) }
    }
}
val adyenSdkApiKey: String = localProps.getProperty("adyenSdkApiKey").orEmpty()
val adyenSdkApiKeyLive: String = localProps.getProperty("adyenSdkApiKeyLive").orEmpty()

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
        if (adyenSdkApiKey.isNotBlank()) {
            maven {
                url = uri("https://pos-mobile-test.cdn.adyen.com/adyen-pos-android")
                credentials(HttpHeaderCredentials::class) {
                    name = "x-api-key"
                    value = adyenSdkApiKey
                }
                authentication { create<HttpHeaderAuthentication>("header") }
            }
        }
        if (adyenSdkApiKeyLive.isNotBlank()) {
            maven {
                url = uri("https://pos-mobile.cdn.adyen.com/adyen-pos-android")
                credentials(HttpHeaderCredentials::class) {
                    name = "x-api-key"
                    value = adyenSdkApiKeyLive
                }
                authentication { create<HttpHeaderAuthentication>("header") }
            }
        }
    }
}

rootProject.name = "RebornPrintBridge"
include(":app")
