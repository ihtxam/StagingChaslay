# Primary dex only: manifest Application + MultiDex base (Nebula Gemini1_SE cold start).
-keep class com.chaslay.pos.ChaslayPosApp { *; }
-keep class com.chaslay.pos.Hilt_ChaslayPosApp { *; }
-keep class com.chaslay.pos.Hilt_ChaslayPosApp$* { *; }
-keep class androidx.multidex.MultiDexApplication { *; }
-keep class androidx.multidex.** { *; }
