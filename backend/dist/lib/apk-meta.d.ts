export type ApkMeta = {
    versionName: string | null;
};
/** Read versionName embedded in an APK's AndroidManifest.xml. */
export declare function readApkMeta(apkPath: string): ApkMeta;
//# sourceMappingURL=apk-meta.d.ts.map